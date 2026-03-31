"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    config;
    resend;
    from;
    logger = new common_1.Logger(EmailService_1.name);
    constructor(config) {
        this.config = config;
        this.resend = new resend_1.Resend(this.config.get('RESEND_API_KEY'));
        this.from = this.config.get('EMAIL_FROM', 'Spiritual California <hello@spiritualcalifornia.com>');
    }
    async send(to, subject, html) {
        try {
            const result = await this.resend.emails.send({ from: this.from, to, subject, html });
            this.logger.log(`Email sent to ${to}: ${subject}`);
            return result;
        }
        catch (err) {
            this.logger.error(`Email failed to ${to}: ${err.message}`);
            return null;
        }
    }
    async sendBookingConfirmation(to, data) {
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
    async sendOrderConfirmation(to, data) {
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
    async sendReviewRequest(to, data) {
        return this.send(to, `How was your session with ${data.guideName}?`, `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Share Your Experience</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Hi ${data.seekerName}, how was your ${data.serviceName} session with ${data.guideName}? Your feedback helps other seekers and supports practitioners.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/reviews/new/${data.bookingId}" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Write a Review</a></div>
      </div>
    `);
    }
    async sendWelcome(to, name) {
        return this.send(to, 'Welcome to Spiritual California ✦', `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">Welcome, ${name} ✦</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Your journey begins here. Explore our verified practitioners, curated products, and transformative events.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/practitioners" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Find Your Guide</a></div>
      </div>
    `);
    }
    async sendVerificationApproved(to, guideName) {
        return this.send(to, 'Your Profile is Verified! ✓', `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 24px;"><div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #E8B84B;">Spiritual California</div></div>
        <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 400; color: #3A3530; text-align: center; margin-bottom: 8px;">You're Verified ✓</h1>
        <p style="text-align: center; color: #8A8278; font-size: 14px; margin-bottom: 32px;">Congratulations ${guideName}! Your profile has been verified and is now live on Spiritual California. Seekers can find and book sessions with you.</p>
        <div style="text-align: center;"><a href="${this.config.get('FRONTEND_URL')}/guide/dashboard" style="display: inline-block; padding: 14px 32px; background: #E8B84B; color: #3A3530; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">Go to Dashboard</a></div>
      </div>
    `);
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map