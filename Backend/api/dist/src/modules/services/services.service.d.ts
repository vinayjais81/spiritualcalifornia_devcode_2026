import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
export declare class ServicesService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateServiceDto): Promise<{
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
    findByGuide(userId: string): Promise<{
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
    findByGuideId(guideId: string): Promise<{
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
    findOne(serviceId: string): Promise<{
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
    update(userId: string, serviceId: string, dto: UpdateServiceDto): Promise<{
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
    delete(userId: string, serviceId: string): Promise<{
        deleted: boolean;
    }>;
    activateAll(guideId: string): Promise<void>;
    private findGuideOrFail;
    private findServiceOrFail;
}
