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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let PaymentsService = class PaymentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPaymentIntent(data) {
        const stubPaymentIntentId = `pi_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const platformFeeRate = 0.15;
        const guideAmount = data.amount * (1 - platformFeeRate);
        const payment = await this.prisma.payment.create({
            data: {
                bookingId: data.bookingId,
                orderId: data.orderId,
                ticketPurchaseId: data.ticketPurchaseId,
                tourBookingId: data.tourBookingId,
                stripePaymentIntentId: stubPaymentIntentId,
                amount: data.amount,
                currency: data.currency ?? 'USD',
                platformFee: data.amount * platformFeeRate,
                guideAmount,
                paymentType: data.paymentType ?? 'FULL',
                status: 'PENDING',
                metadata: data.metadata ?? undefined,
            },
        });
        return {
            paymentId: payment.id,
            clientSecret: `${stubPaymentIntentId}_secret_stub`,
            amount: data.amount,
            currency: data.currency ?? 'USD',
        };
    }
    async confirmPayment(paymentIntentId) {
        const payment = await this.prisma.payment.findUnique({
            where: { stripePaymentIntentId: paymentIntentId },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        const updated = await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'SUCCEEDED' },
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
                    ...(payment.paymentType === 'DEPOSIT' ? { depositPaidAt: new Date() } : { balancePaidAt: new Date() }),
                },
            });
        }
        return updated;
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
        return this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: refundAmount >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                refundedAmount: refundAmount,
                stripeRefundId: `re_stub_${Date.now()}`,
            },
        });
    }
    async handleStripeWebhook(payload) {
        const eventType = payload?.type;
        const paymentIntentId = payload?.data?.object?.id;
        if (eventType === 'payment_intent.succeeded' && paymentIntentId) {
            return this.confirmPayment(paymentIntentId);
        }
        return { received: true };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map