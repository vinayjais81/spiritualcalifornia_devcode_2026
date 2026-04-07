import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StripeService } from './stripe.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class PaymentsService {
    private readonly prisma;
    private readonly stripeService;
    private readonly config;
    private readonly notifications;
    private readonly logger;
    private readonly commissionPercent;
    constructor(prisma: PrismaService, stripeService: StripeService, config: ConfigService, notifications: NotificationsService);
    private resolveGuideStripeAccount;
    createPaymentIntent(data: {
        amount: number;
        currency?: string;
        bookingId?: string;
        orderId?: string;
        ticketPurchaseId?: string;
        tourBookingId?: string;
        paymentType?: 'FULL' | 'DEPOSIT' | 'BALANCE';
        metadata?: Record<string, any>;
    }): Promise<{
        paymentId: string;
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
        currency: string;
    }>;
    confirmPayment(paymentIntentId: string, paymentMethodType?: string): Promise<{
        id: string;
        stripePaymentIntentId: string;
        stripeCheckoutSessionId: string | null;
        stripeTransferId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        platformFee: import("@prisma/client-runtime-utils").Decimal;
        guideAmount: import("@prisma/client-runtime-utils").Decimal;
        paymentType: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
        stripeRefundId: string | null;
        paymentMethod: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        bookingId: string | null;
        orderId: string | null;
        ticketPurchaseId: string | null;
        tourBookingId: string | null;
    } | undefined>;
    private sendTourPaymentNotification;
    private updateGuideBalance;
    failPayment(paymentIntentId: string): Promise<void>;
    findOne(paymentId: string): Promise<{
        id: string;
        stripePaymentIntentId: string;
        stripeCheckoutSessionId: string | null;
        stripeTransferId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        platformFee: import("@prisma/client-runtime-utils").Decimal;
        guideAmount: import("@prisma/client-runtime-utils").Decimal;
        paymentType: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
        stripeRefundId: string | null;
        paymentMethod: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        bookingId: string | null;
        orderId: string | null;
        ticketPurchaseId: string | null;
        tourBookingId: string | null;
    }>;
    refund(paymentId: string, amount?: number): Promise<{
        id: string;
        stripePaymentIntentId: string;
        stripeCheckoutSessionId: string | null;
        stripeTransferId: string | null;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        platformFee: import("@prisma/client-runtime-utils").Decimal;
        guideAmount: import("@prisma/client-runtime-utils").Decimal;
        paymentType: import(".prisma/client").$Enums.PaymentType;
        status: import(".prisma/client").$Enums.PaymentStatus;
        refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
        stripeRefundId: string | null;
        paymentMethod: string | null;
        metadata: import("@prisma/client/runtime/client").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
        bookingId: string | null;
        orderId: string | null;
        ticketPurchaseId: string | null;
        tourBookingId: string | null;
    }>;
    handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{
        received: boolean;
    }>;
    createConnectOnboarding(userId: string): Promise<{
        alreadyOnboarded: boolean;
        dashboardUrl: string;
        status: {
            chargesEnabled: boolean;
            payoutsEnabled: boolean;
            detailsSubmitted: boolean;
        };
        onboardingUrl?: undefined;
        accountId?: undefined;
    } | {
        onboardingUrl: string;
        alreadyOnboarded?: undefined;
        dashboardUrl?: undefined;
        status?: undefined;
        accountId?: undefined;
    } | {
        accountId: string;
        onboardingUrl: string;
        alreadyOnboarded?: undefined;
        dashboardUrl?: undefined;
        status?: undefined;
    }>;
    getConnectStatus(userId: string): Promise<{
        connected: boolean;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
    } | {
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
        connected: boolean;
    }>;
    requestPayout(userId: string, amount: number): Promise<{
        id: string;
        amount: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        createdAt: Date;
        stripePayoutId: string | null;
        processedAt: Date | null;
        guideId: string;
        payoutAccountId: string;
    }>;
    getGuideEarnings(userId: string): Promise<{
        balance: {
            available: number;
            pending: number;
            totalEarned: number;
            totalPaidOut: number;
        };
        recentPayments: {
            id: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            guideAmount: import("@prisma/client-runtime-utils").Decimal;
            paymentType: import(".prisma/client").$Enums.PaymentType;
            status: import(".prisma/client").$Enums.PaymentStatus;
            paymentMethod: string | null;
            createdAt: Date;
        }[];
        stripeConnected: boolean;
    }>;
}
