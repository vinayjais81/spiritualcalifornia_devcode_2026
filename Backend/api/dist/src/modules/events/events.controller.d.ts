import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class EventsController {
    private readonly eventsService;
    constructor(eventsService: EventsService);
    create(user: CurrentUserData, dto: CreateEventDto): Promise<({
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
    findMine(user: CurrentUserData): Promise<({
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
    remove(user: CurrentUserData, id: string): Promise<{
        deleted: boolean;
    }>;
}
