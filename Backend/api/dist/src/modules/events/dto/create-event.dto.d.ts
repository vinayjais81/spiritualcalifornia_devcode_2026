import { EventType } from '@prisma/client';
export declare class CreateEventDto {
    title: string;
    type: EventType;
    startTime: string;
    endTime?: string;
    ticketPrice?: number;
    ticketCapacity?: number;
    location?: string;
    description?: string;
    timezone?: string;
}
