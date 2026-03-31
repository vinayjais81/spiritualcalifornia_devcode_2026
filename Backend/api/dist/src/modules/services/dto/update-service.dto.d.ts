import { ServiceType } from '@prisma/client';
export declare class UpdateServiceDto {
    name?: string;
    description?: string;
    type?: ServiceType;
    price?: number;
    durationMin?: number;
    isActive?: boolean;
}
