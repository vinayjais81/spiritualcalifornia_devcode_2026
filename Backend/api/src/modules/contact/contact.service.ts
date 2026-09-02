import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { detectBot, RELOAD_MESSAGE } from '../../common/bot-signals';
import { Resend } from 'resend';

export interface SubmitContactDto {
  name: string;
  email: string;
  phone?: string;
  type: string;
  subject: string;
  message: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getLeads(params: { page: number; limit: number; status?: string; type?: string }) {
    const { page, limit, status, type } = params;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    if (type) where['type'] = type;

    const [leads, total] = await Promise.all([
      this.prisma.contactLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contactLead.count({ where }),
    ]);

    const counts = await this.prisma.contactLead.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count.status]));

    return { leads, total, page, totalPages: Math.ceil(total / limit), statusCounts };
  }

  async updateLeadStatus(id: string, status: string) {
    return this.prisma.contactLead.update({
      where: { id },
      data: { status },
    });
  }

  async submitLead(dto: SubmitContactDto, clientIp?: string) {
    const verdict = detectBot({
      honeypot: (dto as any).contactReference,
      elapsedMs: (dto as any).elapsedMs,
    });

    if (verdict.action === 'drop') {
      // Answer exactly as a real submission would. A bot that receives an error
      // learns which field betrayed it and adapts; one that receives success
      // keeps posting into a void. Nothing is stored and no email is sent.
      this.logger.warn(
        `Contact submission dropped as automated (${verdict.reason}) — ip: ${clientIp ?? 'unknown'}, claimed email: ${dto.email}`,
      );
      return { success: true, id: null };
    }

    if (verdict.action === 'reject') {
      // The one verdict that can legitimately reach a person (a stale browser
      // tab), so it gets a visible, actionable error instead of a silent drop.
      this.logger.warn(
        `Contact submission rejected (${verdict.reason}) — ip: ${clientIp ?? 'unknown'}, claimed email: ${dto.email}`,
      );
      throw new BadRequestException(RELOAD_MESSAGE);
    }

    // 1. Persist lead
    const lead = await this.prisma.contactLead.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        type: dto.type,
        subject: dto.subject,
        message: dto.message,
      },
    });

    // The IP is logged rather than stored: no column exists for it, and during
    // the 2026-09-02 abuse there was no way to tell a single attacker from a
    // botnet — which is exactly the fact that decides whether an IP-based block
    // can work at all. A log line needs no migration and is enough to answer it.
    this.logger.log(
      `New contact lead #${lead.id} from ${dto.email} — type: ${dto.type} — ip: ${clientIp ?? 'unknown'}`,
    );

    // 2. Send emails — fire and forget, never block response.
    // A suspiciously fast submission is still recorded and still reaches
    // support, but never triggers the auto-reply: timing is too weak a signal
    // to justify discarding a genuine message, and strong enough to justify not
    // mailing a stranger on its say-so.
    if (verdict.action === 'flag') {
      this.logger.warn(
        `Contact lead #${lead.id} flagged (${verdict.reason}) — saved, support notified, no auto-reply`,
      );
      void this.sendEmails(lead.id, dto, { skipConfirmation: true });
    } else {
      void this.sendEmails(lead.id, dto);
    }

    return { success: true, id: lead.id };
  }

  /**
   * Whether it is safe to send the "we received your message" auto-reply.
   *
   * A per-IP throttle caps one attacker; it does nothing about a distributed
   * one, and the damage here is not load — it is that our sending domain mails
   * strangers who never asked. Enough of those and the domain is scored for
   * spam, which for an unwarmed pre-launch domain is close to unrecoverable.
   *
   * Two independent brakes, both read from data we already store:
   *
   *  - PER ADDRESS. A real person submits the form once and gets one reply. A
   *    second submission inside a day gets logged and served, but not mailed —
   *    so the same address cannot be used to bombard someone's inbox.
   *  - SITE WIDE. If submissions across the whole site exceed a rate no
   *    genuine marketplace produces, stop auto-replying entirely until it
   *    subsides. Normal volume before the abuse began was one or two a DAY.
   *
   * Modelled on the InviteSenderService circuit breaker, for the same reason:
   * the cost of pausing is a missing courtesy email, and the cost of not
   * pausing is the domain.
   */
  /**
   * Measured against the real attack: the per-IP throttle was confirmed
   * enforcing (5 pass, the 6th gets a 429) while submissions carried on at
   * ~19/hour, which proves a distributed source no per-IP rule can stop. That
   * makes this cap the load-bearing defence, and 20 sat right on top of the
   * attack's own rate — the breaker flapped open and shut, leaking auto-replies
   * on every dip.
   *
   * 8/hour is still roughly a hundred times the genuine baseline of one or two
   * a DAY, and being wrong costs a courtesy email while support is notified
   * either way. Raise it only against measured legitimate volume.
   */
  private static readonly CONFIRMATION_HOURLY_CAP = 8;

  private async confirmationIsSafe(email: string): Promise<boolean> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [fromThisAddress, siteWide] = await Promise.all([
      this.prisma.contactLead.count({
        where: { email, createdAt: { gte: dayAgo } },
      }),
      this.prisma.contactLead.count({ where: { createdAt: { gte: hourAgo } } }),
    ]);

    // The lead for this submission is already persisted, so 1 means "this one".
    if (fromThisAddress > 1) {
      this.logger.warn(
        `Auto-reply suppressed: ${email} has submitted ${fromThisAddress} times in 24h`,
      );
      return false;
    }
    if (siteWide > ContactService.CONFIRMATION_HOURLY_CAP) {
      this.logger.error(
        `Auto-reply circuit breaker OPEN: ${siteWide} contact submissions in the last hour ` +
          `(cap ${ContactService.CONFIRMATION_HOURLY_CAP}). Support notifications still sending.`,
      );
      return false;
    }
    return true;
  }

  private async sendEmails(
    leadId: string,
    dto: SubmitContactDto,
    opts: { skipConfirmation?: boolean } = {},
  ) {
    const resendKey   = this.config.get<string>('RESEND_API_KEY', '');
    const fromEmail   = this.config.get<string>('EMAIL_FROM', 'noreply@spiritualcalifornia.com');
    const supportEmail = this.config.get<string>('SUPPORT_EMAIL', 'support@spiritualcalifornia.com');

    if (!resendKey || resendKey.includes('placeholder')) {
      this.logger.warn(`[DEV] Contact lead received — id=${leadId}, from=${dto.email}, type=${dto.type}`);
      return;
    }

    const resend = new Resend(resendKey);

    // Customer confirmation
    const confirmationHtml = this.buildConfirmationEmail(dto.name);

    // Support notification
    const notificationHtml = this.buildNotificationEmail(dto);

    // The confirmation goes to an address the CALLER supplied and nobody has
    // verified, so it is the half that can be aimed at strangers. The support
    // notification goes to our own inbox and carries no such risk — it is sent
    // unconditionally, so abuse stays visible rather than silently dropped.
    const confirmToSender =
      !opts.skipConfirmation && (await this.confirmationIsSafe(dto.email));

    try {
      await Promise.race([
        Promise.all([
          ...(confirmToSender
            ? [
                resend.emails.send({
                  from: `Spiritual California <${fromEmail}>`,
                  to: dto.email,
                  subject: 'We received your message — Spiritual California',
                  html: confirmationHtml,
                }),
              ]
            : []),
          resend.emails.send({
            from: `Spiritual California <${fromEmail}>`,
            to: supportEmail,
            subject: `[Contact Lead] ${dto.type} — ${dto.name}`,
            html: notificationHtml,
          }),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Resend timeout')), 10_000),
        ),
      ]);
      this.logger.log(`Contact emails sent for lead #${leadId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send contact emails for lead #${leadId}: ${err?.message}`);
    }
  }

  private buildConfirmationEmail(name: string): string {
    return `
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
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E8B84B;">Message Received</p>
                <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:400;color:#3A3530;line-height:1.2;">
                  Thank you,<br/><em style="color:#E8B84B;font-style:italic;">${name}</em>
                </h1>
                <p style="margin:0 0 20px;font-size:14px;color:#8A8278;line-height:1.7;">
                  We've received your message and a member of our team will be in touch within <strong style="color:#3A3530;">24–48 hours</strong>.
                </p>
                <p style="margin:0 0 28px;font-size:14px;color:#8A8278;line-height:1.7;">
                  In the meantime, feel free to explore our community of verified wellness practitioners, upcoming events, and curated products.
                </p>
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:#3A3530;border-radius:8px;">
                      <a href="https://spiritualcalifornia.com" style="display:inline-block;padding:14px 32px;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
                        Explore the Platform →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 28px;border-top:1px solid rgba(232,184,75,0.12);">
                <p style="margin:0;font-size:12px;color:#C4BDB5;line-height:1.6;">
                  You're receiving this because you submitted a message through our contact form. If this wasn't you, please disregard this email.
                </p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    `;
  }

  private buildNotificationEmail(dto: SubmitContactDto): string {
    const typeLabels: Record<string, string> = {
      general: 'General Inquiry',
      guide: 'Become a Guide',
      partnership: 'Partnership Opportunity',
      support: 'Technical Support',
      media: 'Media & Press',
      feedback: 'Feedback',
    };
    const typeLabel = typeLabels[dto.type] ?? dto.type;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"/></head>
    <body style="margin:0;padding:0;background:#F5F5F5;font-family:'Inter',sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;border:1px solid #E5E5E5;overflow:hidden;">
            <tr>
              <td style="background:#3A3530;padding:20px 32px;">
                <p style="margin:0;font-size:13px;color:#E8B84B;letter-spacing:0.1em;text-transform:uppercase;">New Contact Lead — Spiritual California</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Type</span><br/>
                      <span style="font-size:14px;color:#3A3530;font-weight:600;">${typeLabel}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Name</span><br/>
                      <span style="font-size:14px;color:#3A3530;">${dto.name}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Email</span><br/>
                      <a href="mailto:${dto.email}" style="font-size:14px;color:#E8B84B;text-decoration:none;">${dto.email}</a>
                    </td>
                  </tr>
                  ${dto.phone ? `
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Phone</span><br/>
                      <span style="font-size:14px;color:#3A3530;">${dto.phone}</span>
                    </td>
                  </tr>` : ''}
                  <tr>
                    <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Subject</span><br/>
                      <span style="font-size:14px;color:#3A3530;">${dto.subject}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;">
                      <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;">Message</span><br/>
                      <p style="margin:8px 0 0;font-size:14px;color:#3A3530;line-height:1.7;white-space:pre-wrap;">${dto.message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#FAFAF7;padding:16px 32px;">
                <p style="margin:0;font-size:12px;color:#999;">Reply directly to <strong>${dto.email}</strong> to respond to this lead.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
    `;
  }
}
