import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
export interface CalendlyEventType {
    uri: string;
    name: string;
    slug: string;
    duration: number;
    schedulingUrl: string;
    active: boolean;
    kind: string;
    type: string;
}
export interface CalendlyScheduledEvent {
    uri: string;
    name: string;
    status: string;
    startTime: string;
    endTime: string;
    eventType: string;
    location?: {
        type: string;
        join_url?: string;
    };
    inviteesCounter: {
        total: number;
        active: number;
    };
    createdAt: string;
    updatedAt: string;
}
export declare class CalendlyService {
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private readonly CALENDLY_API;
    private readonly CALENDLY_AUTH;
    constructor(prisma: PrismaService, configService: ConfigService);
    getValidToken(guideProfileId: string): Promise<string>;
    private refreshToken;
    getEventTypes(userId: string): Promise<CalendlyEventType[]>;
    getScheduledEvents(userId: string, options?: {
        status?: string;
        minStartTime?: string;
        maxStartTime?: string;
        count?: number;
    }): Promise<CalendlyScheduledEvent[]>;
    getSchedulingLink(userId: string): Promise<{
        link: string;
        eventTypes: CalendlyEventType[];
    }>;
    getPublicSchedulingInfo(guideSlug: string): Promise<{
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
    getConnectionStatus(userId: string): Promise<{
        connected: boolean;
        calendarLink: string | null;
        calendarType: string | null;
        calendlyUserUri: string | null;
    }>;
    disconnect(userId: string): Promise<{
        disconnected: boolean;
    }>;
    handleWebhookEvent(event: any, signature: string): Promise<{
        received: boolean;
    }>;
    private handleInviteeCreated;
    private handleInviteeCanceled;
    cancelInvitee(guideProfileId: string, inviteeUri: string, reason?: string): Promise<{
        cancelled: boolean;
    }>;
    private requireGuide;
}
