import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
export declare class AuthService {
    private readonly prisma;
    private readonly usersService;
    private readonly jwtService;
    private readonly configService;
    private readonly logger;
    constructor(prisma: PrismaService, usersService: UsersService, jwtService: JwtService, configService: ConfigService);
    register(dto: RegisterDto): Promise<{
        user: any;
        accessToken: string;
        refreshToken: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: any;
        accessToken: string;
        refreshToken: string;
    }>;
    loginWithGoogle(googleUser: {
        googleId: string;
        email: string;
        firstName: string;
        lastName: string;
    }): Promise<{
        user: any;
        accessToken: string;
        refreshToken: string;
        isNewUser: boolean;
    }>;
    refreshTokens(userId: string, incomingRefreshToken: string): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    logout(userId: string, refreshToken: string): Promise<void>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
    getCalendlyAuthUrl(userId: string, redirectTo?: string): Promise<{
        url: string;
    }>;
    handleCalendlyCallback(code: string, state: string): Promise<string>;
    generateTokens(userId: string, email: string, roles: Role[]): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    private saveRefreshToken;
    sanitizeUser(user: any): any;
    private sendVerificationEmail;
    private sendPasswordResetEmail;
}
