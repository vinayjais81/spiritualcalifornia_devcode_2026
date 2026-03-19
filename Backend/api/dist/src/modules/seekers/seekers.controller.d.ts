import { CurrentUserData } from '../auth/decorators/current-user.decorator';
import { SeekersService } from './seekers.service';
export declare class SeekersController {
    private readonly seekersService;
    constructor(seekersService: SeekersService);
    getStatus(user: CurrentUserData): Promise<{
        step: number;
        completed: boolean;
    }>;
    updateStep(user: CurrentUserData, body: {
        step: number;
        completed?: boolean;
    }): Promise<{
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
