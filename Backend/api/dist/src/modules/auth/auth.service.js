"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../database/prisma.service");
const users_service_1 = require("../users/users.service");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const resend_1 = require("resend");
let AuthService = AuthService_1 = class AuthService {
    prisma;
    usersService;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, usersService, jwtService, configService) {
        this.prisma = prisma;
        this.usersService = usersService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async register(dto) {
        const existing = await this.usersService.findByEmail(dto.email);
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const emailVerifyToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const emailVerifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await this.usersService.create({
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
        });
        await Promise.all([
            this.usersService.update(user.id, {
                emailVerifyToken,
                emailVerifyExpiry,
                ...(dto.phone ? { phone: dto.phone } : {}),
                ...(dto.newsletterOptIn !== undefined ? { marketingEmails: dto.newsletterOptIn } : {}),
            }),
            this.usersService.createSeekerProfile(user.id, dto.location),
            this.usersService.assignRole(user.id, client_1.Role.SEEKER),
        ]);
        void this.sendVerificationEmail(user.email, user.firstName, emailVerifyToken);
        const roles = [client_1.Role.SEEKER];
        const tokens = await this.generateTokens(user.id, user.email, roles);
        await this.saveRefreshToken(user.id, tokens.refreshToken);
        return {
            user: this.sanitizeUser({ ...user, roles: [{ role: client_1.Role.SEEKER }] }),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    async login(dto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!user.passwordHash)
            throw new common_1.UnauthorizedException('Please use social login');
        if (!user.isActive || user.isBanned)
            throw new common_1.UnauthorizedException('Account suspended');
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        await this.usersService.update(user.id, { lastLoginAt: new Date() });
        const roles = user.roles.map((r) => r.role);
        const tokens = await this.generateTokens(user.id, user.email, roles);
        await this.saveRefreshToken(user.id, tokens.refreshToken);
        return {
            user: this.sanitizeUser(user),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }
    async loginWithGoogle(googleUser) {
        let user = await this.prisma.user.findFirst({
            where: {
                OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }],
            },
            include: { roles: true },
        });
        let isNewUser = false;
        if (user) {
            if (!user.googleId) {
                await this.usersService.update(user.id, { lastLoginAt: new Date() });
                await this.prisma.user.update({ where: { id: user.id }, data: { googleId: googleUser.googleId } });
            }
            else {
                await this.usersService.update(user.id, { lastLoginAt: new Date() });
            }
        }
        else {
            isNewUser = true;
            user = await this.usersService.create({
                email: googleUser.email,
                firstName: googleUser.firstName,
                lastName: googleUser.lastName,
                googleId: googleUser.googleId,
            });
            await Promise.all([
                this.usersService.createSeekerProfile(user.id),
                this.usersService.assignRole(user.id, client_1.Role.SEEKER),
            ]);
            user = await this.prisma.user.findUnique({ where: { id: user.id }, include: { roles: true } });
        }
        const roles = user.roles.map((r) => r.role);
        const tokens = await this.generateTokens(user.id, user.email, roles);
        await this.saveRefreshToken(user.id, tokens.refreshToken);
        return {
            user: this.sanitizeUser(user),
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isNewUser,
        };
    }
    async refreshTokens(userId, incomingRefreshToken) {
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token: incomingRefreshToken },
        });
        if (!storedToken || storedToken.userId !== userId || storedToken.isRevoked) {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        if (storedToken.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token expired');
        }
        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { isRevoked: true },
        });
        const roles = await this.usersService.getRoles(userId);
        const user = await this.usersService.findByIdOrThrow(userId);
        const tokens = await this.generateTokens(userId, user.email, roles);
        await this.saveRefreshToken(userId, tokens.refreshToken);
        return tokens;
    }
    async logout(userId, refreshToken) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, token: refreshToken, isRevoked: false },
            data: { isRevoked: true },
        });
    }
    async verifyEmail(token) {
        const user = await this.prisma.user.findFirst({
            where: { emailVerifyToken: token },
        });
        if (!user)
            throw new common_1.BadRequestException('Invalid verification token');
        if (user.emailVerifyExpiry && user.emailVerifyExpiry < new Date()) {
            throw new common_1.BadRequestException('Verification token expired');
        }
        await this.usersService.update(user.id, {
            isEmailVerified: true,
            emailVerifyToken: null,
            emailVerifyExpiry: null,
        });
        return { message: 'Email verified successfully' };
    }
    async forgotPassword(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user)
            return { message: 'If that email exists, a reset link has been sent' };
        const resetToken = (0, crypto_1.randomBytes)(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await this.usersService.update(user.id, {
            passwordResetToken: resetToken,
            passwordResetExpiry: resetExpiry,
        });
        void this.sendPasswordResetEmail(user.email, user.firstName, resetToken);
        return { message: 'If that email exists, a reset link has been sent' };
    }
    async resetPassword(token, newPassword) {
        const user = await this.prisma.user.findFirst({
            where: { passwordResetToken: token },
        });
        if (!user)
            throw new common_1.BadRequestException('Invalid or expired reset token');
        if (user.passwordResetExpiry && user.passwordResetExpiry < new Date()) {
            throw new common_1.BadRequestException('Reset token expired');
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.usersService.update(user.id, {
            passwordHash,
            passwordResetToken: null,
            passwordResetExpiry: null,
        });
        await this.prisma.refreshToken.updateMany({
            where: { userId: user.id },
            data: { isRevoked: true },
        });
        return { message: 'Password reset successfully' };
    }
    async getCalendlyAuthUrl(userId, redirectTo) {
        const clientId = this.configService.get('CALENDLY_CLIENT_ID', '');
        const redirectUri = this.configService.get('CALENDLY_REDIRECT_URI', '');
        const state = await this.jwtService.signAsync({ sub: userId, purpose: 'calendly_oauth', redirectTo: redirectTo || '/onboarding/guide' }, { secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: '10m' });
        const params = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            state,
        });
        return { url: `https://auth.calendly.com/oauth/authorize?${params.toString()}` };
    }
    async handleCalendlyCallback(code, state) {
        const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
        let userId;
        let redirectTo = '/onboarding/guide';
        try {
            const payload = await this.jwtService.verifyAsync(state, {
                secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
            });
            if (payload.purpose !== 'calendly_oauth')
                throw new Error('Invalid state purpose');
            userId = payload.sub;
            redirectTo = payload.redirectTo || '/onboarding/guide';
        }
        catch {
            this.logger.warn('[Calendly] Invalid OAuth state — rejecting callback');
            return `${frontendUrl}/onboarding/guide?calendly=error`;
        }
        const clientId = this.configService.get('CALENDLY_CLIENT_ID', '');
        const clientSecret = this.configService.get('CALENDLY_CLIENT_SECRET', '');
        const redirectUri = this.configService.get('CALENDLY_REDIRECT_URI', '');
        const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });
        if (!tokenRes.ok) {
            const errText = await tokenRes.text();
            this.logger.error(`[Calendly] Token exchange failed: ${tokenRes.status} ${errText}`);
            return `${frontendUrl}${redirectTo}?calendly=error`;
        }
        const tokens = await tokenRes.json();
        const accessToken = tokens.access_token;
        const refreshToken = tokens.refresh_token ?? '';
        const meRes = await fetch('https://api.calendly.com/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        let userUri = '';
        if (meRes.ok) {
            const me = await meRes.json();
            userUri = me.resource?.uri ?? '';
        }
        let schedulingUrl = '';
        if (userUri) {
            try {
                const etRes = await fetch(`https://api.calendly.com/event_types?user=${userUri}&active=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (etRes.ok) {
                    const etData = await etRes.json();
                    schedulingUrl = etData.collection?.[0]?.scheduling_url ?? '';
                }
            }
            catch {
                this.logger.warn('[Calendly] Failed to fetch event types for scheduling URL');
            }
        }
        await this.prisma.guideProfile.update({
            where: { userId },
            data: {
                calendarType: 'Calendly',
                calendarLink: schedulingUrl || undefined,
                calendlyConnected: true,
                calendlyAccessToken: accessToken,
                calendlyRefreshToken: refreshToken,
                calendlyUserUri: userUri,
            },
        });
        this.logger.log(`[Calendly] Connected for userId=${userId}, schedulingUrl=${schedulingUrl}`);
        return `${frontendUrl}${redirectTo}?calendly=connected`;
    }
    async generateTokens(userId, email, roles) {
        const payload = { sub: userId, email, roles };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
                expiresIn: '15m',
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
                expiresIn: '7d',
            }),
        ]);
        return { accessToken, refreshToken };
    }
    async saveRefreshToken(userId, token) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.prisma.refreshToken.create({ data: { userId, token, expiresAt } });
    }
    sanitizeUser(user) {
        const { passwordHash, emailVerifyToken, passwordResetToken, ...safe } = user;
        return {
            ...safe,
            roles: (user.roles ?? []).map((r) => r.role ?? r),
        };
    }
    async sendVerificationEmail(email, name, token) {
        const resendKey = this.configService.get('RESEND_API_KEY', '');
        const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
        const fromEmail = this.configService.get('EMAIL_FROM', 'noreply@spiritualcalifornia.com');
        if (!resendKey || resendKey.includes('placeholder')) {
            this.logger.warn(`[DEV] Email verify link for ${email}: ${frontendUrl}/verify-email?token=${token}`);
            return;
        }
        const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;
        const resend = new resend_1.Resend(resendKey);
        try {
            await Promise.race([
                resend.emails.send({
                    from: `Spiritual California <${fromEmail}>`,
                    to: email,
                    subject: 'Verify your email — Spiritual California',
                    html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
          <body style="margin:0;padding:0;background:#FAFAF7;font-family:'Inter',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 20px;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid rgba(232,184,75,0.2);overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#3A3530,#5A4A3A);padding:32px 40px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#E8B84B;letter-spacing:0.04em;">Spiritual California</p>
                      <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.5);">mind · body · soul</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E8B84B;">Almost There</p>
                      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#3A3530;line-height:1.2;">
                        Check your<br/><em style="color:#E8B84B;font-style:italic;">inbox</em>
                      </h1>
                      <p style="margin:0 0 28px;font-size:14px;color:#8A8278;line-height:1.7;">
                        Hi ${name}, welcome to Spiritual California. Click the button below to verify your email address and activate your account.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="background:#3A3530;border-radius:8px;">
                            <a href="${verifyUrl}" style="display:inline-block;padding:14px 36px;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;color:#B5AFA8;">Or copy and paste this link into your browser:</p>
                      <p style="margin:0;font-size:12px;color:#E8B84B;word-break:break-all;">${verifyUrl}</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px 28px;border-top:1px solid rgba(232,184,75,0.12);">
                      <p style="margin:0;font-size:12px;color:#C4BDB5;line-height:1.6;">
                        This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Resend timeout after 10s')), 10_000)),
            ]);
            this.logger.log(`Verification email sent to ${email}`);
        }
        catch (err) {
            this.logger.error(`Failed to send verification email to ${email}: ${err?.message}`);
        }
    }
    async sendPasswordResetEmail(email, name, token) {
        const resendKey = this.configService.get('RESEND_API_KEY', '');
        const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
        const fromEmail = this.configService.get('EMAIL_FROM', 'noreply@spiritualcalifornia.com');
        if (!resendKey || resendKey.includes('placeholder')) {
            this.logger.warn(`[DEV] Password reset link for ${email}: ${frontendUrl}/reset-password?token=${token}`);
            return;
        }
        const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
        const resend = new resend_1.Resend(resendKey);
        try {
            await Promise.race([
                resend.emails.send({
                    from: `Spiritual California <${fromEmail}>`,
                    to: email,
                    subject: 'Reset your password — Spiritual California',
                    html: `
          <!DOCTYPE html>
          <html lang="en">
          <head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
          <body style="margin:0;padding:0;background:#FAFAF7;font-family:'Inter',sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF7;padding:40px 20px;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;border:1px solid rgba(232,184,75,0.2);overflow:hidden;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#3A3530,#5A4A3A);padding:32px 40px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#E8B84B;letter-spacing:0.04em;">Spiritual California</p>
                      <p style="margin:6px 0 0;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.5);">mind · body · soul</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#E8B84B;">Password Reset</p>
                      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:30px;font-weight:400;color:#3A3530;line-height:1.2;">
                        Reset your<br/><em style="color:#E8B84B;font-style:italic;">password</em>
                      </h1>
                      <p style="margin:0 0 28px;font-size:14px;color:#8A8278;line-height:1.7;">
                        Hi ${name}, we received a request to reset your password. Click the button below. This link expires in 1 hour.
                      </p>
                      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                        <tr>
                          <td style="background:#3A3530;border-radius:8px;">
                            <a href="${resetUrl}" style="display:inline-block;padding:14px 36px;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:13px;color:#B5AFA8;">Or copy and paste this link:</p>
                      <p style="margin:0;font-size:12px;color:#E8B84B;word-break:break-all;">${resetUrl}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 40px 28px;border-top:1px solid rgba(232,184,75,0.12);">
                      <p style="margin:0;font-size:12px;color:#C4BDB5;line-height:1.6;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
          </html>
        `,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Resend timeout after 10s')), 10_000)),
            ]);
            this.logger.log(`Password reset email sent to ${email}`);
        }
        catch (err) {
            this.logger.error(`Failed to send password reset email to ${email}: ${err?.message}`);
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map