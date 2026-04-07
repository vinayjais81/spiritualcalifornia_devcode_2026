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
var SoulToursController_1;
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
let SoulToursController = SoulToursController_1 = class SoulToursController {
    soulToursService;
    logger = new common_1.Logger(SoulToursController_1.name);
    constructor(soulToursService) {
        this.soulToursService = soulToursService;
    }
    create(user, dto) {
        return this.soulToursService.create(user.id, dto);
    }
    findMine(user) {
        return this.soulToursService.findByGuide(user.id);
    }
    update(user, id, dto) {
        return this.soulToursService.update(user.id, id, dto);
    }
    remove(user, id) {
        return this.soulToursService.delete(user.id, id);
    }
    addDeparture(user, tourId, dto) {
        return this.soulToursService.addDeparture(user.id, tourId, dto);
    }
    cancelDeparture(user, tourId, departureId) {
        return this.soulToursService.cancelDeparture(user.id, tourId, departureId);
    }
    replaceItinerary(user, tourId, body) {
        return this.soulToursService.replaceItinerary(user.id, tourId, body.days);
    }
    getManifest(user, tourId, departureId) {
        return this.soulToursService.getManifest(user.id, tourId, departureId);
    }
    findPublished(page, limit) {
        return this.soulToursService.findPublished(Number(page) || 1, Number(limit) || 12);
    }
    findMyBookings(user) {
        return this.soulToursService.findMyBookings(user.id);
    }
    async bookTour(user, dto) {
        this.logger.log(`bookTour called by user=${user.id} with payload: ${JSON.stringify({
            tourId: dto.tourId,
            departureId: dto.departureId,
            roomTypeId: dto.roomTypeId,
            travelers: dto.travelers,
            chosenDepositAmount: dto.chosenDepositAmount,
            paymentMethod: dto.paymentMethod,
            travelersDetailsCount: dto.travelersDetails?.length,
            travelersDetails: dto.travelersDetails,
        })}`);
        try {
            const result = await this.soulToursService.bookTour(user.id, dto);
            this.logger.log(`bookTour SUCCESS: bookingId=${result?.id}`);
            return result;
        }
        catch (err) {
            if (err instanceof common_1.HttpException) {
                this.logger.warn(`bookTour rejected: ${err.message}`);
                throw err;
            }
            this.logger.error(`bookTour CRASHED: ${err?.message}`, err?.stack);
            throw new common_1.InternalServerErrorException({
                statusCode: 500,
                message: err?.message || 'Internal server error',
                error: err?.name || 'Error',
                stackPreview: err?.stack?.split('\n').slice(0, 6).join('\n'),
            });
        }
    }
    getBooking(user, bookingId) {
        return this.soulToursService.getBookingForSeeker(user.id, bookingId);
    }
    getBalanceDue(user, bookingId) {
        return this.soulToursService.getBalanceDue(user.id, bookingId);
    }
    cancelBooking(user, bookingId, dto) {
        return this.soulToursService.cancelBooking(user.id, bookingId, dto);
    }
    findOne(slugOrId) {
        return this.soulToursService.findOne(slugOrId);
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
    (0, common_1.Post)(':id/departures'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Add a departure to a tour' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, create_tour_dto_1.CreateDepartureDto]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "addDeparture", null);
__decorate([
    (0, common_1.Delete)(':id/departures/:departureId'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a departure' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('departureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "cancelDeparture", null);
__decorate([
    (0, common_1.Post)(':id/itinerary'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Replace tour itinerary (full overwrite)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "replaceItinerary", null);
__decorate([
    (0, common_1.Get)(':id/manifest'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Traveler manifest for a tour (decrypted passports)' }),
    (0, swagger_1.ApiQuery)({ name: 'departureId', required: false }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('departureId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "getManifest", null);
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
    (0, common_1.Get)('my-bookings'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List seeker's tour bookings" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findMyBookings", null);
__decorate([
    (0, common_1.Post)('book'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Book a soul tour (seeker)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, book_tour_dto_1.BookTourDto]),
    __metadata("design:returntype", Promise)
], SoulToursController.prototype, "bookTour", null);
__decorate([
    (0, common_1.Get)('bookings/:bookingId'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Get a single tour booking (seeker view, scrubbed)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "getBooking", null);
__decorate([
    (0, common_1.Get)('bookings/:bookingId/balance-due'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Get remaining balance for a booking (used by pay-balance page)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "getBalanceDue", null);
__decorate([
    (0, common_1.Post)('bookings/:bookingId/cancel'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a tour booking (seeker)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('bookingId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, book_tour_dto_1.CancelBookingDto]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "cancelBooking", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':slugOrId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get tour details by slug or ID (public)' }),
    __param(0, (0, common_1.Param)('slugOrId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SoulToursController.prototype, "findOne", null);
exports.SoulToursController = SoulToursController = SoulToursController_1 = __decorate([
    (0, swagger_1.ApiTags)('Soul Tours'),
    (0, common_1.Controller)('soul-tours'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [soul_tours_service_1.SoulToursService])
], SoulToursController);
//# sourceMappingURL=soul-tours.controller.js.map