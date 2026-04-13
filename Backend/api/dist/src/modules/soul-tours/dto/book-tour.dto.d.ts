export declare class TravelerDto {
    isPrimary: boolean;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    email?: string;
    phone?: string;
}
export declare class BookTourDto {
    tourId: string;
    departureId: string;
    roomTypeId: string;
    travelers: number;
    travelersDetails: TravelerDto[];
    dietaryRequirements?: string;
    dietaryNotes?: string;
    healthConditions?: string;
    intentions?: string;
    specialRequests?: string;
    chosenDepositAmount: number;
    paymentMethod?: string;
}
export declare class PayBalanceDto {
    amount?: number;
}
export declare class CancelBookingDto {
    reason?: string;
}
