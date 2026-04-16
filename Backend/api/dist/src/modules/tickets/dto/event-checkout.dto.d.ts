export declare class AttendeeDto {
    firstName: string;
    lastName: string;
    email: string;
    dietaryNeeds?: string;
    accessibilityNeeds?: string;
}
export declare class EventCheckoutDto {
    eventId: string;
    tierId: string;
    quantity: number;
    attendees: AttendeeDto[];
}
