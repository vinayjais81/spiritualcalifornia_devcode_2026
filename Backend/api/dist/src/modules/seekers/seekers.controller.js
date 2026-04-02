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
exports.SeekersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
const seekers_service_1 = require("./seekers.service");
let SeekersController = class SeekersController {
    seekersService;
    constructor(seekersService) {
        this.seekersService = seekersService;
    }
    getStatus(user) {
        return this.seekersService.getOnboardingStatus(user.id);
    }
    updateStep(user, body) {
        return this.seekersService.updateOnboardingStep(user.id, body.step, body.completed ?? false);
    }
    getMyProfile(user) {
        return this.seekersService.getMyProfile(user.id);
    }
    updateProfile(user, dto) {
        return this.seekersService.updateProfile(user.id, dto);
    }
    getDashboardStats(user) {
        return this.seekersService.getDashboardStats(user.id);
    }
    getPaymentHistory(user) {
        return this.seekersService.getPaymentHistory(user.id);
    }
    getFavorites(user) {
        return this.seekersService.getFavorites(user.id);
    }
    addFavorite(user, guideId) {
        return this.seekersService.addFavorite(user.id, guideId);
    }
    removeFavorite(user, guideId) {
        return this.seekersService.removeFavorite(user.id, guideId);
    }
};
exports.SeekersController = SeekersController;
__decorate([
    (0, common_1.Get)('onboarding/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Get seeker onboarding completion status' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Patch)('onboarding/step'),
    (0, swagger_1.ApiOperation)({ summary: 'Save seeker onboarding progress' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "updateStep", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "Get seeker's own profile" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Update seeker profile' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('dashboard/stats'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Get seeker dashboard stats' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "getDashboardStats", null);
__decorate([
    (0, common_1.Get)('payments'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "Get seeker's payment history" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "getPaymentHistory", null);
__decorate([
    (0, common_1.Get)('favorites'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "Get seeker's favorite guides" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "getFavorites", null);
__decorate([
    (0, common_1.Post)('favorites/:guideId'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Add a guide to favorites' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('guideId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.Delete)('favorites/:guideId'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Remove a guide from favorites' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('guideId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SeekersController.prototype, "removeFavorite", null);
exports.SeekersController = SeekersController = __decorate([
    (0, swagger_1.ApiTags)('Seekers'),
    (0, common_1.Controller)('seekers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [seekers_service_1.SeekersService])
], SeekersController);
//# sourceMappingURL=seekers.controller.js.map