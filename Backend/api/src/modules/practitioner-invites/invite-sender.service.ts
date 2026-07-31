import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  EmailSendStatus,
  InviteSendState,
  OnboardingPath,
  SuppressionReason,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PractitionerImportService } from '../practitioner-import/practitioner-import.service';
import { PractitionerInvitesService } from './practitioner-invites.service';
import {
  inviteEmailHtml,
  inviteEmailSubject,
  inviteEmailText,
} from './invite-email.template';

export const INVITE_PURPOSE = 'practitioner-invite';

/**
 * Deliverability circuit breaker. A pause button nobody is watching at 2am is
 * not a safety mechanism, so the queue polices itself.
 *
 * Both thresholds are industry-standard, and both mean the same thing: stop
 * before the sending domain is scored on this. A tripped breaker needs a human
 * to clear it, because "too many bounces" is a statement about the list, not a
 * transient error worth retrying.
 */
const BREAKER_WINDOW = 50;
const MAX_BOUNCE_RATE = 0.05; // 5%
const MAX_COMPLAINT_RATE = 0.001; // 0.1% — one in a thousand

/** Addresses that reach a front desk, not a practitioner. Sent last, after reputation exists. */
const ROLE_INBOX_RE = /^(info|contact|admin|hello|office|frontdesk|front-desk|team|support|appointments|booking|bookings|inquiries|enquiries)@/i;

export type SendSegment = 'personal' | 'role-inbox' | 'all';

export interface SendOutcome {
  status: EmailSendStatus;
  reason?: string;
}

