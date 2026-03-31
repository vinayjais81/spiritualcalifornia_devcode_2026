export declare class CreateRoomTypeDto {
    name: string;
    description?: string;
    pricePerNight: number;
    totalPrice: number;
    capacity: number;
    amenities?: string[];
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
    basePrice: number;
    capacity: number;
    coverImageUrl?: string;
    imageUrls?: string[];
    highlights?: string[];
    included?: string[];
    notIncluded?: string[];
    requirements?: string;
    depositMin?: number;
    roomTypes?: CreateRoomTypeDto[];
}
