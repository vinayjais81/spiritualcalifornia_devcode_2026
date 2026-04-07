import { PrismaService } from '../../database/prisma.service';
import { EmailService } from './email.service';
import { NotificationType } from '@prisma/client';
export declare class NotificationsService {
    private readonly prisma;
    private readonly emailService;
    private readonly logger;
    constructor(prisma: PrismaService, emailService: EmailService);
    create(userId: string, type: NotificationType, title: string, body: string, data?: Record<string, any>): Promise<{
        data: import("@prisma/client/runtime/client").JsonValue | null;
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        type: import(".prisma/client").$Enums.NotificationType;
        body: string;
        isRead: boolean;
    }>;
    findByUser(userId: string, page?: number, limit?: number): Promise<{
        notifications: {
            data: import("@prisma/client/runtime/client").JsonValue | null;
            id: string;
            createdAt: Date;
            userId: string;
            title: string;
            type: import(".prisma/client").$Enums.NotificationType;
            body: string;
            isRead: boolean;
        }[];
        unreadCount: number;
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    markAsRead(userId: string, notificationId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    markAllAsRead(userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    notifyBookingConfirmed(booking: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        guideName: string;
        serviceName: string;
        dateTime: string;
        amount: string;
    }): Promise<void>;
    notifyOrderConfirmed(order: {
        userId: string;
        email: string;
        name: string;
        orderId: string;
        items: Array<{
            name: string;
            qty: number;
            price: string;
        }>;
        total: string;
        hasDigital: boolean;
    }): Promise<void>;
    notifyReviewRequest(data: {
        userId: string;
        email: string;
        seekerName: string;
        guideName: string;
        serviceName: string;
        bookingId: string;
    }): Promise<void>;
    notifyVerificationApproved(data: {
        userId: string;
        email: string;
        guideName: string;
    }): Promise<void>;
    notifyTourDepositConfirmed(data: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        bookingId: string;
        departureDates: string;
        location: string;
        travelers: number;
        roomType: string;
        depositPaid: string;
        balanceDue: string;
        balanceDueDate: string;
        guideName: string;
        isPaidInFull: boolean;
    }): Promise<void>;
    notifyTourBalancePaid(data: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        bookingId: string;
        departureDates: string;
        totalPaid: string;
    }): Promise<void>;
    notifyTourBalanceReminder(data: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        bookingId: string;
        departureDates: string;
        balanceDue: string;
        balanceDueDate: string;
        daysUntilDue: number;
    }): Promise<void>;
    notifyTourDepartureReminder(data: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        bookingId: string;
        departureDates: string;
        meetingPoint: string;
        daysUntilDeparture: number;
    }): Promise<void>;
    notifyTourCancelled(data: {
        seekerUserId: string;
        seekerEmail: string;
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        refundAmount: string;
        refundTier: 'FULL' | 'HALF' | 'NONE';
        cancellationReason: string | null;
    }): Promise<void>;
}
