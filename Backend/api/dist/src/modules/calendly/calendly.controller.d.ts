import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { CalendlyService } from './calendly.service';
export declare class CalendlyController {
    private readonly calendlyService;
    constructor(calendlyService: CalendlyService);
    getStatus(user: CurrentUserData): Promise<{
        connected: boolean;
        calendarLink: string | null;
        calendarType: string | null;
        calendlyUserUri: string | null;
    }>;
    getEventTypes(user: CurrentUserData): Promise<import("./calendly.service").CalendlyEventType[]>;
    getScheduledEvents(user: CurrentUserData): Promise<import("./calendly.service").CalendlyScheduledEvent[]>;
    getSchedulingLink(user: CurrentUserData): Promise<{
        link: string;
        eventTypes: import("./calendly.service").CalendlyEventType[];
    }>;
    disconnect(user: CurrentUserData): Promise<{
        disconnected: boolean;
    }>;
    getPublicBookingInfo(slug: string): Promise<{
        guide: {
            slug: string;
            displayName: string;
            avatarUrl: string | null;
            isVerified: boolean;
            averageRating: number;
            totalReviews: number;
            calendlyConnected: boolean;
            calendarLink: string | null;
        };
        services: {
            id: string;
            name: string;
            description: string | null;
            type: import(".prisma/client").$Enums.ServiceType;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            durationMin: number;
        }[];
    }>;
    handleWebhook(body: any, signature: string): Promise<{
        received: boolean;
    }>;
}
