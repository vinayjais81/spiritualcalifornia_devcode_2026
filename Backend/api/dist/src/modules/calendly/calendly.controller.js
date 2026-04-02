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
exports.CalendlyController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const calendly_service_1 = require("./calendly.service");
let CalendlyController = class CalendlyController {
    calendlyService;
    constructor(calendlyService) {
        this.calendlyService = calendlyService;
    }
    getStatus(user) {
        return this.calendlyService.getConnectionStatus(user.id);
    }
    getEventTypes(user) {
        return this.calendlyService.getEventTypes(user.id);
    }
    getScheduledEvents(user) {
        const now = new Date().toISOString();
        return this.calendlyService.getScheduledEvents(user.id, {
            status: 'active',
            minStartTime: now,
            count: 20,
        });
    }
    getSchedulingLink(user) {
        return this.calendlyService.getSchedulingLink(user.id);
    }
    disconnect(user) {
        return this.calendlyService.disconnect(user.id);
    }
    getPublicBookingInfo(slug) {
        return this.calendlyService.getPublicSchedulingInfo(slug);
    }
    handleWebhook(body, signature) {
        return this.calendlyService.handleWebhookEvent(body, signature);
    }
};
exports.CalendlyController = CalendlyController;
__decorate([
    (0, common_1.Get)('status'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Get Calendly connection status' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('event-types'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "List guide's Calendly event types" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "getEventTypes", null);
__decorate([
    (0, common_1.Get)('events'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "List guide's upcoming Calendly events" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "getScheduledEvents", null);
__decorate([
    (0, common_1.Get)('scheduling-link'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "Get guide's scheduling link for embedding" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "getSchedulingLink", null);
__decorate([
    (0, common_1.Post)('disconnect'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Disconnect Calendly integration' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "disconnect", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('book/:slug'),
    (0, swagger_1.ApiOperation)({ summary: 'Get public booking info for a guide (services + scheduling link)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guide booking info' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Guide not found' }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "getPublicBookingInfo", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Receive Calendly webhook events' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('calendly-webhook-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CalendlyController.prototype, "handleWebhook", null);
exports.CalendlyController = CalendlyController = __decorate([
    (0, swagger_1.ApiTags)('Calendly'),
    (0, common_1.Controller)('calendly'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [calendly_service_1.CalendlyService])
], CalendlyController);
//# sourceMappingURL=calendly.controller.js.map