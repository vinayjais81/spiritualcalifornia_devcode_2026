"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VerificationController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const verification_service_1 = require("./verification.service");
const crypto_1 = require("crypto");
let VerificationController = VerificationController_1 = class VerificationController {
    verificationService;
    config;
    logger = new common_1.Logger(VerificationController_1.name);
    constructor(verificationService, config) {
        this.verificationService = verificationService;
        this.config = config;
    }
    async personaWebhook(req, body, signatureHeader) {
        const webhookSecret = this.config.get('PERSONA_WEBHOOK_SECRET', '');
        if (webhookSecret) {
            if (!signatureHeader) {
                throw new common_1.UnauthorizedException('Missing Persona-Signature header');
            }
            const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
            const timestamp = parts['t'];
            const receivedSig = parts['v1'];
            if (!timestamp || !receivedSig) {
                throw new common_1.UnauthorizedException('Malformed Persona-Signature header');
            }
            const age = Date.now() / 1000 - parseInt(timestamp, 10);
            if (age > 300) {
                throw new common_1.UnauthorizedException('Persona webhook replay detected — timestamp too old');
            }
            const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
            const expectedSig = (0, crypto_1.createHmac)('sha256', webhookSecret)
                .update(`${timestamp}.${rawBody.toString()}`)
                .digest('hex');
            const expected = Buffer.from(expectedSig, 'hex');
            const received = Buffer.from(receivedSig, 'hex');
            if (expected.length !== received.length || !(0, crypto_1.timingSafeEqual)(expected, received)) {
                this.logger.warn('[Persona] Webhook signature mismatch — rejecting');
                throw new common_1.UnauthorizedException('Invalid Persona webhook signature');
            }
        }
        else {
            this.logger.warn('[Persona] PERSONA_WEBHOOK_SECRET not set — skipping signature check');
        }
        const eventType = body?.data?.type ?? '';
        const inquiryId = body?.data?.id ?? '';
        if (!inquiryId) {
            throw new common_1.BadRequestException('Missing inquiry id in Persona webhook payload');
        }
        let status = 'needs_review';
        if (eventType === 'inquiry.approved')
            status = 'approved';
        else if (eventType === 'inquiry.declined')
            status = 'declined';
        await this.verificationService.handlePersonaWebhook({ inquiryId, status });
        return { received: true };
    }
    async startIdentityVerification(req) {
        const userId = req.user?.id;
        return this.verificationService.startIdentityVerification(userId);
    }
    getPendingReviews() {
        return this.verificationService.getPendingReviews();
    }
    async approveGuide(guideId, body) {
        await this.verificationService.reviewGuide(guideId, 'approve', body?.notes);
        return { message: 'Guide approved and published' };
    }
    async rejectGuide(guideId, body) {
        await this.verificationService.reviewGuide(guideId, 'reject', body?.notes);
        return { message: 'Guide verification rejected' };
    }
};
exports.VerificationController = VerificationController;
__decorate([
    (0, common_1.Post)('persona/webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: '[Persona] Receive identity verification webhook' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('persona-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], VerificationController.prototype, "personaWebhook", null);
__decorate([
    (0, common_1.Post)('identity/start'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Start a Persona identity verification inquiry' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VerificationController.prototype, "startIdentityVerification", null);
__decorate([
    (0, common_1.Get)('queue'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'List all guides pending verification review' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VerificationController.prototype, "getPendingReviews", null);
__decorate([
    (0, common_1.Post)('guides/:guideId/approve'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a guide after credential + identity review' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guide approved and published' }),
    __param(0, (0, common_1.Param)('guideId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], VerificationController.prototype, "approveGuide", null);
__decorate([
    (0, common_1.Post)('guides/:guideId/reject'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a guide verification request' }),
    __param(0, (0, common_1.Param)('guideId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], VerificationController.prototype, "rejectGuide", null);
exports.VerificationController = VerificationController = VerificationController_1 = __decorate([
    (0, swagger_1.ApiTags)('Verification'),
    (0, common_1.Controller)('verification'),
    __metadata("design:paramtypes", [verification_service_1.VerificationService,
        config_1.ConfigService])
], VerificationController);
//# sourceMappingURL=verification.controller.js.map