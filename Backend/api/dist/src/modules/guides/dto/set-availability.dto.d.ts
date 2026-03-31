export declare class AvailabilitySlotDto {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isRecurring?: boolean;
    bufferMin?: number;
}
export declare class SetAvailabilityDto {
    slots: AvailabilitySlotDto[];
}
