import { UsersService } from './users.service';
import { CurrentUserData } from '../auth/decorators/current-user.decorator';
declare class UpdateSeekerProfileDto {
    interests?: string[];
    location?: string;
    bio?: string;
}
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    updateSeekerProfile(user: CurrentUserData, dto: UpdateSeekerProfileDto): Promise<{
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
export {};
