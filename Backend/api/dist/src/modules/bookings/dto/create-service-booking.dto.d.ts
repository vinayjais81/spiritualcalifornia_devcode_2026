export declare class CreateServiceBookingDto {
    serviceId: string;
    startTime: string;
    endTime: string;
    calendlyEventUri?: string;
    calendlyInviteeUri?: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    sessionNotes?: string;
    experienceLevel?: string;
    healthConditions?: string;
    referralSource?: string;
}
