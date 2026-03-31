import { PrismaService } from '../../database/prisma.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto } from './dto/book-tour.dto';
export declare class SoulToursService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private requireGuide;
    private slug;
    create(userId: string, dto: CreateTourDto): Promise<{
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
            available: number;
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
    findByGuide(userId: string): Promise<({
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
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
            available: number;
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
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
            available: number;
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
    findPublished(page?: number, limit?: number): Promise<{
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
                tourId: string;
                pricePerNight: import("@prisma/client-runtime-utils").Decimal;
                totalPrice: import("@prisma/client-runtime-utils").Decimal;
                amenities: string[];
                available: number;
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
    update(userId: string, tourId: string, dto: UpdateTourDto): Promise<{
        roomTypes: {
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            createdAt: Date;
            capacity: number;
            tourId: string;
            pricePerNight: import("@prisma/client-runtime-utils").Decimal;
            totalPrice: import("@prisma/client-runtime-utils").Decimal;
            amenities: string[];
            available: number;
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
    delete(userId: string, tourId: string): Promise<{
        deleted: boolean;
    }>;
    bookTour(userId: string, dto: BookTourDto): Promise<{
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
        contactEmail: string;
        contactFirstName: string;
        contactLastName: string;
        contactPhone: string | null;
        tourId: string;
        roomTypeId: string;
        travelers: number;
        depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
        depositPaidAt: Date | null;
        balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
        balancePaidAt: Date | null;
        specialRequests: string | null;
    }>;
    findMyBookings(userId: string): Promise<({
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
        contactEmail: string;
        contactFirstName: string;
        contactLastName: string;
        contactPhone: string | null;
        tourId: string;
        roomTypeId: string;
        travelers: number;
        depositAmount: import("@prisma/client-runtime-utils").Decimal | null;
        depositPaidAt: Date | null;
        balanceAmount: import("@prisma/client-runtime-utils").Decimal | null;
        balancePaidAt: Date | null;
        specialRequests: string | null;
    })[]>;
}
