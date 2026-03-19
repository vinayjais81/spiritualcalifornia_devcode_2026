import { PrismaService } from '../../database/prisma.service';
import { Role, User } from '@prisma/client';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<({
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }) | null>;
    findByEmail(email: string): Promise<({
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }) | null>;
    findByIdOrThrow(id: string): Promise<{
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }>;
    create(data: {
        email: string;
        passwordHash?: string;
        firstName: string;
        lastName: string;
        googleId?: string;
    }): Promise<{
        roles: {
            id: string;
            createdAt: Date;
            role: import(".prisma/client").$Enums.Role;
            userId: string;
        }[];
    } & {
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }>;
    update(id: string, data: Partial<Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'phone' | 'isEmailVerified' | 'isActive' | 'isBanned' | 'bannedReason' | 'emailVerifyToken' | 'emailVerifyExpiry' | 'passwordResetToken' | 'passwordResetExpiry' | 'passwordHash' | 'lastLoginAt' | 'marketingEmails'>>): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        email: string;
        googleId: string | null;
        passwordHash: string | null;
        firstName: string;
        lastName: string;
        avatarUrl: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isBanned: boolean;
        bannedReason: string | null;
        emailVerifyToken: string | null;
        emailVerifyExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        lastLoginAt: Date | null;
        marketingEmails: boolean;
        updatedAt: Date;
    }>;
    assignRole(userId: string, role: Role): Promise<{
        id: string;
        createdAt: Date;
        role: import(".prisma/client").$Enums.Role;
        userId: string;
    }>;
    removeRole(userId: string, role: Role): Promise<import(".prisma/client").Prisma.BatchPayload>;
    getRoles(userId: string): Promise<Role[]>;
    createSeekerProfile(userId: string, location?: string): Promise<{
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
    updateSeekerProfile(userId: string, data: {
        interests?: string[];
        location?: string;
        bio?: string;
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
    findAll(params: {
        page: number;
        limit: number;
        search?: string;
    }): Promise<{
        users: ({
            roles: {
                id: string;
                createdAt: Date;
                role: import(".prisma/client").$Enums.Role;
                userId: string;
            }[];
        } & {
            id: string;
            isActive: boolean;
            createdAt: Date;
            email: string;
            googleId: string | null;
            passwordHash: string | null;
            firstName: string;
            lastName: string;
            avatarUrl: string | null;
            phone: string | null;
            isEmailVerified: boolean;
            isBanned: boolean;
            bannedReason: string | null;
            emailVerifyToken: string | null;
            emailVerifyExpiry: Date | null;
            passwordResetToken: string | null;
            passwordResetExpiry: Date | null;
            lastLoginAt: Date | null;
            marketingEmails: boolean;
            updatedAt: Date;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
