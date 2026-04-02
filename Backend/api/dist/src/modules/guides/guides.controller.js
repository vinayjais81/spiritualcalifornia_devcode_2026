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
exports.GuidesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const guides_service_1 = require("./guides.service");
const verification_service_1 = require("../verification/verification.service");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const set_categories_dto_1 = require("./dto/set-categories.dto");
const add_credential_dto_1 = require("./dto/add-credential.dto");
const set_calendar_dto_1 = require("./dto/set-calendar.dto");
const set_availability_dto_1 = require("./dto/set-availability.dto");
let GuidesController = class GuidesController {
    guidesService;
    verificationService;
    constructor(guidesService, verificationService) {
        this.guidesService = guidesService;
        this.verificationService = verificationService;
    }
    listCategories() {
        return this.guidesService.listCategories();
    }
    getPublicProfile(slug) {
        return this.guidesService.getPublicProfile(slug);
    }
    getMyProfile(user) {
        return this.guidesService.getMyProfile(user.id);
    }
    getStatus(user) {
        return this.guidesService.getOnboardingStatus(user.id);
    }
    startOnboarding(user) {
        return this.guidesService.startOnboarding(user.id);
    }
    setCategories(user, dto) {
        return this.guidesService.setCategories(user.id, dto);
    }
    updateProfile(user, dto) {
        return this.guidesService.updateProfile(user.id, dto);
    }
    addCredential(user, dto) {
        return this.guidesService.addCredential(user.id, dto);
    }
    deleteCredential(user, credentialId) {
        return this.guidesService.deleteCredential(user.id, credentialId);
    }
    saveCalendar(user, dto) {
        return this.guidesService.saveCalendarSettings(user.id, dto);
    }
    async submitOnboarding(user) {
        const guide = await this.guidesService.submitOnboarding(user.id);
        await this.verificationService.enqueueGuideVerification(guide.id);
        return guide;
    }
    getAvailability(user) {
        return this.guidesService.getAvailability(user.id);
    }
    setAvailability(user, dto) {
        return this.guidesService.setAvailability(user.id, dto);
    }
    getBookableSlots(user) {
        return this.guidesService.generateBookableSlots(user.id, 14);
    }
    getGuideServices(slug) {
        return this.guidesService.getPublicServices(slug);
    }
};
exports.GuidesController = GuidesController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('categories'),
    (0, swagger_1.ApiOperation)({ summary: 'List all active categories with subcategories' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "listCategories", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('profile/:slug'),
    (0, swagger_1.ApiOperation)({ summary: 'Get public guide profile by slug' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guide public profile' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Guide not found' }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getPublicProfile", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: "Get the authenticated guide's own editable profile" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guide profile' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Get)('onboarding/status'),
    (0, swagger_1.ApiOperation)({ summary: 'Get onboarding status for the authenticated user' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Post)('onboarding/start'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 0 — Create guide profile and assign GUIDE role' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Guide profile created' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "startOnboarding", null);
__decorate([
    (0, common_1.Put)('onboarding/categories'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 1 — Set practice categories and subcategories' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_categories_dto_1.SetCategoriesDto]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "setCategories", null);
__decorate([
    (0, common_1.Put)('onboarding/profile'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 2 — Update guide profile (bio, photo, location, etc.)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_profile_dto_1.UpdateGuideProfileDto]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)('onboarding/credentials'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 3 — Add a credential/certification document' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, add_credential_dto_1.AddCredentialDto]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "addCredential", null);
__decorate([
    (0, common_1.Delete)('onboarding/credentials/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 3 — Remove a credential document' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "deleteCredential", null);
__decorate([
    (0, common_1.Put)('onboarding/calendar'),
    (0, swagger_1.ApiOperation)({ summary: 'Step 5 — Save calendar integration and session pricing' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_calendar_dto_1.SetCalendarDto]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "saveCalendar", null);
__decorate([
    (0, common_1.Post)('onboarding/submit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 4 — Submit onboarding for verification' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], GuidesController.prototype, "submitOnboarding", null);
__decorate([
    (0, common_1.Get)('availability'),
    (0, swagger_1.ApiOperation)({ summary: "Get guide's availability slots" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.Put)('availability'),
    (0, swagger_1.ApiOperation)({ summary: "Set guide's weekly availability (replaces all)" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_availability_dto_1.SetAvailabilityDto]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "setAvailability", null);
__decorate([
    (0, common_1.Get)('availability/slots'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available booking slots for next N days' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getBookableSlots", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':slug/services'),
    (0, swagger_1.ApiOperation)({ summary: 'List active services for a guide (public)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Guide services' }),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], GuidesController.prototype, "getGuideServices", null);
exports.GuidesController = GuidesController = __decorate([
    (0, swagger_1.ApiTags)('Guides — Onboarding'),
    (0, common_1.Controller)('guides'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [guides_service_1.GuidesService,
        verification_service_1.VerificationService])
], GuidesController);
//# sourceMappingURL=guides.controller.js.map