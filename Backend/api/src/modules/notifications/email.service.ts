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

  async sendOrderConfirmation(to: string, data: { name: string; orderId: string; items: Array<{ name: string; qty: number; price: string }>; total: string; hasDigital: boolean }) {
    const itemRows = data.items.map(i => `<div style="display: flex; justify-content: space-between; padding: 6px 0;"><span style="color: #3A3530; font-size: 13px;">${i.name} ×${i.qty}</span><span style="color: #3A3530; font-weight: 500; font-size: 13px;">${i.price}</span></div>`).join('');
    return this.send(to, `Order Confirmed — #${data.orderId.slice(-8).toUpperCase()}`, `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Order Confirmed ✓</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Hi ${data.name}, thank you for your order.</p>
        <div style="background: #FAFAF7; border: 1px solid rgba(232,184,75,0.15); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          ${itemRows}
          <div style="border-top: 2px solid #E8B84B; margin-top: 12px; padding-top: 12px; display: flex; justify-content: space-between;"><span style="font-weight: 600; color: #3A3530;">Total</span><span style="font-weight: 600; color: #3A3530; font-size: 18px;">${data.total}</span></div>
        </div>
        ${data.hasDigital ? '<div style="background: #FDF6E3; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; text-align: center; font-size: 13px; color: #3A3530;">⚡ Your digital items are available for <a href="' + this.config.get('FRONTEND_URL') + '/downloads" style="color: #E8B84B;">instant download</a>.</div>' : ''}
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
}
