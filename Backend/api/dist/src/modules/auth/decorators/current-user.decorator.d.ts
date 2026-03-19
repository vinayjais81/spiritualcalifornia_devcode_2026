import { Role } from '@prisma/client';
export interface CurrentUserData {
    id: string;
    email: string;
    roles: Role[];
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    isEmailVerified: boolean;
}
export declare const CurrentUser: (...dataOrPipes: unknown[]) => ParameterDecorator;
