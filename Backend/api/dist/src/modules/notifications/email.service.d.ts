import { ConfigService } from '@nestjs/config';
export declare class EmailService {
    private readonly config;
    private readonly resend;
    private readonly from;
    private readonly logger;
    constructor(config: ConfigService);
    private send;
    sendBookingConfirmation(to: string, data: {
        seekerName: string;
        guideName: string;
        serviceName: string;
        dateTime: string;
        amount: string;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendOrderConfirmation(to: string, data: {
        name: string;
        orderId: string;
        items: Array<{
            name: string;
            qty: number;
            price: string;
        }>;
        total: string;
        hasDigital: boolean;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendReviewRequest(to: string, data: {
        seekerName: string;
        guideName: string;
        serviceName: string;
        bookingId: string;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendWelcome(to: string, name: string): Promise<import("resend").CreateEmailResponse | null>;
    sendVerificationApproved(to: string, guideName: string): Promise<import("resend").CreateEmailResponse | null>;
    private tourEmailShell;
    sendTourDepositConfirmation(to: string, data: {
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
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendTourBalancePaid(to: string, data: {
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        departureDates: string;
        totalPaid: string;
        bookingId: string;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendTourBalanceReminder(to: string, data: {
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        departureDates: string;
        balanceDue: string;
        balanceDueDate: string;
        daysUntilDue: number;
        bookingId: string;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendTourDepartureReminder(to: string, data: {
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        departureDates: string;
        meetingPoint: string;
        daysUntilDeparture: number;
        bookingId: string;
    }): Promise<import("resend").CreateEmailResponse | null>;
    sendTourCancellation(to: string, data: {
        seekerName: string;
        tourTitle: string;
        bookingReference: string;
        refundAmount: string;
        refundTier: 'FULL' | 'HALF' | 'NONE';
        cancellationReason: string | null;
    }): Promise<import("resend").CreateEmailResponse | null>;
}
