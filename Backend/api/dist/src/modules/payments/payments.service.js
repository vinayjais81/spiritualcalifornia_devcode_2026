"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma.service");
const stripe_service_1 = require("./stripe.service");
const notifications_service_1 = require("../notifications/notifications.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    prisma;
    stripeService;
    config;
    notifications;
    logger = new common_1.Logger(PaymentsService_1.name);
    commissionPercent;
    constructor(prisma, stripeService, config, notifications) {
        this.prisma = prisma;
        this.stripeService = stripeService;
        this.config = config;
        this.notifications = notifications;
        this.commissionPercent = Number(this.config.get('STRIPE_PLATFORM_COMMISSION_PERCENT', '15'));
    }
    async resolveGuideStripeAccount(data) {
        let guideId;
        if (data.bookingId) {
            const booking = await this.prisma.booking.findUnique({
                where: { id: data.bookingId },
                include: { service: { select: { guideId: true } } },
            });
            guideId = booking?.service.guideId;
        }
        else if (data.tourBookingId) {
            const tourBooking = await this.prisma.tourBooking.findUnique({
                where: { id: data.tourBookingId },
                include: { tour: { select: { guideId: true } } },
            });
            guideId = tourBooking?.tour.guideId;
        }
        if (!guideId)
            return undefined;
        const guide = await this.prisma.guideProfile.findUnique({
            where: { id: guideId },
            select: { stripeAccountId: true, stripeOnboardingDone: true },
        });
        return guide?.stripeAccountId && guide?.stripeOnboardingDone
            ? guide.stripeAccountId
            : undefined;
    }
    async createPaymentIntent(data) {
        const platformFeeRate = this.commissionPercent / 100;
        const guideAmount = data.amount * (1 - platformFeeRate);
        const connectedAccountId = await this.resolveGuideStripeAccount(data);
        const { clientSecret, paymentIntentId } = await this.stripeService.createPaymentIntent({
            amount: data.amount,
            currency: data.currency ?? 'usd',
            connectedAccountId,
            metadata: {
                bookingId: data.bookingId ?? '',
                orderId: data.orderId ?? '',
                ticketPurchaseId: data.ticketPurchaseId ?? '',
                tourBookingId: data.tourBookingId ?? '',
                paymentType: data.paymentType ?? 'FULL',
            },
        });
        const payment = await this.prisma.payment.create({
            data: {
                bookingId: data.bookingId,
                orderId: data.orderId,
                ticketPurchaseId: data.ticketPurchaseId,
                tourBookingId: data.tourBookingId,
                stripePaymentIntentId: paymentIntentId,
                amount: data.amount,
                currency: data.currency ?? 'USD',
                platformFee: data.amount * platformFeeRate,
                guideAmount,
                paymentType: data.paymentType ?? 'FULL',
                status: 'PENDING',
                metadata: data.metadata ?? undefined,
            },
        });
        this.logger.log(`Payment created: ${payment.id} → Stripe PI: ${paymentIntentId}`);
        return {
            paymentId: payment.id,
            clientSecret,
            paymentIntentId,
            amount: data.amount,
            currency: data.currency ?? 'USD',
        };
    }
    async confirmPayment(paymentIntentId, paymentMethodType) {
        const payment = await this.prisma.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntentId },
        });
        if (!payment) {
            this.logger.warn(`Payment not found for PI: ${paymentIntentId}`);
            return;
        }
        if (payment.status === 'SUCCEEDED')
            return payment;
        const updated = await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: 'SUCCEEDED',
                paymentMethod: paymentMethodType ?? 'card',
            },
        });
        if (payment.bookingId) {
            await this.prisma.booking.update({
                where: { id: payment.bookingId },
                data: { status: 'CONFIRMED' },
            });
        }
        if (payment.orderId) {
            await this.prisma.order.update({
                where: { id: payment.orderId },
                data: { status: 'PAID' },
            });
        }
        if (payment.tourBookingId) {
            await this.prisma.tourBooking.update({
                where: { id: payment.tourBookingId },
                data: {
                    status: payment.paymentType === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'FULLY_PAID',
                    holdExpiresAt: null,
                    ...(payment.paymentType === 'DEPOSIT'
                        ? { depositPaidAt: new Date() }
                        : { balancePaidAt: new Date() }),
                },
            });
            this.sendTourPaymentNotification(payment.tourBookingId, payment.paymentType).catch((err) => this.logger.error(`Tour notification failed for booking ${payment.tourBookingId}: ${err.message}`));
        }
        if (payment.ticketPurchaseId) {
            try {
                const primaryTicket = await this.prisma.ticketPurchase.findUnique({
                    where: { id: payment.ticketPurchaseId },
                });
                if (primaryTicket) {
                    await this.confirmEventTickets(primaryTicket.purchaseGroupId);
                }
            }
            catch (err) {
                this.logger.error(`Ticket confirmation failed: ${err.message}`, err.stack);
            }
        }
        await this.updateGuideBalance(payment);
        this.logger.log(`Payment confirmed: ${payment.id}`);
        return updated;
    }
    async confirmEventTickets(purchaseGroupId) {
        const tickets = await this.prisma.ticketPurchase.findMany({
            where: { purchaseGroupId },
            include: { tier: { include: { event: { select: { id: true, title: true } } } } },
        });
        if (!tickets.length || tickets[0].status === 'CONFIRMED')
            return;
        const qrModule = await Promise.resolve().then(() => __importStar(require('qrcode')));
        const toDataURL = qrModule.toDataURL ?? qrModule.default?.toDataURL;
        if (!toDataURL) {
            this.logger.error('QRCode.toDataURL not found — skipping QR generation');
            await this.prisma.ticketPurchase.updateMany({
                where: { purchaseGroupId },
                data: { status: 'CONFIRMED' },
            });
            return;
        }
        for (const ticket of tickets) {
            const qrData = JSON.stringify({
                ticketId: ticket.id,
                eventId: ticket.tier.event.id,
                eventTitle: ticket.tier.event.title,
                tierName: ticket.tier.name,
                attendeeName: ticket.attendeeName,
            });
            const qrCode = await toDataURL(qrData, { width: 200, margin: 2 });
            await this.prisma.ticketPurchase.update({
                where: { id: ticket.id },
                data: { status: 'CONFIRMED', qrCode },
            });
        }
        await this.prisma.eventTicketTier.update({
            where: { id: tickets[0].tierId },
            data: { sold: { increment: tickets.length } },
        });
        this.logger.log(`Confirmed ${tickets.length} event tickets for group ${purchaseGroupId}`);
    }
    async sendTourPaymentNotification(tourBookingId, paymentType) {
        const booking = await this.prisma.tourBooking.findUnique({
            where: { id: tourBookingId },
            include: {
                tour: { select: { title: true, location: true, guide: { select: { displayName: true } } } },
                roomType: { select: { name: true } },
                departure: { select: { startDate: true, endDate: true } },
                seeker: { select: { userId: true } },
            },
        });
        if (!booking || !booking.seeker)
            return;
        const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—';
        const dep = booking.departure;
        const departureDates = dep ? `${fmt(dep.startDate)} – ${fmt(dep.endDate)}` : 'TBD';
        const reference = booking.bookingReference || booking.id.slice(-8).toUpperCase();
        const seekerName = booking.contactFirstName || 'there';
        const seekerEmail = booking.contactEmail;
        if (!seekerEmail)
            return;
        if (paymentType === 'BALANCE') {
            await this.notifications.notifyTourBalancePaid({
                seekerUserId: booking.seeker.userId,
                seekerEmail,
                seekerName,
                tourTitle: booking.tour.title,
                bookingReference: reference,
                bookingId: booking.id,
                departureDates,
                totalPaid: `$${Number(booking.totalAmount).toLocaleString()}`,
            });
        }
        else {
            const deposit = Number(booking.depositAmount ?? booking.totalAmount);
            const balance = Number(booking.balanceAmount ?? 0);
            const isPaidInFull = paymentType === 'FULL' || balance === 0;
            await this.notifications.notifyTourDepositConfirmed({
                seekerUserId: booking.seeker.userId,
                seekerEmail,
                seekerName,
                tourTitle: booking.tour.title,
                bookingReference: reference,
                bookingId: booking.id,
                departureDates,
                location: booking.tour.location || 'TBD',
                travelers: booking.travelers,
                roomType: booking.roomType.name,
                depositPaid: `$${deposit.toLocaleString()}`,
                balanceDue: `$${balance.toLocaleString()}`,
                balanceDueDate: booking.balanceDueAt ? fmt(booking.balanceDueAt) : 'TBD',
                guideName: booking.tour.guide.displayName,
                isPaidInFull,
            });
        }
    }
    async updateGuideBalance(payment) {
        const guideId = await this.resolveGuideIdFromPayment(payment);
        if (!guideId)
            return;
        const guide = await this.prisma.guideProfile.findUnique({
            where: { id: guideId },
            select: { stripeAccountId: true },
        });
        await this.prisma.payoutAccount.upsert({
            where: { guideId },
            update: {
                availableBalance: { increment: Number(payment.guideAmount) },
                totalEarned: { increment: Number(payment.guideAmount) },
            },
            create: {
                guideId,
                stripeAccountId: guide?.stripeAccountId || `pending-${guideId}`,
                availableBalance: Number(payment.guideAmount),
                totalEarned: Number(payment.guideAmount),
            },
        });
    }
    async resolveGuideIdFromPayment(payment) {
        if (payment.bookingId) {
            const booking = await this.prisma.booking.findUnique({
                where: { id: payment.bookingId },
                include: { service: { select: { guideId: true } } },
            });
            return booking?.service.guideId;
        }
        if (payment.tourBookingId) {
            const tb = await this.prisma.tourBooking.findUnique({
                where: { id: payment.tourBookingId },
                include: { tour: { select: { guideId: true } } },
            });
            return tb?.tour.guideId;
        }
        if (payment.ticketPurchaseId) {
            const tp = await this.prisma.ticketPurchase.findUnique({
                where: { id: payment.ticketPurchaseId },
                include: { tier: { include: { event: { select: { guideId: true } } } } },
            });
            return tp?.tier.event.guideId;
        }
        return undefined;
    }
    async failPayment(paymentIntentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntentId },
        });
        if (!payment)
            return;
        await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'FAILED' },
        });
        this.logger.warn(`Payment failed: ${payment.id}`);
    }
    async findOne(paymentId) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        return payment;
    }
    async refund(paymentId, amount) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        if (payment.status !== 'SUCCEEDED')
            throw new common_1.BadRequestException('Can only refund succeeded payments');
        const refundAmount = amount ?? Number(payment.amount);
        const refund = await this.stripeService.createRefund(payment.stripePaymentIntentId, refundAmount);
        return this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                refundedAmount: refundAmount,
                stripeRefundId: refund.id,
            },
        });
    }
    async handleStripeWebhook(rawBody, signature) {
        let event;
        try {
            event = this.stripeService.constructEvent(rawBody, signature);
        }
        catch (err) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new common_1.BadRequestException('Invalid webhook signature');
        }
        this.logger.log(`Webhook received: ${event.type}`);
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const pi = event.data.object;
                const methodType = pi.payment_method_types?.[0] ?? 'card';
                await this.confirmPayment(pi.id, methodType);
                break;
            }
            case 'payment_intent.payment_failed': {
                const pi = event.data.object;
                await this.failPayment(pi.id);
                break;
            }
            case 'checkout.session.completed': {
                const session = event.data.object;
                if (session.payment_intent) {
                    await this.confirmPayment(session.payment_intent);
                }
                break;
            }
            case 'account.updated': {
                const account = event.data.object;
                if (account.charges_enabled && account.details_submitted) {
                    await this.prisma.guideProfile.updateMany({
                        where: { stripeAccountId: account.id },
                        data: { stripeOnboardingDone: true },
                    });
                    this.logger.log(`Connect account ${account.id} onboarding complete`);
                }
                break;
            }
            default:
                this.logger.log(`Unhandled webhook event: ${event.type}`);
        }
        return { received: true };
    }
    async createConnectOnboarding(userId) {
        const guide = await this.prisma.guideProfile.findUnique({
            where: { userId },
            include: { user: { select: { email: true } } },
        });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found');
        if (guide.stripeAccountId && guide.stripeAccountId !== 'pending-setup') {
            const status = await this.stripeService.getConnectAccountStatus(guide.stripeAccountId);
            if (status.detailsSubmitted) {
                const dashboardUrl = await this.stripeService.createConnectLoginLink(guide.stripeAccountId);
                return { alreadyOnboarded: true, dashboardUrl, status };
            }
            const { onboardingUrl } = await this.stripeService.createConnectAccount({
                email: guide.user.email,
                guideId: guide.id,
                displayName: guide.displayName,
            });
            return { onboardingUrl };
        }
        const { accountId, onboardingUrl } = await this.stripeService.createConnectAccount({
            email: guide.user.email,
            guideId: guide.id,
            displayName: guide.displayName,
        });
        await this.prisma.guideProfile.update({
            where: { id: guide.id },
            data: { stripeAccountId: accountId },
        });
        await this.prisma.payoutAccount.upsert({
            where: { guideId: guide.id },
            update: { stripeAccountId: accountId },
            create: { guideId: guide.id, stripeAccountId: accountId },
        });
        return { accountId, onboardingUrl };
    }
    async getConnectStatus(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found');
        if (!guide.stripeAccountId || guide.stripeAccountId === 'pending-setup') {
            return { connected: false, chargesEnabled: false, payoutsEnabled: false };
        }
        const status = await this.stripeService.getConnectAccountStatus(guide.stripeAccountId);
        return { connected: true, ...status };
    }
    async requestPayout(userId, amount) {
        if (amount < 10)
            throw new common_1.BadRequestException('Minimum payout amount is $10');
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found');
        const payoutAccount = await this.prisma.payoutAccount.findUnique({ where: { guideId: guide.id } });
        if (!payoutAccount)
            throw new common_1.BadRequestException('No payout account found. Set up Stripe Connect first.');
        if (Number(payoutAccount.availableBalance) < amount)
            throw new common_1.BadRequestException('Insufficient available balance');
        const payout = await this.prisma.payoutRequest.create({
            data: {
                guideId: guide.id,
                payoutAccountId: payoutAccount.id,
                amount,
                status: 'PENDING',
            },
        });
        await this.prisma.payoutAccount.update({
            where: { id: payoutAccount.id },
            data: { availableBalance: { decrement: amount } },
        });
        this.logger.log(`Payout requested: ${payout.id} for $${amount} by guide ${guide.id}`);
        return payout;
    }
    async processPayout(payoutRequestId) {
        const payout = await this.prisma.payoutRequest.findUnique({
            where: { id: payoutRequestId },
            include: { payoutAccount: true, guide: { select: { stripeAccountId: true, stripeOnboardingDone: true, displayName: true } } },
        });
        if (!payout)
            throw new common_1.NotFoundException('Payout request not found');
        if (payout.status !== 'PENDING')
            throw new common_1.BadRequestException(`Payout is already ${payout.status}`);
        if (!payout.guide.stripeAccountId || !payout.guide.stripeOnboardingDone) {
            throw new common_1.BadRequestException('Guide has not completed Stripe Connect onboarding');
        }
        await this.prisma.payoutRequest.update({
            where: { id: payout.id },
            data: { status: 'PROCESSING' },
        });
        try {
            const transfer = await this.stripeService.createTransfer({
                amount: Number(payout.amount),
                connectedAccountId: payout.guide.stripeAccountId,
                description: `Payout ${payout.id} for ${payout.guide.displayName}`,
            });
            await this.prisma.payoutRequest.update({
                where: { id: payout.id },
                data: { status: 'COMPLETED', stripePayoutId: transfer.id, processedAt: new Date() },
            });
            await this.prisma.payoutAccount.update({
                where: { id: payout.payoutAccountId },
                data: { totalPaidOut: { increment: Number(payout.amount) } },
            });
            this.logger.log(`Payout completed: ${payout.id} → Stripe transfer ${transfer.id}`);
            return { status: 'COMPLETED', transferId: transfer.id };
        }
        catch (err) {
            await this.prisma.payoutRequest.update({
                where: { id: payout.id },
                data: { status: 'FAILED' },
            });
            await this.prisma.payoutAccount.update({
                where: { id: payout.payoutAccountId },
                data: { availableBalance: { increment: Number(payout.amount) } },
            });
            this.logger.error(`Payout failed: ${payout.id} — ${err.message}`);
            throw new common_1.BadRequestException(`Stripe transfer failed: ${err.message}`);
        }
    }
    async getGuidePayoutHistory(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found');
        return this.prisma.payoutRequest.findMany({
            where: { guideId: guide.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true, amount: true, currency: true, status: true,
                stripePayoutId: true, processedAt: true, createdAt: true,
            },
        });
    }
    async getGuideEarnings(userId) {
        const guide = await this.prisma.guideProfile.findUnique({ where: { userId } });
        if (!guide)
            throw new common_1.NotFoundException('Guide profile not found');
        const payoutAccount = await this.prisma.payoutAccount.findUnique({ where: { guideId: guide.id } });
        const recentPayments = await this.prisma.payment.findMany({
            where: {
                status: 'SUCCEEDED',
                OR: [
                    { booking: { service: { guideId: guide.id } } },
                    { tourBooking: { tour: { guideId: guide.id } } },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true, amount: true, guideAmount: true, platformFee: true, paymentType: true,
                paymentMethod: true, createdAt: true, status: true,
            },
        });
        return {
            balance: {
                available: Number(payoutAccount?.availableBalance ?? 0),
                pending: Number(payoutAccount?.pendingBalance ?? 0),
                totalEarned: Number(payoutAccount?.totalEarned ?? 0),
                totalPaidOut: Number(payoutAccount?.totalPaidOut ?? 0),
            },
            recentPayments,
            stripeConnected: !!guide.stripeAccountId && guide.stripeOnboardingDone,
        };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stripe_service_1.StripeService,
        config_1.ConfigService,
        notifications_service_1.NotificationsService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map