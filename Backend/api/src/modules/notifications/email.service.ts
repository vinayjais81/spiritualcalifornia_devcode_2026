import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
    this.from = this.config.get('EMAIL_FROM', 'Spiritual California <hello@spiritualcalifornia.com>');
  }

  // ─── Generic send ──────────────────────────────────────────────────────────

  private async send(to: string, subject: string, html: string) {
    try {
      const result = await this.resend.emails.send({ from: this.from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return result;
    } catch (err: any) {
      this.logger.error(`Email failed to ${to}: ${err.message}`);
      return null;
    }
  }

  // ─── Booking Confirmed ─────────────────────────────────────────────────────

  async sendBookingConfirmation(to: string, data: { seekerName: string; guideName: string; serviceName: string; dateTime: string; amount: string }) {
    return this.send(to, `Booking Confirmed — ${data.serviceName}`, `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div>
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Session Confirmed ✓</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Hi ${data.seekerName}, your session has been confirmed.</p>
        <div style="background: #FAFAF7; border: 1px solid rgba(232,184,75,0.15); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(232,184,75,0.1);"><span style="color: #8A8278; font-size: 13px;">Practitioner</span><span style="color: #3A3530; font-weight: 500; font-size: 13px;">${data.guideName}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(232,184,75,0.1);"><span style="color: #8A8278; font-size: 13px;">Service</span><span style="color: #3A3530; font-weight: 500; font-size: 13px;">${data.serviceName}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(232,184,75,0.1);"><span style="color: #8A8278; font-size: 13px;">Date & Time</span><span style="color: #3A3530; font-weight: 500; font-size: 13px;">${data.dateTime}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0;"><span style="color: #8A8278; font-size: 13px;">Amount</span><span style="color: #E8B84B; font-weight: 600; font-size: 15px;">${data.amount}</span></div>
        </div>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/seeker/dashboard" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">View My Bookings</a></div>
      </div>
    `);
  }

  // ─── Order Confirmation ────────────────────────────────────────────────────

  async sendOrderConfirmation(to: string, data: { name: string; orderId: string; items: Array<{ name: string; qty: number; price: string }>; total: string; hasDigital: boolean; digitalDownloads?: Array<{ name: string; url: string }> }) {
    const itemRows = data.items.map(i => `<div style="display: flex; justify-content: space-between; padding: 6px 0;"><span style="color: #3A3530; font-size: 13px;">${i.name} ×${i.qty}</span><span style="color: #3A3530; font-weight: 500; font-size: 13px;">${i.price}</span></div>`).join('');

    // Per-item download section — only rendered when we actually have signed URLs.
    // Falls back to a generic "visit /downloads" pointer if digital items exist but URL generation failed.
    const downloadSection = (data.digitalDownloads && data.digitalDownloads.length > 0)
      ? `
        <div style="background: #FDF6E3; border: 1px solid rgba(232,184,75,0.25); border-radius: 12px; padding: 20px 22px; margin-bottom: 24px;">
          <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #E8B84B; margin-bottom: 12px; font-weight: 600;">⚡ Your Digital Downloads</div>
          ${data.digitalDownloads.map(d => `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(232,184,75,0.15);">
              <span style="color: #3A3530; font-size: 13px; flex: 1;">${d.name}</span>
              <a href="${d.url}" style="background: #3A3530; color: #E8B84B; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">Download</a>
            </div>
          `).join('')}
          <div style="margin-top: 12px; font-size: 11px; color: #8A8278; text-align: center;">Links stay valid for 7 days. After that, you can always regenerate them from your <a href="${this.config.get('FRONTEND_URL')}/downloads" style="color: #E8B84B;">Downloads library</a>.</div>
        </div>
      `
      : (data.hasDigital
        ? `<div style="background: #FDF6E3; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; text-align: center; font-size: 13px; color: #3A3530;">⚡ Your digital items are ready in your <a href="${this.config.get('FRONTEND_URL')}/downloads" style="color: #E8B84B;">Downloads library</a>.</div>`
        : '');

    return this.send(to, `Order Confirmed — #${data.orderId.slice(-8).toUpperCase()}`, `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Order Confirmed ✓</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Hi ${data.name}, thank you for your order.</p>
        <div style="background: #FAFAF7; border: 1px solid rgba(232,184,75,0.15); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          ${itemRows}
          <div style="border-top: 2px solid #E8B84B; margin-top: 12px; padding-top: 12px; display: flex; justify-content: space-between;"><span style="font-weight: 600; color: #3A3530;">Total</span><span style="font-weight: 600; color: #3A3530; font-size: 18px;">${data.total}</span></div>
        </div>
        ${downloadSection}
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/seeker/dashboard" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">View My Orders</a></div>
      </div>
    `);
  }

  // ─── Review Request (after completed session) ──────────────────────────────

  async sendReviewRequest(to: string, data: { seekerName: string; guideName: string; serviceName: string; bookingId: string }) {
    return this.send(to, `How was your session with ${data.guideName}?`, `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Share Your Experience</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Hi ${data.seekerName}, how was your ${data.serviceName} session with ${data.guideName}? Your feedback helps other seekers and supports practitioners.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/reviews/new/${data.bookingId}" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Write a Review</a></div>
      </div>
    `);
  }

  // ─── Welcome Email ─────────────────────────────────────────────────────────

  async sendWelcome(to: string, name: string) {
    return this.send(to, 'Welcome to Spiritual California ✦', `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Welcome, ${name} ✦</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Your journey begins here. Explore our verified practitioners, curated products, and transformative events.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/practitioners" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Find Your Guide</a></div>
      </div>
    `);
  }

  // ─── Verification Approved ─────────────────────────────────────────────────

  async sendVerificationApproved(to: string, guideName: string) {
    return this.send(to, 'Your Profile is Verified! ✓', `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">You're Verified ✓</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Congratulations ${guideName}! Your profile has been verified and is now live on Spiritual California. Seekers can find and book sessions with you.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/guide/dashboard" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Go to Dashboard</a></div>
      </div>
    `);
  }

  // ─── Soul Tour: shared layout helper ───────────────────────────────────────

  private tourEmailShell(opts: {
    headline: string;
    headlineEmoji?: string;
    intro: string;
    rows: Array<{ label: string; value: string; highlight?: boolean }>;
    ctaLabel: string;
    ctaUrl: string;
    bannerColor?: string;
    footerNote?: string;
  }) {
    const banner = opts.bannerColor || '#E8B84B';
    const detailRows = opts.rows
      .map(
        (r, i, arr) => `
      <div style="display: flex; justify-content: space-between; padding: 10px 0; ${
        i < arr.length - 1 ? 'border-bottom: 1px solid rgba(232,184,75,0.1);' : ''
      }">
        <span style="color: #8A8278; font-size: 13px;">${r.label}</span>
        <span style="color: ${r.highlight ? '#E8B84B' : '#3A3530'}; font-weight: ${
          r.highlight ? 600 : 500
        }; font-size: ${r.highlight ? '15px' : '13px'};">${r.value}</span>
      </div>`,
      )
      .join('');
    return `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">✦ Spiritual California Soul Travels</div>
        </div>
        <div style="height: 4px; background: ${banner}; border-radius: 2px; margin-bottom: 32px;"></div>
        <h1 style="font-family: Georgia, serif; font-size: 30px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 12px;">${
          opts.headlineEmoji ? opts.headlineEmoji + ' ' : ''
        }${opts.headline}</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; line-height: 1.6; margin-bottom: 32px;">${opts.intro}</p>
        <div style="background: #FAFAF7; border: 1px solid rgba(232,184,75,0.15); border-radius: 12px; padding: 24px; margin-bottom: 28px;">
          ${detailRows}
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${opts.ctaUrl}" style="display: inline-block; padding: 14px 32px; background: #3A3530; color: #E8B84B; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">${opts.ctaLabel}</a>
        </div>
        ${
          opts.footerNote
            ? `<p style="font-size: 11px; color: #8A8278; line-height: 1.6; text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(232,184,75,0.1);">${opts.footerNote}</p>`
            : ''
        }
        <div style="text-align: center; margin-top: 32px; font-size: 10px; color: #8A8278; letter-spacing: 0.05em;">
          Spiritual California · Find Your Guide. Begin Your Journey.
        </div>
      </div>
    `;
  }

  // ─── Tour: Deposit Confirmed ──────────────────────────────────────────────

  async sendTourDepositConfirmation(
    to: string,
    data: {
      seekerName: string;
      tourTitle: string;
      bookingReference: string;
      departureDates: string;
      location: string;
      travelers: number;
      roomType: string;
      depositPaid: string;
      balanceDue: string;
      balanceDueDate: string;
      guideName: string;
      bookingId: string;
      isPaidInFull: boolean;
    },
  ) {
    const isFull = data.isPaidInFull;
    const headline = isFull ? 'Your Spot is Confirmed!' : 'Your Spot is Reserved!';
    const intro = isFull
      ? `Hi ${data.seekerName}, your booking is fully paid and confirmed. ${data.guideName} will be in touch with prep details as your departure approaches.`
      : `Hi ${data.seekerName}, thank you for your deposit. Your spot${
          data.travelers > 1 ? 's are' : ' is'
        } secured on this journey. ${data.guideName} will be in touch with prep details as your departure approaches.`;

    const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
      { label: 'Tour', value: data.tourTitle },
      { label: 'Reference', value: data.bookingReference },
      { label: 'Departure', value: data.departureDates },
      { label: 'Location', value: data.location },
      { label: 'Travelers', value: String(data.travelers) },
      { label: 'Room', value: data.roomType },
      { label: 'Trip Leader', value: data.guideName },
    ];
    if (isFull) {
      rows.push({ label: 'Total Paid', value: data.depositPaid, highlight: true });
    } else {
      rows.push({ label: 'Deposit Paid', value: data.depositPaid, highlight: true });
      rows.push({ label: 'Balance Due', value: `${data.balanceDue} by ${data.balanceDueDate}` });
    }

    return this.send(
      to,
      `${isFull ? 'Booking Confirmed' : 'Spot Reserved'} — ${data.tourTitle}`,
      this.tourEmailShell({
        headline,
        headlineEmoji: '✓',
        intro,
        rows,
        ctaLabel: 'View My Tour',
        ctaUrl: `${this.config.get('FRONTEND_URL')}/seeker/dashboard/tours/${data.bookingId}`,
        footerNote: isFull
          ? 'Travel insurance is strongly recommended. We\'ll send a packing list and pre-departure briefing soon.'
          : `Your remaining balance of ${data.balanceDue} is due by ${data.balanceDueDate}. We\'ll send reminders as that date approaches.`,
      }),
    );
  }

  // ─── Tour: Balance Paid ────────────────────────────────────────────────────

  async sendTourBalancePaid(
    to: string,
    data: {
      seekerName: string;
      tourTitle: string;
      bookingReference: string;
      departureDates: string;
      totalPaid: string;
      bookingId: string;
    },
  ) {
    return this.send(
      to,
      `Balance Paid in Full — ${data.tourTitle}`,
      this.tourEmailShell({
        headline: 'Balance Paid in Full',
        headlineEmoji: '✓',
        intro: `Hi ${data.seekerName}, thank you! Your booking is now fully paid. We'll be in touch with pre-departure briefing materials and packing list as your trip approaches.`,
        rows: [
          { label: 'Tour', value: data.tourTitle },
          { label: 'Reference', value: data.bookingReference },
          { label: 'Departure', value: data.departureDates },
          { label: 'Total Paid', value: data.totalPaid, highlight: true },
        ],
        ctaLabel: 'View My Tour',
        ctaUrl: `${this.config.get('FRONTEND_URL')}/seeker/dashboard/tours/${data.bookingId}`,
        bannerColor: '#5A8A6A',
      }),
    );
  }

  // ─── Tour: Balance Reminder ────────────────────────────────────────────────

  async sendTourBalanceReminder(
    to: string,
    data: {
      seekerName: string;
      tourTitle: string;
      bookingReference: string;
      departureDates: string;
      balanceDue: string;
      balanceDueDate: string;
      daysUntilDue: number;
      bookingId: string;
    },
  ) {
    const urgent = data.daysUntilDue <= 3;
    const headline =
      data.daysUntilDue <= 1
        ? 'Final Balance Reminder'
        : data.daysUntilDue <= 7
          ? `Balance Due in ${data.daysUntilDue} Days`
          : `Balance Due in ${data.daysUntilDue} Days`;

    return this.send(
      to,
      `${urgent ? '⚠️ ' : ''}Balance reminder — ${data.tourTitle}`,
      this.tourEmailShell({
        headline,
        headlineEmoji: '💳',
        intro: `Hi ${data.seekerName}, this is a friendly reminder that the remaining balance for your spot on <strong>${data.tourTitle}</strong> is due by <strong>${data.balanceDueDate}</strong>. Please complete your payment to keep your spot secured.`,
        rows: [
          { label: 'Tour', value: data.tourTitle },
          { label: 'Reference', value: data.bookingReference },
          { label: 'Departure', value: data.departureDates },
          { label: 'Balance Due', value: data.balanceDue, highlight: true },
          { label: 'Due By', value: data.balanceDueDate },
        ],
        ctaLabel: 'Pay Balance Now',
        ctaUrl: `${this.config.get('FRONTEND_URL')}/seeker/dashboard/tours/${data.bookingId}/pay-balance`,
        bannerColor: urgent ? '#C0392B' : '#E8B84B',
        footerNote: urgent
          ? 'If your balance is not paid by the due date, your spot may be released.'
          : 'You can pay your balance any time before the due date from your booking page.',
      }),
    );
  }

  // ─── Tour: Departure Reminder ──────────────────────────────────────────────

  async sendTourDepartureReminder(
    to: string,
    data: {
      seekerName: string;
      tourTitle: string;
      bookingReference: string;
      departureDates: string;
      meetingPoint: string;
      daysUntilDeparture: number;
      bookingId: string;
    },
  ) {
    const headline =
      data.daysUntilDeparture <= 1
        ? 'Your Journey Begins Tomorrow!'
        : `Your Journey Begins in ${data.daysUntilDeparture} Days`;

    return this.send(
      to,
      `${headline} — ${data.tourTitle}`,
      this.tourEmailShell({
        headline,
        headlineEmoji: '🌍',
        intro: `Hi ${data.seekerName}, your spiritual journey is just around the corner. Here's a reminder of your trip details. Safe travels!`,
        rows: [
          { label: 'Tour', value: data.tourTitle },
          { label: 'Reference', value: data.bookingReference },
          { label: 'Departure', value: data.departureDates, highlight: true },
          { label: 'Meeting Point', value: data.meetingPoint },
        ],
        ctaLabel: 'View Trip Details',
        ctaUrl: `${this.config.get('FRONTEND_URL')}/seeker/dashboard/tours/${data.bookingId}`,
        bannerColor: '#5A8A6A',
        footerNote:
          'Don\'t forget your passport, travel insurance, and any prescription medications. Reach out to your trip leader if you have any last-minute questions.',
      }),
    );
  }

  // ─── Tour: Cancellation ────────────────────────────────────────────────────

  async sendTourCancellation(
    to: string,
    data: {
      seekerName: string;
      tourTitle: string;
      bookingReference: string;
      refundAmount: string;
      refundTier: 'FULL' | 'HALF' | 'NONE';
      cancellationReason: string | null;
    },
  ) {
    const refundLabel =
      data.refundTier === 'FULL'
        ? 'Full Refund'
        : data.refundTier === 'HALF'
          ? '50% Refund'
          : 'No Refund';

    const rows: Array<{ label: string; value: string; highlight?: boolean }> = [
      { label: 'Tour', value: data.tourTitle },
      { label: 'Reference', value: data.bookingReference },
      { label: 'Cancellation Status', value: refundLabel },
    ];
    if (data.refundTier !== 'NONE') {
      rows.push({ label: 'Refund Amount', value: data.refundAmount, highlight: true });
    }
    if (data.cancellationReason) {
      rows.push({ label: 'Reason', value: data.cancellationReason });
    }

    return this.send(
      to,
      `Booking Cancelled — ${data.tourTitle}`,
      this.tourEmailShell({
        headline: 'Your Booking Has Been Cancelled',
        intro: `Hi ${data.seekerName}, your booking has been cancelled per your request. ${
          data.refundTier !== 'NONE'
            ? `A refund of <strong>${data.refundAmount}</strong> will be processed within 5–10 business days, returned to your original payment method.`
            : 'Per the tour\'s cancellation policy, no refund is available for this cancellation. We hope you\'ll join us on a future journey.'
        }`,
        rows,
        ctaLabel: 'Browse Other Tours',
        ctaUrl: `${this.config.get('FRONTEND_URL')}/travels`,
        bannerColor: '#C0392B',
        footerNote: 'If you believe this cancellation was made in error, please contact support@spiritualcalifornia.com immediately.',
      }),
    );
  }
}
