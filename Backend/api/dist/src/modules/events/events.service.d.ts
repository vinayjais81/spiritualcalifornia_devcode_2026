import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
export declare class EventsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private requireGuide;
    create(userId: string, dto: CreateEventDto): Promise<({
        ticketTiers: {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            capacity: number;
            sold: number;
            eventId: string;
        }[];
    } & {
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        startTime: Date;
        endTime: Date;
        type: import(".prisma/client").$Enums.EventType;
        onlineUrl: string | null;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        coverImageUrl: string | null;
        isCancelled: boolean;
    }) | null>;
    findByGuide(userId: string): Promise<({
        ticketTiers: {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            capacity: number;
            sold: number;
            eventId: string;
        }[];
    } & {
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        startTime: Date;
        endTime: Date;
        type: import(".prisma/client").$Enums.EventType;
        onlineUrl: string | null;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        coverImageUrl: string | null;
        isCancelled: boolean;
    })[]>;
    findPublishedByGuideId(guideId: string): Promise<({
        ticketTiers: {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            capacity: number;
            sold: number;
            eventId: string;
        }[];
    } & {
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        startTime: Date;
        endTime: Date;
        type: import(".prisma/client").$Enums.EventType;
        onlineUrl: string | null;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        coverImageUrl: string | null;
        isCancelled: boolean;
    })[]>;
    findPublished(page?: number, limit?: number): Promise<{
        events: ({
            guide: {
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
            };
            ticketTiers: {
                id: string;
                name: string;
                description: string | null;
                isActive: boolean;
                createdAt: Date;
                price: import("@prisma/client-runtime-utils").Decimal;
                currency: string;
                capacity: number;
                sold: number;
                eventId: string;
            }[];
        } & {
            id: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            location: string | null;
            timezone: string;
            isPublished: boolean;
            algoliaObjectId: string | null;
            guideId: string;
            title: string;
            startTime: Date;
            endTime: Date;
            type: import(".prisma/client").$Enums.EventType;
            onlineUrl: string | null;
            zoomMeetingId: string | null;
            zoomJoinUrl: string | null;
            coverImageUrl: string | null;
            isCancelled: boolean;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(eventId: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            isVerified: boolean;
        };
        ticketTiers: {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            capacity: number;
            sold: number;
            eventId: string;
        }[];
    } & {
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        startTime: Date;
        endTime: Date;
        type: import(".prisma/client").$Enums.EventType;
        onlineUrl: string | null;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        coverImageUrl: string | null;
        isCancelled: boolean;
    }>;
    update(userId: string, eventId: string, dto: UpdateEventDto): Promise<{
        ticketTiers: {
            id: string;
            name: string;
            description: string | null;
            isActive: boolean;
            createdAt: Date;
            price: import("@prisma/client-runtime-utils").Decimal;
            currency: string;
            capacity: number;
            sold: number;
            eventId: string;
        }[];
    } & {
        id: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        isPublished: boolean;
        algoliaObjectId: string | null;
        guideId: string;
        title: string;
        startTime: Date;
        endTime: Date;
        type: import(".prisma/client").$Enums.EventType;
        onlineUrl: string | null;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        coverImageUrl: string | null;
        isCancelled: boolean;
    }>;
    delete(userId: string, eventId: string): Promise<{
        deleted: boolean;
    }>;
    publishAll(guideId: string): Promise<void>;
}
