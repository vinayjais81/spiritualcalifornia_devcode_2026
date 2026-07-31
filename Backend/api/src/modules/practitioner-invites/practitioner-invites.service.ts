import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { OnboardingPath, ProspectStatus, SuppressionReason } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PractitionerImportService } from '../practitioner-import/practitioner-import.service';

/**
 * A cold invite may be read a week after it lands, so the 24-hour window the
 * admin convert workflow uses is far too short. 30 days, with a self-service
 * path when it lapses.
 */
const INVITE_TOKEN_DAYS = 30;

/** Domain separator so an unsubscribe token can never be replayed elsewhere. */
const UNSUBSCRIBE_PURPOSE = 'practitioner-invite-unsubscribe:v1';

@Injectable()
export class PractitionerInvitesService {
  private readonly logger = new Logger(PractitionerInvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly imports: PractitionerImportService,
  ) {}

  // ─── Claim tokens ──────────────────────────────────────────────────────────

  /**
   * Mint a claim token for an invited guide. Reuses `emailVerifyToken` so the
   * existing `/guide/claim` page and `POST /auth/claim-account` work unchanged
   * — only the lifetime differs.
   *
   * Returns the token; the caller decides what to do with it. Phase 3's sender
   * calls this. Nothing here sends anything.
   */
  async issueClaimToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { guideProfile: { select: { onboardingPath: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.guideProfile?.onboardingPath !== OnboardingPath.PROACTIVE_INVITE) {
      throw new BadRequestException('This account was not created by an import.');
    }
    if (user.passwordHash) {
      throw new BadRequestException('This account has already been claimed.');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyToken: token,
        emailVerifyExpiry: expiresAt,
        invitedAt: user.invitedAt ?? new Date(),
      },
    });