@Injectable()
export class InviteSenderService {
  private readonly logger = new Logger(InviteSenderService.name);
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly imports: PractitionerImportService,
    private readonly invites: PractitionerInvitesService,
  ) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
  }

  // ─── Mode ──────────────────────────────────────────────────────────────────

  /**
   * `redirect` (the default) diverts every invite to a single test address.
   *
   * The default is deliberate: going live has to be an explicit act on the
   * production environment, so a config nobody remembered to set can never mail
   * 136 real practitioners.
   */
  get isLive(): boolean {
    return this.config.get<string>('INVITE_EMAIL_MODE', 'redirect') === 'live';
  }

  private get redirectTo(): string {
    return this.config.get<string>('INVITE_EMAIL_REDIRECT_TO', 'vinay.jaiswal@nityo.com');
  }

  private get dailyCap(): number {
    const raw = Number(this.config.get<string>('INVITE_SEND_PER_DAY', '40'));
    return Number.isFinite(raw) && raw > 0 ? raw : 40;
  }

  // ─── Queueing a wave ───────────────────────────────────────────────────────

  /**
   * Work out who is eligible in a batch and write a QUEUED row for each.
   *
   * Eligibility is checked here *and* again in the worker immediately before
   * sending. The gap between queueing a wave and the last job draining is days,
   * and in that time someone can unsubscribe, claim their account, or be
   * deleted — all of which must stop the email.
   */
  async queueBatch(
    adminUserId: string,
    batchId: string,
    segment: SendSegment = 'personal',
  ): Promise<{ queued: number; skipped: number; reasons: Record<string, number> }> {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Import batch not found');
    if (batch.inviteState === InviteSendState.PAUSED) {
      throw new BadRequestException(
        `This wave is paused (${batch.invitePauseReason ?? 'paused by an admin'}). Resume it before queueing more.`,
      );
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        guideProfile: { importBatchId: batchId, onboardingPath: OnboardingPath.PROACTIVE_INVITE },
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isActive: true,
        marketingEmails: true,
        emailSends: {
          where: { purpose: INVITE_PURPOSE, status: { not: EmailSendStatus.FAILED } },
          select: { id: true },
          take: 1,
        },
      },
    });

    const reasons: Record<string, number> = {};
    const note = (key: string) => {
      reasons[key] = (reasons[key] ?? 0) + 1;
    };

    const eligible: Array<{ id: string; email: string }> = [];
    for (const user of candidates) {
      if (user.passwordHash) { note('already-claimed'); continue; }
      if (!user.isActive) { note('inactive'); continue; }
      if (!user.marketingEmails) { note('opted-out'); continue; }
      if (user.emailSends.length > 0) { note('already-sent'); continue; }
      if (segment === 'personal' && ROLE_INBOX_RE.test(user.email)) { note('role-inbox-deferred'); continue; }
      if (segment === 'role-inbox' && !ROLE_INBOX_RE.test(user.email)) { note('not-a-role-inbox'); continue; }
      if (await this.imports.isSuppressed(user.email)) { note('suppressed'); continue; }
      eligible.push({ id: user.id, email: user.email });
    }

    if (eligible.length > 0) {
      await this.prisma.emailSend.createMany({
        data: eligible.map((u) => ({
          purpose: INVITE_PURPOSE,
          userId: u.id,
          importBatchId: batchId,
          emailHash: this.imports.hashEmail(u.email),
          status: EmailSendStatus.QUEUED,
        })),
      });
      await this.prisma.importBatch.update({
        where: { id: batchId },
        data: { inviteState: InviteSendState.SENDING },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerInvite.queueWave',
        entity: 'ImportBatch',
        entityId: batchId,
        newValue: {
          segment,
          queued: eligible.length,
          skipped: candidates.length - eligible.length,
          reasons,
          mode: this.isLive ? 'live' : 'redirect',
        },
      },
    });

    this.logger.log(
      `Queued ${eligible.length} invite(s) for batch ${batchId} (segment=${segment}, mode=${this.isLive ? 'LIVE' : 'redirect'})`,
    );
    return { queued: eligible.length, skipped: candidates.length - eligible.length, reasons };
  }

  // ─── Sending one ───────────────────────────────────────────────────────────

  /**
   * Send a single queued invite. Called by the worker, one job per recipient,
   * so a failure retries that person rather than a batch.
   */
  async sendOne(emailSendId: string): Promise<SendOutcome> {
    const record = await this.prisma.emailSend.findUnique({
      where: { id: emailSendId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            passwordHash: true,
            isActive: true,
            marketingEmails: true,
            guideProfile: {
              select: { onboardingPath: true, city: true, modalities: true, importBatchId: true },
            },
          },
        },
        batch: { select: { id: true, inviteState: true, sourceLabel: true } },
      },
    });

    if (!record) return { status: EmailSendStatus.SKIPPED, reason: 'send record vanished' };
    if (record.status !== EmailSendStatus.QUEUED) {
      return { status: record.status, reason: 'already processed' };
    }

    // Re-run every eligibility check. Days can pass between queueing and
    // sending; anything that changed in that window must stop the email.
    const skip = await this.disqualify(record.user, record.batch?.inviteState);
    if (skip) return this.markSkipped(record.id, skip);

    const user = record.user!;
    const { token } = await this.invites.issueClaimToken(user.id);

    const data = {
      firstName: user.firstName,
      modality: user.guideProfile?.modalities?.[0] ?? null,
      city: user.guideProfile?.city ?? null,
      sourceDescription: this.sourceDescription(record.batch?.sourceLabel),
      claimUrl: this.invites.buildClaimUrl(token),
      unsubscribeUrl: this.invites.buildUnsubscribeUrl(user.id),
      commissionPercent: await this.commissionPercent(),
      senderName: this.config.get<string>('INVITE_SENDER_NAME', 'Lana Rafaella'),
      replyTo: this.config.get<string>('INVITE_REPLY_TO', 'hello@spiritualcalifornia.com'),
      postalAddress: this.config.get<string>(
        'INVITE_POSTAL_ADDRESS',
        'Spiritual California Inc., 631 E El Camino Real, Sunnyvale, CA 94087',
      ),
      redirectNotice: this.isLive ? null : user.email,
    };

    const recipient = this.isLive ? user.email : this.redirectTo;

    try {
      const result = await this.resend.emails.send({
        from: this.config.get<string>(
          'INVITE_EMAIL_FROM',
          'Lana Rafaella <hello@spiritualcalifornia.com>',
        ),
        replyTo: data.replyTo,
        to: recipient,
        subject: inviteEmailSubject(data),
        html: inviteEmailHtml(data),
        text: inviteEmailText(data),
        headers: {
          // One-click unsubscribe. Gmail and Outlook surface this natively, and
          // a recipient who uses it never files a spam complaint instead.
          'List-Unsubscribe': `<${data.unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      if (result.error) throw new Error(result.error.message ?? 'Resend rejected the message');

      await this.prisma.emailSend.update({
        where: { id: record.id },
        data: {
          status: EmailSendStatus.SENT,
          providerMessageId: result.data?.id ?? null,
          sentAt: new Date(),
          redirected: !this.isLive,
        },
      });
      await this.prisma.user.update({
        where: { id: user.id },
        data: { invitedAt: new Date() },
      });

      return { status: EmailSendStatus.SENT };
    } catch (err: any) {
      const message = err?.message ?? 'Unknown send error';
      await this.prisma.emailSend.update({
        where: { id: record.id },
        data: { status: EmailSendStatus.FAILED, error: message.slice(0, 500) },
      });
      this.logger.error(`Invite send failed (${record.id}): ${message}`);
      return { status: EmailSendStatus.FAILED, reason: message };
    }
  }

  /** Returns a reason string when this recipient must not be emailed. */
  private async disqualify(
    user: {
      email: string;
      passwordHash: string | null;
      isActive: boolean;
      marketingEmails: boolean;
      guideProfile: { onboardingPath: OnboardingPath } | null;
    } | null,
    batchState?: InviteSendState,
  ): Promise<string | null> {
    if (!user) return 'account no longer exists';
    if (batchState === InviteSendState.PAUSED) return 'wave paused';
    if (user.passwordHash) return 'already claimed';
    if (!user.isActive) return 'account deactivated';
    if (!user.marketingEmails) return 'opted out';
    if (user.guideProfile?.onboardingPath !== OnboardingPath.PROACTIVE_INVITE) {
      return 'not an invited account';
    }
    if (await this.imports.isSuppressed(user.email)) return 'address suppressed';
    return null;
  }

  private async markSkipped(id: string, reason: string): Promise<SendOutcome> {
    await this.prisma.emailSend.update({
      where: { id },
      data: { status: EmailSendStatus.SKIPPED, error: reason },
    });
    return { status: EmailSendStatus.SKIPPED, reason };
  }

  // ─── Throttling ────────────────────────────────────────────────────────────

  /**
   * How many more may go out right now. The worker asks before every send
   * rather than trusting a queue-level rate limit, because the cap has to hold
   * across restarts and across batches — the sending domain doesn't care which
   * wave the mail came from.
   */
  async remainingToday(): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sent = await this.prisma.emailSend.count({
      where: { purpose: INVITE_PURPOSE, sentAt: { gte: since }, redirected: false },
    });
    return Math.max(0, this.dailyCap - sent);
  }

  /**
   * Weekday business hours, Pacific. Mail arriving at 03:00 reads as bulk to
   * filters and to people. Redirect mode ignores the window — test sends should
   * happen when the developer presses the button.
   */
  isWithinSendWindow(now = new Date()): boolean {
    if (!this.isLive) return true;
    const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const day = pacific.getDay();
    const hour = pacific.getHours();
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }

  // ─── Circuit breaker ───────────────────────────────────────────────────────

  /**
   * Evaluate the last N real sends for a batch and pause it if the list or the
   * copy is doing damage. Called after every send and every inbound webhook.
   */
  async evaluateCircuitBreaker(batchId: string): Promise<{ paused: boolean; reason?: string }> {
    const recent = await this.prisma.emailSend.findMany({
      where: {
        importBatchId: batchId,
        purpose: INVITE_PURPOSE,
        redirected: false,
        sentAt: { not: null },
      },
      orderBy: { sentAt: 'desc' },
      take: BREAKER_WINDOW,
      select: { status: true },
    });

    // Too small a sample turns one bad address into a 100% bounce rate.
    if (recent.length < 10) return { paused: false };

    const bounced = recent.filter((r) => r.status === EmailSendStatus.BOUNCED).length;
    const complained = recent.filter((r) => r.status === EmailSendStatus.COMPLAINED).length;
    const bounceRate = bounced / recent.length;
    const complaintRate = complained / recent.length;

    let reason: string | null = null;
    if (bounceRate > MAX_BOUNCE_RATE) {
      reason = `Hard bounces at ${(bounceRate * 100).toFixed(1)}% over the last ${recent.length} sends (limit ${MAX_BOUNCE_RATE * 100}%). The address quality is bad — stop before the domain is scored on it.`;
    } else if (complaintRate > MAX_COMPLAINT_RATE) {
      reason = `Spam complaints at ${(complaintRate * 100).toFixed(2)}% over the last ${recent.length} sends (limit ${MAX_COMPLAINT_RATE * 100}%). The copy or the targeting is wrong — do not push through.`;
    }

    if (!reason) return { paused: false };

    await this.pause(batchId, reason, null);
    this.logger.error(`Circuit breaker tripped for batch ${batchId}: ${reason}`);
    return { paused: true, reason };
  }

  async pause(batchId: string, reason: string, adminUserId: string | null) {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        inviteState: InviteSendState.PAUSED,
        invitePausedAt: new Date(),
        invitePauseReason: reason,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId ?? undefined,
        action: adminUserId
          ? 'admin.practitionerInvite.pause'
          : 'practitionerInvite.circuitBreakerPause',
        entity: 'ImportBatch',
        entityId: batchId,
        newValue: { reason },
      },
    });
  }

  async resume(batchId: string, adminUserId: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Import batch not found');

    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        inviteState: InviteSendState.SENDING,
        invitePausedAt: null,
        invitePauseReason: null,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'admin.practitionerInvite.resume',
        entity: 'ImportBatch',
        entityId: batchId,
        oldValue: { pauseReason: batch.invitePauseReason },
      },
    });
    return { resumed: true };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async batchSendStats(batchId: string) {
    const [byStatus, batch, claimed] = await Promise.all([
      this.prisma.emailSend.groupBy({
        by: ['status'],
        where: { importBatchId: batchId, purpose: INVITE_PURPOSE },
        _count: { _all: true },
      }),
      this.prisma.importBatch.findUnique({
        where: { id: batchId },
        select: { inviteState: true, invitePausedAt: true, invitePauseReason: true },
      }),
      this.prisma.user.count({
        where: {
          guideProfile: { importBatchId: batchId },
          inviteClaimedAt: { not: null },
        },
      }),
    ]);

    return {
      mode: this.isLive ? 'live' : 'redirect',
      remainingToday: await this.remainingToday(),
      withinSendWindow: this.isWithinSendWindow(),
      inviteState: batch?.inviteState ?? InviteSendState.IDLE,
      pausedAt: batch?.invitePausedAt ?? null,
      pauseReason: batch?.invitePauseReason ?? null,
      counts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      claimed,
    };
  }

  // ─── Inbound webhook ───────────────────────────────────────────────────────

  /**
   * Apply a Resend delivery event. Bounces and complaints also suppress the
   * address — a bounced invite must never be retried on the next import, and a
   * complaint is the clearest "do not contact" signal there is.
   */
  async applyDeliveryEvent(event: {
    type: string;
    messageId?: string | null;
  }): Promise<{ applied: boolean }> {
    if (!event.messageId) return { applied: false };

    const record = await this.prisma.emailSend.findFirst({
      where: { providerMessageId: event.messageId },
    });
    if (!record) return { applied: false };

    const now = new Date();
    const patch: Record<string, unknown> = {};
    let suppressionReason: SuppressionReason | null = null;

    switch (event.type) {
      case 'email.delivered':
        patch.status = EmailSendStatus.DELIVERED;
        patch.deliveredAt = now;
        break;
      case 'email.bounced':
        patch.status = EmailSendStatus.BOUNCED;
        patch.bouncedAt = now;
        suppressionReason = SuppressionReason.BOUNCED;
        break;
      case 'email.complained':
        patch.status = EmailSendStatus.COMPLAINED;
        patch.complainedAt = now;
        suppressionReason = SuppressionReason.COMPLAINED;
        break;
      case 'email.opened':
        patch.openedAt = record.openedAt ?? now;
        break;
      default:
        return { applied: false };
    }

    await this.prisma.emailSend.update({ where: { id: record.id }, data: patch });

    if (suppressionReason) {
      // We hold the hash, not the address — which is exactly what the
      // suppression table is keyed on, so no lookup of personal data is needed.
      await this.prisma.emailSuppression.upsert({
        where: { emailHash: record.emailHash },
        update: { reason: suppressionReason },
        create: {
          emailHash: record.emailHash,
          reason: suppressionReason,
          note: `Resend reported ${event.type}`,
        },
      });
      if (record.userId) {
        await this.prisma.user.update({
          where: { id: record.userId },
          data: { marketingEmails: false },
        });
      }
    }

    if (record.importBatchId && suppressionReason) {
      await this.evaluateCircuitBreaker(record.importBatchId);
    }

    return { applied: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * The commission figure comes from the live rate rows the ledger charges
   * against, never a literal — the guide dashboard already shipped that mistake
   * once (docs/commission-display-truth.md).
   */
  private async commissionPercent(): Promise<number> {
    const row = await this.prisma.commissionRate.findFirst({
      where: {
        category: 'SERVICE',
        guideId: null,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      select: { percent: true },
    });
    return row
      ? Number(row.percent)
      : Number(this.config.get<string>('STRIPE_PLATFORM_COMMISSION_PERCENT', '20'));
  }

  private sourceDescription(sourceLabel?: string | null): string {
    return this.config.get<string>(
      'INVITE_SOURCE_DESCRIPTION',
      'in a public Bay Area practitioner directory',
    ) || (sourceLabel ?? 'in a public directory');
  }
}
