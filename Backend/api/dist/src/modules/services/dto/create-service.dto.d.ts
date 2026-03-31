import { ServiceType } from '@prisma/client';
export declare class CreateServiceDto {
    name: string;
    description?: string;
    type: ServiceType;
    price: number;
    durationMin: number;
}
