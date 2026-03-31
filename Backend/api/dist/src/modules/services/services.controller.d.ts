import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesController {
    private readonly servicesService;
    constructor(servicesService: ServicesService);
    create(user: CurrentUserData, dto: CreateServiceDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        guideId: string;
        type: import(".prisma/client").$Enums.ServiceType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        durationMin: number;
    }>;
    findMine(user: CurrentUserData): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        guideId: string;
        type: import(".prisma/client").$Enums.ServiceType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        durationMin: number;
    }[]>;
    findOne(id: string): Promise<{
        guide: {
            id: string;
            slug: string;
            user: {
                avatarUrl: string | null;
            };
            displayName: string;
            isVerified: boolean;
        };
    } & {
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        guideId: string;
        type: import(".prisma/client").$Enums.ServiceType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        durationMin: number;
    }>;
    update(user: CurrentUserData, id: string, dto: UpdateServiceDto): Promise<{
        id: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        guideId: string;
        type: import(".prisma/client").$Enums.ServiceType;
        price: import("@prisma/client-runtime-utils").Decimal;
        currency: string;
        durationMin: number;
    }>;
    delete(user: CurrentUserData, id: string): Promise<{
        deleted: boolean;
    }>;
}
