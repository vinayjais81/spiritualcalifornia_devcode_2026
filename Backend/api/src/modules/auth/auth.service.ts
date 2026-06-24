import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role, VerificationStatus, Prisma } from '@prisma/client';
import { checkPasswordPolicy } from '../../common/validators/is-strong-password.validator';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Build the JSON blob for `pendingProfileJson` from the wizard's optional
   * step-1 fields on the register DTO. Returns null when no fields are
   * present so we don't store empty objects on seeker registrations.
   * Whitelist-only: any future register-DTO field needs explicit pickup
   * here AND a matching apply path in `applyPendingGuideProfile`.
   */
  private buildPendingGuideProfile(dto: RegisterDto): Record<string, unknown> | null {
    const profile: Record<string, unknown> = {};
    if (dto.tagline) profile.tagline = dto.tagline;
    if (dto.bio) profile.bio = dto.bio;
    if (dto.location) profile.location = dto.location;
    if (dto.timezone) profile.timezone = dto.timezone;
    if (dto.websiteUrl) profile.websiteUrl = dto.websiteUrl;
    if (dto.languages && dto.languages.length > 0) profile.languages = dto.languages;
    return Object.keys(profile).length > 0 ? profile : null;
  }

  /**
   * Reject passwords that are too easily guessed from public-facing user
   * data: email local-part, first name, last name. Composition rules are
   * already enforced by IsStrongPassword on the DTO; this is the cross-
   * field check that needs the surrounding form values.
   */
  private assertPasswordNotPersonal(
    password: string,
    fields: { email: string; firstName?: string; lastName?: string },
  ): void {
    const lowerPwd = password.toLowerCase();
    const localPart = fields.email.split('@')[0]?.toLowerCase() ?? '';
    const candidates = [
      localPart,
      fields.firstName?.toLowerCase() ?? '',
      fields.lastName?.toLowerCase() ?? '',
    ].filter((s) => s.length >= 4); // ignore very short names like "Li"

    for (const candidate of candidates) {
      if (lowerPwd.includes(candidate)) {
        throw new BadRequestException(
          'Password cannot contain your name or email.',
        );
      }
    }
  }

  /**
   * True when the email's domain matches the configured pre-launch test
   * domain. Defaults to scprelaunch.test (RFC-reserved .test TLD, can't
   * accidentally route real mail). Used to auto-flag User.isTestAccount at
   * registration so the admin convert-test-account workflow can later swap
   * the throwaway email for a real one.
   */
  isTestDomainEmail(email: string): boolean {
    const domain = (
      this.configService.get<string>('TEST_ACCOUNT_EMAIL_DOMAIN', '') ||
      'scprelaunch.test'
    )
      .trim()
      .toLowerCase()
      .replace(/^@/, '');
    if (!domain) return false;
    const lower = email.trim().toLowerCase();
    const at = lower.lastIndexOf('@');
    if (at < 0) return false;
    return lower.slice(at + 1) === domain;
  }

  // ─── Register ───────────────────────────────────────────────────────────────

  /**
   * Register a new user. Critically, this DOES NOT issue access/refresh
   * tokens — the user must verify their email first via the link in the
   * verification email, at which point /auth/verify-email will assign the
   * role + create the profile + mint tokens.
   *
   * Guards against fake / typo / malicious registrations: nobody holds a
   * session for an account they didn't prove they own.
   *
   * The intent ('seeker' | 'guide') is persisted on the User row so that
   * /auth/verify-email knows which side-effects to run. Optional fields
   * captured by the form (phone, location, newsletter opt-in) are saved
   * as well — they don't depend on a role and aren't sensitive on their
   * own.
   */
  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    this.assertPasswordNotPersonal(dto.password, {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Pre-launch onboarding: when admin self-registers a guide using an email
    // on the configured test domain (default scprelaunch.test), mark the row
    // so the admin "Convert test account" workflow can later swap the email
    // for a real one. Real users on real domains are never flagged.
    const isTestAccount = this.isTestDomainEmail(dto.email);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      isTestAccount,
    });

    const intent: 'seeker' | 'guide' = dto.intent === 'guide' ? 'guide' : 'seeker';

    // Stash wizard step 1 profile fields (guide intent only) so verifyEmail
    // can apply them when creating GuideProfile. Without this the user types
    // data into the wizard, sees "check your inbox", and the data dies in
    // browser-local state because the register API didn't see it.
    const pendingProfile =
      intent === 'guide'
        ? this.buildPendingGuideProfile(dto)
        : null;

    // ── Test-account fast path ────────────────────────────────────────────
    //
    // Test-domain emails (e.g. `@scprelaunch.test`) live in an RFC-reserved
    // TLD that never routes real mail, so the normal "click the link in your
    // inbox" gate is a dead-end for admin pre-launch onboarding. When the
    // auto-flag fires, we collapse register + verify-email into a single
    // call: mark verified, run the same role/profile side-effects that
    // `verifyEmail` would have run, and mint tokens. End state identical
    // to a real user that clicked the link.
    //
    // Real users on real domains keep the verification gate — the security
    // story (no session until you prove you own the address) is untouched.
    if (isTestAccount) {
      await this.usersService.update(user.id, {
        isEmailVerified: true,
        pendingIntent: intent,
        ...(dto.phone ? { phone: dto.phone } : {}),
        ...(dto.newsletterOptIn !== undefined
          ? { marketingEmails: dto.newsletterOptIn }
          : {}),
      });

      if (intent === 'seeker') {
        await Promise.all([
          this.prisma.seekerProfile.create({ data: { userId: user.id } }),
          this.prisma.userRole.create({ data: { userId: user.id, role: Role.SEEKER } }),
        ]);
      } else {
        const baseSlug = `${user.firstName} ${user.lastName}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const slug = await this.ensureUniqueGuideSlug(baseSlug);
        await Promise.all([
          this.prisma.guideProfile.create({
            data: {
              userId: user.id,
              slug,
              displayName: `${user.firstName} ${user.lastName}`,
              verificationStatus: VerificationStatus.PENDING,
              ...(pendingProfile ?? {}),
            },
          }),
          this.prisma.userRole.create({ data: { userId: user.id, role: Role.GUIDE } }),
        ]);
      }

      const fullUser = await this.usersService.findByIdOrThrow(user.id);
      const roles = fullUser.roles.map((r) => r.role);
      const tokens = await this.generateTokens(user.id, user.email, roles);
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        user: this.sanitizeUser(fullUser),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        requiresEmailVerification: false,
        autoVerified: true,
        intent,
      };
    }

    // ── Normal path: real domain — issue verification token, no session. ──

    await this.usersService.update(user.id, {
      emailVerifyToken,
      emailVerifyExpiry,
      pendingIntent: intent,
      ...(dto.phone ? { phone: dto.phone } : {}),
      ...(dto.newsletterOptIn !== undefined
        ? { marketingEmails: dto.newsletterOptIn }
        : {}),
    });

    // Write pendingProfileJson via Prisma directly. Same reason as the clear
    // in verifyEmail: the usersService.update wrapper's Pick<>-based type
    // can't accommodate Prisma's JSON-column INPUT shape
    // (NullableJsonNullValueInput | InputJsonValue) — only the READ shape
    // (JsonValue | null). Bypassing the wrapper here keeps the wrapper's
    // type surface narrow and lets Prisma's own input typing do its job.
    if (pendingProfile) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { pendingProfileJson: pendingProfile as Prisma.InputJsonValue },
      });
    }

    // Send verification email — fire-and-forget. The user MUST click the
    // link before they can log in; there's no fallback path that issues
    // tokens without verification.
    void this.sendVerificationEmail(user.email, user.firstName, emailVerifyToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      requiresEmailVerification: true,
    };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new UnauthorizedException('Please use social login');
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact support to reactivate.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    // Block sign-in for unverified emails. Without this gate someone could
    // register with a typo / someone else's address and immediately log in
    // — that's the threat we're closing. Frontend renders a friendly
    // "verify your email first" message + resend link on this exact code.
    if (!user.isEmailVerified) {
      throw new UnauthorizedException('EMAIL_NOT_VERIFIED');
    }

    await this.usersService.update(user.id, { lastLoginAt: new Date() });

    const roles = user.roles.map((r) => r.role);
    const tokens = await this.generateTokens(user.id, user.email, roles);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  async loginWithGoogle(googleUser: { googleId: string; email: string; firstName: string; lastName: string }) {
    // Find existing user by googleId or email
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
      },
      include: { roles: true },
    });

    let isNewUser = false;

    if (user) {
      // Link googleId if they registered via email previously
      if (!user.googleId) {
        await this.usersService.update(user.id, { lastLoginAt: new Date() });
        await this.prisma.user.update({ where: { id: user.id }, data: { googleId: googleUser.googleId } });
      } else {
        await this.usersService.update(user.id, { lastLoginAt: new Date() });
      }
    } else {
      isNewUser = true;
      // New user — create account + seeker profile
      user = await this.usersService.create({
        email: googleUser.email,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        googleId: googleUser.googleId,
      });
      await Promise.all([
        this.usersService.createSeekerProfile(user.id),
        this.usersService.assignRole(user.id, Role.SEEKER),
      ]);
      user = await this.prisma.user.findUnique({ where: { id: user.id }, include: { roles: true } }) as any;
    }

    const roles = user!.roles.map((r: any) => r.role);
    const tokens = await this.generateTokens(user!.id, user!.email, roles);
    await this.saveRefreshToken(user!.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      isNewUser,
    };
  }

  // ─── Refresh Tokens ─────────────────────────────────────────────────────────

  /**
   * Refresh the access + refresh token pair. Rotates the refresh token on
   * every call. If the incoming token is *already* revoked, we check the
   * 60-second grace window: a rotation that happened recently is treated
   * as a race (e.g. two tabs both calling /auth/refresh simultaneously) and
   * the replacement token is returned. This is the fix for the UX bug where
   * "the session just times out" — historically that was one of two parallel
   * refresh calls losing the race and being logged out.
   */
  async refreshTokens(userId: string, incomingRefreshToken: string) {
    const GRACE_MS = 60_000;

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: incomingRefreshToken },
    });

    if (!storedToken || storedToken.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Grace window: if the incoming token was revoked very recently AND the
    // replacement is still alive, mint an access token against the replacement
    // without rotating again. Concurrent refreshes converge on the same state.
    if (storedToken.isRevoked) {
      const revokedRecently =
        storedToken.revokedAt &&
        Date.now() - storedToken.revokedAt.getTime() < GRACE_MS;

      if (revokedRecently && storedToken.replacedByTokenId) {
        const replacement = await this.prisma.refreshToken.findUnique({
          where: { id: storedToken.replacedByTokenId },
        });
        if (
          replacement &&
          !replacement.isRevoked &&
          replacement.expiresAt > new Date()
        ) {
          const roles = await this.usersService.getRoles(userId);
          const user = await this.usersService.findByIdOrThrow(userId);
          const accessToken = await this.generateAccessToken(
            userId,
            user.email,
            roles,
          );
          this.logger.debug(
            `Refresh grace window hit for user ${userId} — reusing replacement token`,
          );
          return { accessToken, refreshToken: replacement.token };
        }
      }

      // Outside the grace window, treat as stolen / reused and reject.
      // Also revoke ALL active refresh tokens for this user as a defensive
      // measure against refresh-token replay attacks.
      await this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse detected for user ${userId}. Revoking all active tokens.`,
      );
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    // Normal rotation path: mint new pair, then revoke the old one and link
    // it to the replacement so that a racing request can hit the grace
    // window above.
    const roles = await this.usersService.getRoles(userId);
    const user = await this.usersService.findByIdOrThrow(userId);
    const tokens = await this.generateTokens(userId, user.email, roles);
    const newStored = await this.saveRefreshToken(userId, tokens.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        replacedByTokenId: newStored.id,
      },
    });

    return tokens;
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(userId: string, refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ─── Verify Email ───────────────────────────────────────────────────────────

  /**
   * Verify the email-verification token from the link sent at /auth/register.
   *
   * On success this:
   *   1. Marks isEmailVerified = true.
   *   2. Reads `pendingIntent` and runs the role/profile side-effects that
   *      were deferred at register time (assign SEEKER/GUIDE, create
   *      SeekerProfile / GuideProfile via existing helpers).
   *   3. Mints access + refresh tokens and returns them — this is the
   *      first time the user receives a session.
   *
   * Idempotent for users that have already been verified previously
   * (e.g. someone clicks the email link twice). Returns tokens regardless,
   * so the second click also "logs them in" rather than erroring.
   */
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Invalid verification token');
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    // Run intent-driven side-effects that were deferred at register time.
    // We call these via Prisma directly (rather than depending on
    // SeekersService / GuidesService) because pulling in those modules
    // creates a circular import with AuthModule.
    const intent = user.pendingIntent;
    const existingRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    const hasAnyRole = existingRoles.length > 0;

    if (!hasAnyRole && intent === 'seeker') {
      await Promise.all([
        this.prisma.seekerProfile.create({ data: { userId: user.id } }),
        this.prisma.userRole.create({ data: { userId: user.id, role: Role.SEEKER } }),
      ]);
    }
    if (!hasAnyRole && intent === 'guide') {
      // Guide gets a slug + GuideProfile shell. Mirrors the logic in
      // GuidesService.startOnboarding so /onboarding/guide can resume from
      // step 2 without a separate /guides/onboarding/start call.
      const baseSlug = `${user.firstName} ${user.lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = await this.ensureUniqueGuideSlug(baseSlug);

      // Apply any wizard step 1 profile data stashed at register time so
      // the user doesn't lose what they typed. Whitelisted fields only.
      const pending = (user.pendingProfileJson ?? null) as Record<string, unknown> | null;
      const profileExtras: Record<string, unknown> = {};
      if (pending) {
        if (typeof pending.tagline === 'string') profileExtras.tagline = pending.tagline;
        if (typeof pending.bio === 'string') profileExtras.bio = pending.bio;
        if (typeof pending.location === 'string') profileExtras.location = pending.location;
        if (typeof pending.timezone === 'string') profileExtras.timezone = pending.timezone;
        if (typeof pending.websiteUrl === 'string') profileExtras.websiteUrl = pending.websiteUrl;
        if (Array.isArray(pending.languages)) {
          profileExtras.languages = pending.languages.filter((l) => typeof l === 'string');
        }
      }

      await Promise.all([
        this.prisma.guideProfile.create({
          data: {
            userId: user.id,
            slug,
            displayName: `${user.firstName} ${user.lastName}`,
            verificationStatus: VerificationStatus.PENDING,
            ...profileExtras,
          },
        }),
        this.prisma.userRole.create({ data: { userId: user.id, role: Role.GUIDE } }),
      ]);
    }

    await this.usersService.update(user.id, {
      isEmailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
      pendingIntent: null,
    });

    // Clear the one-shot pending payload via Prisma directly. The
    // usersService.update wrapper types pendingProfileJson against the User
    // READ type (JsonValue | null), which can't accept Prisma.DbNull — the
    // INPUT marker required to nullify a JSON column. Bypass the wrapper
    // for this single call. Stale residue would be harmless (the token is
    // consumed and verifyEmail won't run again), but nulling keeps the row
    // tidy and avoids ever surprising a future reader.
    if (user.pendingProfileJson !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { pendingProfileJson: Prisma.DbNull },
      });
    }

    // Mint a session for the freshly-verified user.
    const fullUser = await this.usersService.findByIdOrThrow(user.id);
    const roles = fullUser.roles.map((r) => r.role);
    const tokens = await this.generateTokens(user.id, user.email, roles);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(fullUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      intent: intent ?? 'seeker',
    };
  }

  // ─── Claim Account (pre-launch test-account conversion) ────────────────────
  //
  // Used after admin swaps a test account's email for the real one (see
  // AdminService.convertTestAccount). The guide receives an email at the new
  // address with a `/guide/claim?token=...` link. This endpoint validates
  // that token, sets the chosen password, marks the email verified, and
  // mints a session — same end-state as /verify-email + /reset-password
  // combined into a single round-trip.
  //
  // Token reuses the existing `emailVerifyToken` column: it's already a
  // single-use 32-byte random with an expiry, and the schema doesn't need
  // another column to hold it. Personal-password check uses the FRESH
  // password against the target user's name + (new) email.

  async claimAccount(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Invalid claim token');
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      throw new BadRequestException('Claim token expired');
    }
    if (!user.isTestAccount) {
      // Defense-in-depth: the claim endpoint is only for accounts that went
      // through the admin convert workflow. A real user with a stray
      // emailVerifyToken should be sent down /verify-email or
      // /reset-password instead — never both at once.
      throw new BadRequestException(
        'This token is not valid for the claim flow.',
      );
    }

    this.assertPasswordNotPersonal(password, {
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    });

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isEmailVerified: true,
          emailVerifyToken: null,
          emailVerifyExpiry: null,
          // Also clear any pending password-reset state — the claim password
          // is now the source of truth.
          passwordResetToken: null,
          passwordResetExpiry: null,
        },
      }),
      // Belt-and-suspenders: convertTestAccount already revoked refresh
      // tokens at the swap. If a stale one slipped through, kill it now.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true, revokedAt: new Date() },
      }),
    ]);

    const fullUser = await this.usersService.findByIdOrThrow(user.id);
    const roles = fullUser.roles.map((r) => r.role);
    const tokens = await this.generateTokens(user.id, user.email, roles);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(fullUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * Slug uniqueness helper duplicated from GuidesService.ensureUniqueSlug
   * to avoid the circular AuthModule → GuidesModule import the lazy
   * profile creation in verifyEmail() would otherwise need.
   */
  private async ensureUniqueGuideSlug(base: string): Promise<string> {
    let slug = base || 'guide';
    let attempt = 0;
    // Hard ceiling so a pathological collision can't run forever.
    while (attempt < 100) {
      const exists = await this.prisma.guideProfile.findUnique({ where: { slug } });
      if (!exists) return slug;
      slug = `${base}-${++attempt}`;
    }
    return `${base}-${Date.now()}`;
  }

  // ─── Forgot Password ────────────────────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent' };

    const resetToken = randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.usersService.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpiry: resetExpiry,
    });

    void this.sendPasswordResetEmail(user.email, user.firstName, resetToken);

    return { message: 'If that email exists, a reset link has been sent' };
  }

  // ─── Reset Password ─────────────────────────────────────────────────────────

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');
    if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    this.assertPasswordNotPersonal(newPassword, {
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    });

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.usersService.update(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

    // Revoke all refresh tokens on password reset
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    return { message: 'Password reset successfully' };
  }

  // ─── Change Password (authenticated) ────────────────────────────────────────

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new BadRequestException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const policy = checkPasswordPolicy(newPassword);
    if (!policy.valid) throw new BadRequestException(policy.errors.join(' '));

    this.assertPasswordNotPersonal(newPassword, {
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash });

    return { message: 'Password changed successfully' };
  }

  // ─── Calendly OAuth ─────────────────────────────────────────────────────────

  async getCalendlyAuthUrl(userId: string, redirectTo?: string): Promise<{ url: string }> {
    const clientId = this.configService.get<string>('CALENDLY_CLIENT_ID', '');
    const redirectUri = this.configService.get<string>('CALENDLY_REDIRECT_URI', '');

    // Sign a short-lived state token embedding the userId + where to redirect after
    const state = await this.jwtService.signAsync(
      { sub: userId, purpose: 'calendly_oauth', redirectTo: redirectTo || '/onboarding/guide' },
      { secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '10m' },
    );

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
    });

    return { url: `https://auth.calendly.com/oauth/authorize?${params.toString()}` };
  }

  async handleCalendlyCallback(code: string, state: string): Promise<string> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Verify state and extract userId + redirect target
    let userId: string;
    let redirectTo = '/onboarding/guide';
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; purpose: string; redirectTo?: string }>(state, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.purpose !== 'calendly_oauth') throw new Error('Invalid state purpose');
      userId = payload.sub;
      redirectTo = payload.redirectTo || '/onboarding/guide';
    } catch {
      this.logger.warn('[Calendly] Invalid OAuth state — rejecting callback');
      return `${frontendUrl}/onboarding/guide?calendly=error`;
    }

    // Exchange code for tokens
    const clientId = this.configService.get<string>('CALENDLY_CLIENT_ID', '');
    const clientSecret = this.configService.get<string>('CALENDLY_CLIENT_SECRET', '');
    const redirectUri = this.configService.get<string>('CALENDLY_REDIRECT_URI', '');

    const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      this.logger.error(`[Calendly] Token exchange failed: ${tokenRes.status} ${errText}`);
      return `${frontendUrl}${redirectTo}?calendly=error`;
    }

    const tokens: any = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string = tokens.refresh_token ?? '';

    // Fetch the Calendly user URI
    const meRes = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let userUri = '';
    if (meRes.ok) {
      const me: any = await meRes.json();
      userUri = me.resource?.uri ?? '';
    }

    // Fetch the scheduling URL from the first active event type
    let schedulingUrl = '';
    if (userUri) {
      try {
        const etRes = await fetch(
          `https://api.calendly.com/event_types?user=${userUri}&active=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (etRes.ok) {
          const etData: any = await etRes.json();
          schedulingUrl = etData.collection?.[0]?.scheduling_url ?? '';
        }
      } catch {
        this.logger.warn('[Calendly] Failed to fetch event types for scheduling URL');
      }
    }

    // Persist tokens + scheduling URL on the guide profile
    await this.prisma.guideProfile.update({
      where: { userId },
      data: {
        calendarType: 'Calendly',
        calendarLink: schedulingUrl || undefined,
        calendlyConnected: true,
        calendlyAccessToken: accessToken,
        calendlyRefreshToken: refreshToken,
        calendlyUserUri: userUri,
      },
    });

    this.logger.log(`[Calendly] Connected for userId=${userId}, schedulingUrl=${schedulingUrl}`);
    return `${frontendUrl}${redirectTo}?calendly=connected`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Mint the access + refresh token pair. Lifetimes come from env so ops can
   * tune them without a code change (see env.validation.ts). Defaults are
   * 30m access / 7d refresh — access token long enough to keep idle users
   * logged in through short breaks, short enough to limit exposure if an
   * access token leaks.
   */
  async generateTokens(userId: string, email: string, roles: Role[]) {
    const accessToken = await this.generateAccessToken(userId, email, roles);
    // The `expiresIn` cast is safe: env.validation.ts requires the value to
    // be a string and the JWT lib parses it with `ms`, which accepts any
    // well-formed duration ('7d', '30m', '90s', etc.). Cast silences the
    // `ms.StringValue` template-literal type.
    const refreshToken = await this.jwtService.signAsync(
      // `jti` is a per-mint random nonce. Without it, two refresh tokens minted
      // for the same user within the same second produce a byte-identical JWT
      // (iat/exp are second-resolution), which collides on the unique `token`
      // column. The nonce guarantees uniqueness regardless of timing.
      { sub: userId, email, roles, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as any,
      },
    );
    return { accessToken, refreshToken };
  }

  /** Mints only the short-lived access token. Used by the rotation grace path. */
  async generateAccessToken(userId: string, email: string, roles: Role[]) {
    return this.jwtService.signAsync(
      { sub: userId, email, roles },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '30m',
        ) as any,
      },
    );
  }

  /**
   * Persist a refresh token and return the created record so callers can
   * link the OLD token to its replacement (for the rotation grace window).
   * Expiry is parsed from the signed JWT itself via `decode` so it stays in
   * sync with JWT_REFRESH_EXPIRES_IN without duplicating the lifetime logic.
   */
  private async saveRefreshToken(userId: string, token: string) {
    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp && Number.isFinite(decoded.exp)
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  sanitizeUser(user: any) {
    const { passwordHash, emailVerifyToken, passwordResetToken, ...safe } = user;
    return {
      ...safe,
      roles: (user.roles ?? []).map((r: any) => r.role ?? r),
    };
  }

  private async sendVerificationEmail(email: string, name: string, token: string) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY', '');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@spiritualcalifornia.com');

    if (!resendKey || resendKey.includes('placeholder')) {
      this.logger.warn(`[DEV] Email verify link for ${email}: ${frontendUrl}/verify-email?token=${token}`);
      return;
    }

    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
    const resend = new Resend(resendKey);

    try {
      await Promise.race([
        resend.emails.send({
          from: `Spiritual California <${fromEmail}>`,
          to: email,
          subject: 'Verify your email — Spiritual California',
          html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
          <body style="margin:0;padding:0;background:#FAFAF7;font-family:'Inter',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 20px;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid rgba(232,184,75,0.2);overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#3A3530,#5A4A3A);padding:32px 40px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#E8B84B;letter-spacing:0.04em;">Spiritual California</p>
                      <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.5);">mind · body · soul</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E8B84B;">Almost There</p>
                      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#3A3530;line-height:1.2;">
                        Check your<br/><em style="color:#E8B84B;font-style:italic;">inbox</em>
                      </h1>
                      <p style="margin:0 0 28px;font-size:14px;color:#8A8278;line-height:1.7;">
                        Hi ${name}, welcome to Spiritual California. Click the button below to verify your email address and activate your account.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="background:#3A3530;border-radius:8px;">
                            <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;color:#B5AFA8;">Or copy and paste this link into your browser:</p>
                      <p style="margin:0;font-size:12px;color:#E8B84B;word-break:break-all;">${verifyUrl}</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px 28px;border-top:1px solid rgba(232,184,75,0.12);">
                      <p style="margin:0;font-size:12px;color:#C4BDB5;line-height:1.6;">
                        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Resend timeout after 10s')), 10_000),
        ),
      ]);
      this.logger.log(`Verification email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send verification email to ${email}: ${err?.message}`);
    }
  }

  private async sendPasswordResetEmail(email: string, name: string, token: string) {
    const resendKey = this.configService.get<string>('RESEND_API_KEY', '');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@spiritualcalifornia.com');

    if (!resendKey || resendKey.includes('placeholder')) {
      this.logger.warn(`[DEV] Password reset link for ${email}: ${frontendUrl}/reset-password?token=${token}`);
      return;
    }

    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const resend = new Resend(resendKey);

    try {
      await Promise.race([
        resend.emails.send({
          from: `Spiritual California <${fromEmail}>`,
          to: email,
          subject: 'Reset your password — Spiritual California',
          html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
          <body style="margin:0;padding:0;background:#FAFAF7;font-family:'Inter',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 20px;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid rgba(232,184,75,0.2);overflow:hidden;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#3A3530,#5A4A3A);padding:32px 40px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#E8B84B;letter-spacing:0.04em;">Spiritual California</p>
                      <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.5);">mind · body · soul</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E8B84B;">Password Reset</p>
                      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#3A3530;line-height:1.2;">
                        Reset your<br/><em style="color:#E8B84B;font-style:italic;">password</em>
                      </h1>
                      <p style="margin:0 0 28px;font-size:14px;color:#8A8278;line-height:1.7;">
                        Hi ${name}, we received a request to reset your password. Click the button below. This link expires in 1 hour.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="background:#3A3530;border-radius:8px;">
                            <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;color:#B5AFA8;">Or copy and paste this link:</p>
                      <p style="margin:0;font-size:12px;color:#E8B84B;word-break:break-all;">${resetUrl}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px 28px;border-top:1px solid rgba(232,184,75,0.12);">
                      <p style="margin:0;font-size:12px;color:#C4BDB5;line-height:1.6;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Resend timeout after 10s')), 10_000),
        ),
      ]);
      this.logger.log(`Password reset email sent to ${email}`);
    } catch (err: any) {
      this.logger.error(`Failed to send password reset email to ${email}: ${err?.message}`);
    }
  }
}
