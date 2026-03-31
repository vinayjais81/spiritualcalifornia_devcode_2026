import { EventType } from '@prisma/client';
export declare class UpdateEventDto {
    title?: string;
    type?: EventType;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
    coverImageUrl?: string;
    timezone?: string;
    isPublished?: boolean;
    isCancelled?: boolean;
}
