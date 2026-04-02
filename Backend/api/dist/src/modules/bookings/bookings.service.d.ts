import { PrismaService } from '../../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateServiceBookingDto } from './dto/create-service-booking.dto';
export declare class BookingsService {
    private readonly prisma;
    private readonly paymentsService;
    private readonly logger;
    constructor(prisma: PrismaService, paymentsService: PaymentsService);
    createServiceBooking(userId: string, dto: CreateServiceBookingDto): Promise<{
        bookingId: string;
        clientSecret: string;
        paymentIntentId: string;
        service: {
            name: string;
            type: import(".prisma/client").$Enums.ServiceType;
            durationMin: number;
            price: number;
            currency: string;
        };
        guide: {
            displayName: string;
            slug: string;
        };
        slot: {
            startTime: string;
            endTime: string;
        };
    }>;
    create(userId: string, dto: CreateBookingDto): Promise<{
        service: {
            name: string;
            guide: {
                slug: string;
                displayName: string;
            };
            type: import(".prisma/client").$Enums.ServiceType;
            durationMin: number;
        };
        slot: {
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    }>;
    findMySeekerBookings(userId: string): Promise<({
        service: {
            name: string;
            guide: {
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
            };
            type: import(".prisma/client").$Enums.ServiceType;
        };
        slot: {
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    })[]>;
    findMyGuideBookings(userId: string): Promise<({
        service: {
            name: string;
            type: import(".prisma/client").$Enums.ServiceType;
            durationMin: number;
        };
        seeker: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
            };
        };
        slot: {
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    })[]>;
    findOne(userId: string, bookingId: string): Promise<{
        service: {
            guide: {
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                userId: string;
                displayName: string;
            };
        } & {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            guideId: string;
            type: import(".prisma/client").$Enums.ServiceType;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            durationMin: number;
        };
        seeker: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
            userId: string;
        };
        slot: {
            id: string;
            createdAt: Date;
            startTime: Date;
            endTime: Date;
            isBooked: boolean;
            isBlocked: boolean;
            serviceId: string;
        };
        payment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            currency: string;
            status: import(".prisma/client").$Enums.PaymentStatus;
            stripePaymentIntentId: string;
            stripeCheckoutSessionId: string | null;
            stripeTransferId: string | null;
            amount: import("@prisma/client-runtime-utils").Decimal;
            platformFee: import("@prisma/client-runtime-utils").Decimal;
            guideAmount: import("@prisma/client-runtime-utils").Decimal;
            paymentType: import(".prisma/client").$Enums.PaymentType;
            refundedAmount: import("@prisma/client-runtime-utils").Decimal | null;
            stripeRefundId: string | null;
            paymentMethod: string | null;
            metadata: import("@prisma/client/runtime/client").JsonValue | null;
            bookingId: string | null;
            orderId: string | null;
            ticketPurchaseId: string | null;
            tourBookingId: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    }>;
    cancel(userId: string, bookingId: string, reason?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    }>;
    confirm(userId: string, bookingId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    }>;
    complete(userId: string, bookingId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        serviceId: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
        seekerId: string;
        slotId: string;
    }>;
}
