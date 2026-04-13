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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const query_dto_1 = require("./dto/query.dto");
const ban_user_dto_1 = require("./dto/ban-user.dto");
const update_roles_dto_1 = require("./dto/update-roles.dto");
const reject_guide_dto_1 = require("./dto/reject-guide.dto");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const swagger_2 = require("@nestjs/swagger");
class GuidesQueryDto extends query_dto_1.PaginationQueryDto {
    status;
}
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ enum: client_1.VerificationStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.VerificationStatus),
    __metadata("design:type", String)
], GuidesQueryDto.prototype, "status", void 0);
class TourBookingsQueryDto extends query_dto_1.PaginationQueryDto {
    status;
    guideId;
}
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ enum: client_1.TourBookingStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.TourBookingStatus),
    __metadata("design:type", String)
], TourBookingsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ description: 'Filter by guide profile ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TourBookingsQueryDto.prototype, "guideId", void 0);
class ServiceBookingsQueryDto extends query_dto_1.PaginationQueryDto {
    status;
    guideId;
}
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ enum: client_1.BookingStatus }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BookingStatus),
    __metadata("design:type", String)
], ServiceBookingsQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_2.ApiPropertyOptional)({ description: 'Filter by guide profile ID' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ServiceBookingsQueryDto.prototype, "guideId", void 0);
let AdminController = class AdminController {
    adminService;
    config;
    constructor(adminService, config) {
        this.adminService = adminService;
        this.config = config;
    }
    getDashboard() {
        return this.adminService.getDashboardStats();
    }
    getIntegrationStatus() {
        const g = (key) => this.config.get(key);
        const stripeKey = g('STRIPE_SECRET_KEY') ?? '';
        const resendKey = g('RESEND_API_KEY') ?? '';
        const personaKey = g('PERSONA_API_KEY') ?? '';
        const awsKey = g('AWS_ACCESS_KEY_ID') ?? '';
        const awsBucket = g('AWS_S3_BUCKET') ?? '';
        const claudeKey = g('ANTHROPIC_API_KEY') ?? '';
        const algoliaId = g('ALGOLIA_APP_ID') ?? '';
        const zoomId = g('ZOOM_ACCOUNT_ID') ?? '';
        const calendlyId = g('CALENDLY_CLIENT_ID') ?? '';
        const isSet = (v) => !!v && !v.startsWith('your-');
        return [
            {
                name: 'API Server',
                description: 'NestJS 11 REST API',
                detail: `http://localhost:${g('PORT') ?? 3001}`,
                status: 'operational',
            },
            {
                name: 'PostgreSQL',
                description: 'Primary database (Prisma ORM)',
                detail: 'PostgreSQL 16',
                status: 'operational',
            },
            {
                name: 'Stripe Connect',
                description: 'Payments & payouts',
                detail: stripeKey.startsWith('sk_live') ? 'Live mode' : 'Test mode — no charges',
                status: isSet(stripeKey) ? (stripeKey.startsWith('sk_live') ? 'operational' : 'test') : 'unconfigured',
            },
            {
                name: 'Resend',
                description: 'Transactional email',
                detail: isSet(resendKey) ? `From: ${g('EMAIL_FROM') ?? '—'}` : 'API key not set',
                status: isSet(resendKey) ? 'operational' : 'unconfigured',
            },
            {
                name: 'Persona',
                description: 'Identity verification',
                detail: personaKey.startsWith('persona_sandbox') ? 'Sandbox mode' : isSet(personaKey) ? 'Live mode' : 'API key not set',
                status: personaKey.startsWith('persona_sandbox') ? 'test' : isSet(personaKey) ? 'operational' : 'unconfigured',
            },
            {
                name: 'AWS S3 + CloudFront',
                description: 'File storage & CDN',
                detail: isSet(awsKey) ? `Bucket: ${awsBucket}` : 'Credentials not set',
                status: isSet(awsKey) && isSet(awsBucket) ? 'operational' : 'unconfigured',
            },
            {
                name: 'Anthropic Claude',
                description: 'AI Guide chatbot & NLP',
                detail: isSet(claudeKey) ? `Model: ${g('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6'}` : 'API key not set',
                status: isSet(claudeKey) ? 'operational' : 'unconfigured',
            },
            {
                name: 'Algolia',
                description: 'Guide & service search',
                detail: isSet(algoliaId) ? `App: ${algoliaId}` : 'App ID not set',
                status: isSet(algoliaId) ? 'operational' : 'unconfigured',
            },
            {
                name: 'Zoom',
                description: 'Virtual events & sessions',
                detail: isSet(zoomId) ? `Account: ${zoomId}` : 'Credentials not set',
                status: isSet(zoomId) ? 'operational' : 'unconfigured',
            },
            {
                name: 'Calendly',
                description: 'Calendar scheduling',
                detail: isSet(calendlyId) ? 'OAuth configured' : 'Client ID not set',
                status: isSet(calendlyId) ? 'operational' : 'unconfigured',
            },
        ];
    }
    getUsers(query) {
        return this.adminService.getUsers({
            page: query.page,
            limit: query.limit,
            search: query.search,
        });
    }
    getUserDetail(id) {
        return this.adminService.getUserDetail(id);
    }
    banUser(id, dto) {
        return this.adminService.banUser(id, dto.reason);
    }
    unbanUser(id) {
        return this.adminService.unbanUser(id);
    }
    setUserRoles(id, dto) {
        return this.adminService.setUserRoles(id, dto.roles);
    }
    getGuides(query) {
        return this.adminService.getGuides({
            page: query.page,
            limit: query.limit,
            search: query.search,
            status: query.status,
        });
    }
    getVerificationQueue(query) {
        return this.adminService.getVerificationQueue({
            page: query.page,
            limit: query.limit,
        });
    }
    approveGuide(guideId) {
        return this.adminService.approveGuide(guideId);
    }
    rejectGuide(guideId, dto) {
        return this.adminService.rejectGuide(guideId, dto.reason);
    }
    getTourBookings(query) {
        return this.adminService.getTourBookings({
            page: query.page,
            limit: query.limit,
            search: query.search,
            status: query.status,
            guideId: query.guideId,
        });
    }
    getServiceBookings(query) {
        return this.adminService.getServiceBookings({
            page: query.page,
            limit: query.limit,
            search: query.search,
            status: query.status,
            guideId: query.guideId,
        });
    }
    getGuideRevenue(query) {
        return this.adminService.getGuideRevenue({
            page: query.page,
            limit: query.limit,
            search: query.search,
        });
    }
    getFinancials(query) {
        return this.adminService.getFinancials({
            page: query.page,
            limit: query.limit,
        });
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Get admin dashboard KPIs' }),
    (0, swagger_1.ApiOkResponse)({ description: 'Dashboard statistics' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('integration-status'),
    (0, swagger_1.ApiOperation)({ summary: 'Live integration status derived from env config' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getIntegrationStatus", null);
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'List all users with pagination and search' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get detailed user info' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUserDetail", null);
__decorate([
    (0, common_1.Patch)('users/:id/ban'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Ban a user' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ban_user_dto_1.BanUserDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "banUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/unban'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Unban a user' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "unbanUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/roles'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Set user roles (replaces all existing roles)' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_roles_dto_1.UpdateRolesDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "setUserRoles", null);
__decorate([
    (0, common_1.Get)('guides'),
    (0, swagger_1.ApiOperation)({ summary: 'List all guide profiles' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [GuidesQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getGuides", null);
__decorate([
    (0, common_1.Get)('verification'),
    (0, swagger_1.ApiOperation)({ summary: 'Get pending verification queue' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getVerificationQueue", null);
__decorate([
    (0, common_1.Patch)('verification/:guideId/approve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Approve a guide verification' }),
    __param(0, (0, common_1.Param)('guideId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approveGuide", null);
__decorate([
    (0, common_1.Patch)('verification/:guideId/reject'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reject a guide verification' }),
    __param(0, (0, common_1.Param)('guideId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, reject_guide_dto_1.RejectGuideDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rejectGuide", null);
__decorate([
    (0, common_1.Get)('tour-bookings'),
    (0, swagger_1.ApiOperation)({ summary: 'List all tour bookings with filters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [TourBookingsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getTourBookings", null);
__decorate([
    (0, common_1.Get)('service-bookings'),
    (0, swagger_1.ApiOperation)({ summary: 'List all service bookings with filters' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ServiceBookingsQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getServiceBookings", null);
__decorate([
    (0, common_1.Get)('guide-revenue'),
    (0, swagger_1.ApiOperation)({ summary: 'Guide-wise revenue breakdown (services + tours)' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getGuideRevenue", null);
__decorate([
    (0, common_1.Get)('financials'),
    (0, swagger_1.ApiOperation)({ summary: 'Get financial overview and payment history' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getFinancials", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('Admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN', 'SUPER_ADMIN'),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService,
        config_1.ConfigService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map