export declare class CreateRoomTypeDto {
    name: string;
    description?: string;
    pricePerNight: number;
    totalPrice: number;
    capacity: number;
    amenities?: string[];
}
export declare class CreateDepartureDto {
    startDate: string;
    endDate: string;
    capacity: number;
    priceOverride?: number;
    notes?: string;
}
export declare class CreateItineraryDayDto {
    dayNumber: number;
    title: string;
    description: string;
    location?: string;
    meals?: string[];
    accommodation?: string;
    activities?: string[];
    imageUrl?: string;
}
export declare class CancellationPolicyDto {
    fullRefundDaysBefore: number;
    halfRefundDaysBefore: number;
}
export declare class CreateTourDto {
    title: string;
    description?: string;
    shortDesc?: string;
    startDate: string;
    endDate: string;
    timezone?: string;
    location?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    meetingPoint?: string;
    basePrice: number;
    capacity: number;
    coverImageUrl?: string;
    imageUrls?: string[];
    highlights?: string[];
    included?: string[];
    notIncluded?: string[];
    requirements?: string;
    difficultyLevel?: string;
    languages?: string[];
    minDepositPerPerson?: number;
    depositMin?: number;
    balanceDueDaysBefore?: number;
    cancellationPolicy?: CancellationPolicyDto;
    roomTypes?: CreateRoomTypeDto[];
    departures?: CreateDepartureDto[];
    itinerary?: CreateItineraryDayDto[];
    isPublished?: boolean;
}
