import { PrismaService } from '../../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
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
    delete(userId: string, eventId: string): Promise<{
        deleted: boolean;
    }>;
    publishAll(guideId: string): Promise<void>;
}
