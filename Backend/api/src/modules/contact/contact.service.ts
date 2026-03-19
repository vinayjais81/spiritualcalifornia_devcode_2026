import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
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

  async submitLead(dto: SubmitContactDto) {
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

    this.logger.log(`New contact lead #${lead.id} from ${dto.email} — type: ${dto.type}`);

    // 2. Send emails — fire and forget, never block response
    void this.sendEmails(lead.id, dto);

    return { success: true, id: lead.id };
  }

  private async sendEmails(leadId: string, dto: SubmitContactDto) {
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

    try {
      await Promise.race([
        Promise.all([
          resend.emails.send({
            from: `Spiritual California <${fromEmail}>`,
            to: dto.email,
            subject: 'We received your message — Spiritual California',
            html: confirmationHtml,
          }),
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
