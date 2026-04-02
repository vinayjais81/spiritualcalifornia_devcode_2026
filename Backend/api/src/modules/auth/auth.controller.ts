import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { StrictThrottle } from '../../common/throttle.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ───────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @StrictThrottle()
  @ApiOperation({ summary: 'Register a new seeker account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @StrictThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  // ─── Refresh Token ──────────────────────────────────────────────────────────

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh_token')
  @ApiOperation({ summary: 'Refresh access token using httpOnly cookie' })
  async refresh(
    @CurrentUser() user: CurrentUserData & { refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshTokens(user.id, user.refreshToken);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(
    @CurrentUser() user: CurrentUserData & { refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (user?.refreshToken) {
      await this.authService.logout(user.id, user.refreshToken);
    }
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }

  // ─── Verify Email ───────────────────────────────────────────────────────────

  @Public()
  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address via token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // ─── Forgot Password ────────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // ─── Reset Password ─────────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token from email' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  // ─── Me ─────────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: CurrentUserData) {
    return user;
  }

  // ─── Google OAuth ────────────────────────────────────────────────────────────

  /**
   * GET /auth/google
   * Redirects the browser to Google's OAuth consent screen.
   */
  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleAuth() {
    // Passport redirects automatically — no body needed
  }

  /**
   * GET /auth/google/callback
   * Google redirects here after the user authorises.
   * Exchanges the profile for a JWT and redirects the browser back to the frontend.
   */
  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: '[Google] OAuth callback' })
  async googleCallback(@CurrentUser() googleUser: any, @Res() res: Response) {
    const result = await this.authService.loginWithGoogle(googleUser);
    this.setRefreshTokenCookie(res as any, result.refreshToken);

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const newFlag = result.isNewUser ? '&new=1' : '';
    const redirect = `${frontendUrl}/auth/google/success?token=${encodeURIComponent(result.accessToken)}&roles=${encodeURIComponent(result.user.roles.join(','))}${newFlag}`;
    return (res as any).redirect(redirect);
  }

  // ─── Calendly OAuth ─────────────────────────────────────────────────────────

  /**
   * GET /auth/calendly/auth-url
   * Returns the Calendly OAuth authorization URL for the authenticated guide.
   */
  @Get('calendly/auth-url')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Calendly OAuth authorization URL' })
  async calendlyAuthUrl(
    @CurrentUser() user: CurrentUserData,
    @Query('redirectTo') redirectTo?: string,
  ) {
    return this.authService.getCalendlyAuthUrl(user.id, redirectTo);
  }

  /**
   * GET /auth/calendly/callback
   * Calendly redirects here after the guide authorizes.
   * Exchanges code for tokens and redirects back to the onboarding wizard.
   */
  @Public()
  @Get('calendly/callback')
  @ApiOperation({ summary: '[Calendly] OAuth callback — exchanges code for tokens' })
  async calendlyCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.authService.handleCalendlyCallback(code, state);
    return res.redirect(redirectUrl);
  }

  // ─── Helper ─────────────────────────────────────────────────────────────────

  private setRefreshTokenCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      // sameSite 'none' + secure required for cross-origin cookies in dev
      // (localhost:3000 → localhost:3001). In production behind a reverse proxy
      // (same domain), use 'strict'.
      secure: isProd ? true : false,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
}
