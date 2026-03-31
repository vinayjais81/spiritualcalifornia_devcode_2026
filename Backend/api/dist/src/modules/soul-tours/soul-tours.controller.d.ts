import { SoulToursService } from './soul-tours.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto } from './dto/book-tour.dto';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
export declare class SoulToursController {
    private readonly soulToursService;
    constructor(soulToursService: SoulToursService);
    create(user: CurrentUserData, dto: CreateTourDto): Promise<{
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            available: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
        }[];
    } & {
        id: string;
        slug: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        city: string | null;
        state: string | null;
        country: string | null;
        isPublished: boolean;
        guideId: string;
        title: string;
        currency: string;
        coverImageUrl: string | null;
        isCancelled: boolean;
        capacity: number;
        imageUrls: string[];
        startDate: Date;
        endDate: Date;
        shortDesc: string | null;
        address: string | null;
        basePrice: import("@prisma/client-runtime-utils").Decimal;
        spotsRemaining: number;
        highlights: string[];
        included: string[];
        notIncluded: string[];
        requirements: string | null;
        depositMin: import("@prisma/client-runtime-utils").Decimal | null;
    }>;
    findMine(user: CurrentUserData): Promise<({
        _count: {
            bookings: number;
        };
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            available: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
        }[];
    } & {
        id: string;
        slug: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        city: string | null;
        state: string | null;
        country: string | null;
        isPublished: boolean;
        guideId: string;
        title: string;
        currency: string;
        coverImageUrl: string | null;
        isCancelled: boolean;
        capacity: number;
        imageUrls: string[];
        startDate: Date;
        endDate: Date;
        shortDesc: string | null;
        address: string | null;
        basePrice: import("@prisma/client-runtime-utils").Decimal;
        spotsRemaining: number;
        highlights: string[];
        included: string[];
        notIncluded: string[];
        requirements: string | null;
        depositMin: import("@prisma/client-runtime-utils").Decimal | null;
    })[]>;
    findMyBookings(user: CurrentUserData): Promise<({
        tour: {
            location: string | null;
            title: string;
            coverImageUrl: string | null;
            startDate: Date;
            endDate: Date;
        };
        roomType: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import(".prisma/client").$Enums.TourBookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        cancelledAt: Date | null;
        cancellationReason: string | null;
        seekerId: string;
        tourId: string;
        roomTypeId: string;
        travelers: number;
        depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
        depositPaidAt: Date | null;
        balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
        balancePaidAt: Date | null;
        specialRequests: string | null;
        contactFirstName: string;
        contactLastName: string;
        contactEmail: string;
        contactPhone: string | null;
    })[]>;
    findPublished(page?: string, limit?: string): Promise<{
        tours: ({
            guide: {
                slug: string;
                user: {
                    avatarUrl: string | null;
                };
                displayName: string;
            };
            roomTypes: {
                id: string;
                name: string;
                description: string | null;
                sortOrder: number;
                createdAt: Date;
                capacity: number;
                available: number;
                tourId: string;
                pricePerNight: import("@prisma/client-runtime-utils").Decimal;
                totalPrice: import("@prisma/client-runtime-utils").Decimal;
                amenities: string[];
            }[];
        } & {
            id: string;
            slug: string;
            description: string | null;
            createdAt: Date;
            updatedAt: Date;
            location: string | null;
            timezone: string;
            city: string | null;
            state: string | null;
            country: string | null;
            isPublished: boolean;
            guideId: string;
            title: string;
            currency: string;
            coverImageUrl: string | null;
            isCancelled: boolean;
            capacity: number;
            imageUrls: string[];
            startDate: Date;
            endDate: Date;
            shortDesc: string | null;
            address: string | null;
            basePrice: import("@prisma/client-runtime-utils").Decimal;
            spotsRemaining: number;
            highlights: string[];
            included: string[];
            notIncluded: string[];
            requirements: string | null;
            depositMin: import("@prisma/client-runtime-utils").Decimal | null;
        })[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    findOne(slugOrId: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            isVerified: boolean;
            averageRating: number;
        };
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            available: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
        }[];
    } & {
        id: string;
        slug: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        city: string | null;
        state: string | null;
        country: string | null;
        isPublished: boolean;
        guideId: string;
        title: string;
        currency: string;
        coverImageUrl: string | null;
        isCancelled: boolean;
        capacity: number;
        imageUrls: string[];
        startDate: Date;
        endDate: Date;
        shortDesc: string | null;
        address: string | null;
        basePrice: import("@prisma/client-runtime-utils").Decimal;
        spotsRemaining: number;
        highlights: string[];
        included: string[];
        notIncluded: string[];
        requirements: string | null;
        depositMin: import("@prisma/client-runtime-utils").Decimal | null;
    }>;
    update(user: CurrentUserData, id: string, dto: UpdateTourDto): Promise<{
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            available: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
        }[];
    } & {
        id: string;
        slug: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
        location: string | null;
        timezone: string;
        city: string | null;
        state: string | null;
        country: string | null;
        isPublished: boolean;
        guideId: string;
        title: string;
        currency: string;
        coverImageUrl: string | null;
        isCancelled: boolean;
        capacity: number;
        imageUrls: string[];
        startDate: Date;
        endDate: Date;
        shortDesc: string | null;
        address: string | null;
        basePrice: import("@prisma/client-runtime-utils").Decimal;
        spotsRemaining: number;
        highlights: string[];
        included: string[];
        notIncluded: string[];
        requirements: string | null;
        depositMin: import("@prisma/client-runtime-utils").Decimal | null;
    }>;
    remove(user: CurrentUserData, id: string): Promise<{
        deleted: boolean;
    }>;
    bookTour(user: CurrentUserData, dto: BookTourDto): Promise<{
        tour: {
            title: string;
        };
        roomType: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        status: import(".prisma/client").$Enums.TourBookingStatus;
        totalAmount: import("@prisma/client-runtime-utils").Decimal;
        cancelledAt: Date | null;
        cancellationReason: string | null;
        seekerId: string;
        tourId: string;
        roomTypeId: string;
        travelers: number;
        depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
        depositPaidAt: Date | null;
        balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
        balancePaidAt: Date | null;
        specialRequests: string | null;
        contactFirstName: string;
        contactLastName: string;
        contactEmail: string;
        contactPhone: string | null;
    }>;
}
