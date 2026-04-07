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
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    }>;
    findMySeekerBookings(userId: string): Promise<({
        service: {
            name: string;
            guide: {
                slug: string;
                displayName: string;
                user: {
                    avatarUrl: string | null;
                };
            };
            type: import(".prisma/client").$Enums.ServiceType;
        };
        slot: {
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    })[]>;
    findMyGuideBookings(userId: string): Promise<({
        payment: {
            id: string;
            amount: import("@prisma/client-runtime-utils").Decimal;
            status: import(".prisma/client").$Enums.PaymentStatus;
            paymentMethod: string | null;
            createdAt: Date;
        } | null;
        seeker: {
            user: {
                email: string;
                firstName: string;
                lastName: string;
                avatarUrl: string | null;
                phone: string | null;
            };
        };
        service: {
            id: string;
            name: string;
            type: import(".prisma/client").$Enums.ServiceType;
            price: import("@prisma/client-runtime-utils").Decimal;
            durationMin: number;
        };
        slot: {
            startTime: Date;
            endTime: Date;
        };
    } & {
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    })[]>;
    findOne(userId: string, bookingId: string): Promise<{
        payment: {
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
        } | null;
        seeker: {
            userId: string;
            user: {
                email: string;
                firstName: string;
                lastName: string;
            };
        };
        service: {
            guide: {
                userId: string;
                slug: string;
                displayName: string;
                user: {
                    avatarUrl: string | null;
                };
            };
        } & {
            id: string;
            currency: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            guideId: string;
            description: string | null;
            type: import(".prisma/client").$Enums.ServiceType;
            price: import("@prisma/client-runtime-utils").Decimal;
            durationMin: number;
            isActive: boolean;
        };
        slot: {
            id: string;
            createdAt: Date;
            serviceId: string;
            startTime: Date;
            endTime: Date;
            isBooked: boolean;
            isBlocked: boolean;
        };
    } & {
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    }>;
    cancel(userId: string, bookingId: string, reason?: string): Promise<{
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    }>;
    confirm(userId: string, bookingId: string): Promise<{
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    }>;
    complete(userId: string, bookingId: string): Promise<{
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.BookingStatus;
        createdAt: Date;
        updatedAt: Date;
        seekerId: string;
        serviceId: string;
        slotId: string;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        notes: string | null;
        cancelledAt: Date | null;
        cancelledBy: string | null;
        cancellationReason: string | null;
        completedAt: Date | null;
    }>;
}
