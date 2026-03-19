import { PrismaService } from '../../database/prisma.service';
export declare class SeekersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getOnboardingStatus(userId: string): Promise<{
        step: number;
        completed: boolean;
    }>;
    updateOnboardingStep(userId: string, step: number, completed?: boolean): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        bio: string | null;
        location: string | null;
        timezone: string | null;
        interests: string[];
        onboardingStep: number;
        onboardingCompleted: boolean;
        userId: string;
    }>;
}
