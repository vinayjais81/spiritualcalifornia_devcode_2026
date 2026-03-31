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
}
