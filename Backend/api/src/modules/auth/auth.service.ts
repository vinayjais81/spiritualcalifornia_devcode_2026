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
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
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

  // ─── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const emailVerifyToken = randomBytes(32).toString('hex');
    const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    // Set email verify token + create seeker profile + assign SEEKER role
    await Promise.all([
      this.usersService.update(user.id, {
        emailVerifyToken,
        emailVerifyExpiry,
        ...(dto.phone ? { phone: dto.phone } : {}),
        ...(dto.newsletterOptIn !== undefined ? { marketingEmails: dto.newsletterOptIn } : {}),
      }),
      this.usersService.createSeekerProfile(user.id, dto.location),
      this.usersService.assignRole(user.id, Role.SEEKER),
    ]);

    // Send verification email — fire-and-forget (never block register response)
    void this.sendVerificationEmail(user.email, user.firstName, emailVerifyToken);

    const roles = [Role.SEEKER];
    const tokens = await this.generateTokens(user.id, user.email, roles);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser({ ...user, roles: [{ role: Role.SEEKER }] }),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.passwordHash) throw new UnauthorizedException('Please use social login');
    if (!user.isActive || user.isBanned) throw new UnauthorizedException('Account suspended');

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

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

  async refreshTokens(userId: string, incomingRefreshToken: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: incomingRefreshToken },
    });

    if (!storedToken || storedToken.userId !== userId || storedToken.isRevoked) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { isRevoked: true },
    });

    const roles = await this.usersService.getRoles(userId);
    const user = await this.usersService.findByIdOrThrow(userId);
    const tokens = await this.generateTokens(userId, user.email, roles);
    await this.saveRefreshToken(userId, tokens.refreshToken);

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

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Invalid verification token');
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      throw new BadRequestException('Verification token expired');
    }

    await this.usersService.update(user.id, {
      isEmailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    });

    return { message: 'Email verified successfully' };
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

  // ─── Calendly OAuth ─────────────────────────────────────────────────────────

  async getCalendlyAuthUrl(userId: string): Promise<{ url: string }> {
    const clientId = this.configService.get<string>('CALENDLY_CLIENT_ID', '');
    const redirectUri = this.configService.get<string>('CALENDLY_REDIRECT_URI', '');

    // Sign a short-lived state token embedding the userId
    const state = await this.jwtService.signAsync(
      { sub: userId, purpose: 'calendly_oauth' },
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

    // Verify state and extract userId
    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; purpose: string }>(state, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.purpose !== 'calendly_oauth') throw new Error('Invalid state purpose');
      userId = payload.sub;
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
      return `${frontendUrl}/onboarding/guide?calendly=error`;
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

    // Persist tokens on the guide profile
    await this.prisma.guideProfile.update({
      where: { userId },
      data: {
        calendarType: 'Calendly',
        calendlyConnected: true,
        calendlyAccessToken: accessToken,
        calendlyRefreshToken: refreshToken,
        calendlyUserUri: userUri,
      },
    });

    this.logger.log(`[Calendly] Connected for userId=${userId}`);
    return `${frontendUrl}/onboarding/guide?calendly=connected`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async generateTokens(userId: string, email: string, roles: Role[]) {
    const payload = { sub: userId, email, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, token: string) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7d
    await this.prisma.refreshToken.create({ data: { userId, token, expiresAt } });
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
