import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUserData } from './decorators/current-user.decorator';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(dto: RegisterDto, res: Response): Promise<{
        user: any;
        accessToken: string;
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        user: any;
        accessToken: string;
    }>;
    refresh(user: CurrentUserData & {
        refreshToken: string;
    }, res: Response): Promise<{
        accessToken: string;
    }>;
    logout(user: CurrentUserData & {
        refreshToken: string;
    }, res: Response): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    me(user: CurrentUserData): Promise<CurrentUserData>;
    changePassword(user: CurrentUserData, body: {
        currentPassword: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    googleAuth(): void;
    googleCallback(googleUser: any, res: Response): Promise<any>;
    calendlyAuthUrl(user: CurrentUserData, redirectTo?: string): Promise<{
        url: string;
    }>;
    calendlyCallback(code: string, state: string, res: Response): Promise<void>;
    private setRefreshTokenCookie;
}