    return { token, expiresAt };
  }

  /**
   * Describe a claim token without consuming it, so `/guide/claim` can greet
   * the practitioner by name and show a useful page when the link has lapsed.
   *
   * Deliberately reveals nothing about accounts that don't exist — an invalid
   * token and a stranger's token are indistinguishable in the response.
   */
  async describeClaimToken(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
      include: { guideProfile: { select: { displayName: true, onboardingPath: true } } },
    });

    if (!user || user.guideProfile?.onboardingPath !== OnboardingPath.PROACTIVE_INVITE) {
      return { valid: false as const, reason: 'unknown' as const };
    }
    if (user.passwordHash) {
      return { valid: false as const, reason: 'already-claimed' as const };
    }
    if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
      return {
        valid: false as const,
        reason: 'expired' as const,
        firstName: user.firstName,
        supportEmail: this.supportEmail,
      };
    }

    return {
      valid: true as const,
      firstName: user.firstName,
      displayName: user.guideProfile?.displayName ?? null,
      expiresAt: user.emailVerifyExpiry,
    };
  }

  // ─── Unsubscribe / delete tokens ───────────────────────────────────────────

  /**
   * Stateless signed token: `<userId>.<hmac>`.
   *
   * No database column, which matters here — the whole point of the link is
   * that using it destroys the row it refers to, so a stored token would be
   * deleted by the very action it authorises. Replay after deletion simply
   * finds nothing and reports "already removed".
   */
  buildUnsubscribeToken(userId: string): string {
    return `${userId}.${this.signUnsubscribe(userId)}`;
  }

  private signUnsubscribe(userId: string): string {
    const secret =
      this.config.get<string>('EMAIL_HASH_SECRET') ??
      this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('EMAIL_HASH_SECRET (or JWT_ACCESS_SECRET) must be set');
    return createHmac('sha256', secret).update(`${UNSUBSCRIBE_PURPOSE}:${userId}`).digest('hex');
  }

  private verifyUnsubscribeToken(token: string): string | null {
    const [userId, signature] = (token || '').split('.');
    if (!userId || !signature) return null;
    const expected = this.signUnsubscribe(userId);
    // Constant-time compare — a fast-fail comparison leaks the signature byte
    // by byte to anyone willing to time it.
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? userId : null;
  }

  /**
   * What the confirmation page shows. **Read-only on purpose.**
   *
   * Corporate mail scanners and link-preview bots follow every URL in an email,
   * so deleting on a GET would silently remove practitioners who never clicked.
   * The destructive step is the POST below.
   */
  async describeUnsubscribe(token: string) {
    const userId = this.verifyUnsubscribeToken(token);
    if (!userId) return { valid: false as const, reason: 'invalid' as const };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { guideProfile: { select: { displayName: true, onboardingPath: true } } },
    });

    // Already gone — reported as success, not an error. Someone who clicks the
    // link twice should be reassured, not alarmed.
    if (!user) return { valid: true as const, alreadyRemoved: true as const };

    return {
      valid: true as const,
      alreadyRemoved: false as const,
      firstName: user.firstName,
      displayName: user.guideProfile?.displayName ?? `${user.firstName} ${user.lastName}`.trim(),
      email: this.maskEmail(user.email),
      isInvited: user.guideProfile?.onboardingPath === OnboardingPath.PROACTIVE_INVITE,
      supportEmail: this.supportEmail,
    };
  }

  /**
   * Remove a practitioner's information, on their own say-so, with no login.
   *
   * Order matters: the suppression tombstone is written **first**, inside the
   * transaction. If we deleted the account and then failed to write the
   * tombstone, the next import of the same spreadsheet would recreate the
   * person and email them again — the worst outcome this feature can produce.
   */
  async unsubscribeAndDelete(token: string, ip?: string) {
    const userId = this.verifyUnsubscribeToken(token);
    if (!userId) throw new BadRequestException('This link is not valid.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        guideProfile: {
          select: {
            id: true,
            onboardingPath: true,
            _count: {
              select: {
                services: true,
                events: true,
                products: true,
                soulTours: true,
                blogPosts: true,
                ledgerEntries: true,
                payoutRequests: true,
              },
            },
          },
        },
      },
    });

    if (!user) return { removed: true, alreadyRemoved: true };

    const emailHash = this.imports.hashEmail(user.email);
    const activity = user.guideProfile?._count;
    const hasActivity =
      !!activity &&
      Object.values(activity).some((count) => count > 0);

    await this.prisma.$transaction(async (tx) => {
      // 1. Tombstone first, always.
      await tx.emailSuppression.upsert({
        where: { emailHash },
        update: { reason: SuppressionReason.DELETED },
        create: {
          emailHash,
          reason: SuppressionReason.DELETED,
          note: 'Removed via the invite email link',
        },
      });

      // 2. Scrub the prospect row, keeping only the fingerprint. That hash is
      //    what lets a future import of the same list recognise this row and
      //    skip it even when the file's email column is blank.
      await tx.importedProspect.updateMany({
        where: { userId: user.id },
        data: {
          userId: null,
          name: '(removed at request)',
          email: null,
          city: null,
          modality: null,
          websiteUrl: null,
          workedNote: null,
          rawJson: {},
          status: ProspectStatus.EXCLUDED,
          skipReason: 'Removed at the practitioner’s request — do not re-import',
        },
      });

      // 3. Remove the account itself. Hard delete is only safe for an untouched
      //    invited account: services, events and ledger entries do not cascade,
      //    so an account with any history is deactivated and anonymised
      //    instead of failing on a foreign key halfway through.
      if (hasActivity) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            marketingEmails: false,
            deactivatedAt: new Date(),
            deactivatedReason: 'Removed at the practitioner’s request',
            emailVerifyToken: null,
            emailVerifyExpiry: null,
          },
        });
        this.logger.warn(
          `Unsubscribe for user ${user.id} kept the row: the account has activity. Deactivated and suppressed instead.`,
        );
      } else {
        await tx.user.delete({ where: { id: user.id } });
      }

      // 4. Audit WITHOUT the address. Writing the email here would preserve
      //    exactly the data the practitioner just asked us to erase.
      await tx.auditLog.create({
        data: {
          action: 'practitionerInvite.unsubscribeDelete',
          entity: 'User',
          entityId: user.id,
          ipAddress: ip,
          newValue: {
            emailHash,
            hadActivity: hasActivity,
            outcome: hasActivity ? 'deactivated-and-suppressed' : 'deleted',
          },
        },
      });
    });

    this.logger.log(`Practitioner removed at own request (user ${user.id}, activity=${hasActivity})`);
    return { removed: true, alreadyRemoved: false, deactivatedInstead: hasActivity };
  }

  // ─── URLs ──────────────────────────────────────────────────────────────────
  // Built here so the invite template (Phase 3) can't assemble a link that
  // doesn't match the routes these tokens are validated on.

  buildClaimUrl(token: string): string {
    return `${this.frontendUrl}/guide/claim?token=${token}`;
  }

  buildUnsubscribeUrl(userId: string): string {
    return `${this.frontendUrl}/unsubscribe?token=${this.buildUnsubscribeToken(userId)}`;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private get frontendUrl(): string {
    return (this.config.get<string>('FRONTEND_URL') ?? '').replace(/\/+$/, '');
  }

  private get supportEmail(): string {
    return this.config.get<string>('SUPPORT_EMAIL') ?? 'support@spiritualcalifornia.com';
  }

  /** m***@example.com — enough to recognise, not enough to harvest. */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const head = local.slice(0, 1);
    return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
  }
}
