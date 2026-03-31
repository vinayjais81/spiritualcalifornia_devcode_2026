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
exports.ReviewsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reviews_service_1 = require("./reviews.service");
const create_review_dto_1 = require("./dto/create-review.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let ReviewsController = class ReviewsController {
    reviewsService;
    constructor(reviewsService) {
        this.reviewsService = reviewsService;
    }
    create(user, dto) {
        return this.reviewsService.create(user.id, dto);
    }
    checkEligibility(user, bookingId) {
        return this.reviewsService.checkEligibility(user.id, bookingId);
    }
    findMine(user) {
        return this.reviewsService.findMyReviews(user.id);
    }
    getReviewable(user) {
        return this.reviewsService.getReviewableBookings(user.id);
    }
    findByGuide(userId, page, limit) {
        return this.reviewsService.findByGuideUserId(userId, page ? Number(page) : 1, limit ? Math.min(Number(limit), 50) : 10);
    }
    findTestimonials(guideId) {
        return this.reviewsService.findTestimonialsByGuideId(guideId);
    }
    flag(id, flag) {
        return this.reviewsService.flagReview(id, flag);
    }
    moderate(id, approved) {
        return this.reviewsService.moderateReview(id, approved);
    }
};
exports.ReviewsController = ReviewsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Submit a review for a completed booking' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_review_dto_1.CreateReviewDto]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('eligibility/:bookingId'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Check if a booking is eligible for review' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "checkEligibility", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List seeker's submitted reviews" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "findMine", null);
__decorate([
    (0, common_1.Get)('reviewable'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'List completed bookings that can be reviewed' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "getReviewable", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('guide/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get reviews for a guide by their user ID (public)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "findByGuide", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('testimonials/:guideId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get testimonials for a guide' }),
    __param(0, (0, common_1.Param)('guideId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "findTestimonials", null);
__decorate([
    (0, common_1.Patch)(':id/flag'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Flag or unflag a review' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('flag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "flag", null);
__decorate([
    (0, common_1.Patch)(':id/moderate'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.SUPER_ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Approve or reject a review' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('approved')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", void 0)
], ReviewsController.prototype, "moderate", null);
exports.ReviewsController = ReviewsController = __decorate([
    (0, swagger_1.ApiTags)('Reviews'),
    (0, common_1.Controller)('reviews'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [reviews_service_1.ReviewsService])
], ReviewsController);
//# sourceMappingURL=reviews.controller.js.map