import { TicketsService } from './tickets.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { EventCheckoutDto } from './dto/event-checkout.dto';
export declare class TicketsController {
    private readonly ticketsService;
    constructor(ticketsService: TicketsService);
    eventCheckout(user: CurrentUserData, dto: EventCheckoutDto): Promise<{
        purchaseGroupId: string;
        ticketPurchaseIds: string[];
        clientSecret: string;
        paymentIntentId: string;
        event: {
            id: string;
            title: string;
            startTime: Date;
            endTime: Date;
            location: string | null;
            type: import(".prisma/client").$Enums.EventType;
        };
        tier: {
            id: string;
            name: string;
            price: number;
            currency: string;
        };
        summary: {
            quantity: number;
            subtotal: number;
            bookingFee: number;
            total: number;
        };
    }>;
    getMyEventTickets(user: CurrentUserData): Promise<{
        purchaseGroupId: string;
        status: import(".prisma/client").$Enums.TicketStatus;
        ticketCount: number;
        totalAmount: number;
        bookingFee: number;
        createdAt: Date;
        event: {
            id: string;
            title: string;
            startTime: Date;
            endTime: Date;
            timezone: string;
            location: string | null;
            type: import(".prisma/client").$Enums.EventType;
            coverImageUrl: string | null;
            isCancelled: boolean;
        };
        tier: {
            name: string;
            price: number;
        };
        guide: {
            name: string;
            avatarUrl: string | null;
        };
        tickets: {
            id: string;
            attendeeName: string | null;
            attendeeEmail: string | null;
            qrCode: string | null;
            status: import(".prisma/client").$Enums.TicketStatus;
        }[];
    }[]>;
    getPurchaseGroup(user: CurrentUserData, groupId: string): Promise<{
        purchaseGroupId: string;
        status: import(".prisma/client").$Enums.TicketStatus;
        event: {
            id: string;
            location: string | null;
            guide: {
                user: {
                    firstName: string;
                    lastName: string;
                };
                displayName: string;
            };
            title: string;
            startTime: Date;
            endTime: Date;
            type: import(".prisma/client").$Enums.EventType;
            coverImageUrl: string | null;
        };
        tier: {
            id: string;
            name: string;
            price: number;
        };
        tickets: {
            id: string;
            attendeeName: string | null;
            attendeeEmail: string | null;
            dietaryNeeds: string | null;
            accessibilityNeeds: string | null;
            qrCode: string | null;
            status: import(".prisma/client").$Enums.TicketStatus;
        }[];
        summary: {
            quantity: number;
            subtotal: number;
            bookingFee: number;
            total: number;
        };
    }>;
}
