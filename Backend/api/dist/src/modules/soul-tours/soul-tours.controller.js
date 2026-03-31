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
exports.SoulToursController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const soul_tours_service_1 = require("./soul-tours.service");
const create_tour_dto_1 = require("./dto/create-tour.dto");
const update_tour_dto_1 = require("./dto/update-tour.dto");
const book_tour_dto_1 = require("./dto/book-tour.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let SoulToursController = class SoulToursController {
    soulToursService;
    constructor(soulToursService) {
        this.soulToursService = soulToursService;
    }
    create(user, dto) {
        return this.soulToursService.create(user.id, dto);
    }
    findMine(user) {
        return this.soulToursService.findByGuide(user.id);
    }
    findMyBookings(user) {
        return this.soulToursService.findMyBookings(user.id);
    }
    findPublished(page, limit) {
        return this.soulToursService.findPublished(Number(page) || 1, Number(limit) || 12);
    }
    findOne(slugOrId) {
        return this.soulToursService.findOne(slugOrId);
    }
    update(user, id, dto) {
        return this.soulToursService.update(user.id, id, dto);
    }
    remove(user, id) {
        return this.soulToursService.delete(user.id, id);
    }
    bookTour(user, dto) {
        return this.soulToursService.bookTour(user.id, dto);
    }
};
exports.SoulToursController = SoulToursController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Create a soul tour (guide)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_tour_dto_1.CreateTourDto]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "List guide's tours" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findMine", null);
__decorate([
    (0, common_1.Get)('my-bookings'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List seeker's tour bookings" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findMyBookings", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List published tours (public)' }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findPublished", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':slugOrId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get tour details by slug or ID (public)' }),
    __param(0, (0, common_1.Param)('slugOrId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Update a tour' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_tour_dto_1.UpdateTourDto]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a tour' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('book'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Book a soul tour (seeker)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, book_tour_dto_1.BookTourDto]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "bookTour", null);
exports.SoulToursController = SoulToursController = __decorate([
    (0, swagger_1.ApiTags)('Soul Tours'),
    (0, common_1.Controller)('soul-tours'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [soul_tours_service_1.SoulToursService])
], SoulToursController);
//# sourceMappingURL=soul-tours.controller.js.map