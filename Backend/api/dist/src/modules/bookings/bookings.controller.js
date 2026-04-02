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
exports.BookingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const bookings_service_1 = require("./bookings.service");
const create_booking_dto_1 = require("./dto/create-booking.dto");
const create_service_booking_dto_1 = require("./dto/create-service-booking.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let BookingsController = class BookingsController {
    bookingsService;
    constructor(bookingsService) {
        this.bookingsService = bookingsService;
    }
    createServiceBooking(user, dto) {
        return this.bookingsService.createServiceBooking(user.id, dto);
    }
    create(user, dto) {
        return this.bookingsService.create(user.id, dto);
    }
    findMyBookings(user) {
        return this.bookingsService.findMySeekerBookings(user.id);
    }
    findGuideBookings(user) {
        return this.bookingsService.findMyGuideBookings(user.id);
    }
    findOne(user, id) {
        return this.bookingsService.findOne(user.id, id);
    }
    cancel(user, id, reason) {
        return this.bookingsService.cancel(user.id, id, reason);
    }
    confirm(user, id) {
        return this.bookingsService.confirm(user.id, id);
    }
    complete(user, id) {
        return this.bookingsService.complete(user.id, id);
    }
};
exports.BookingsController = BookingsController;
__decorate([
    (0, common_1.Post)('service-checkout'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Create service booking with Stripe payment intent (Calendly flow)' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Booking + PaymentIntent created' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_service_booking_dto_1.CreateServiceBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "createServiceBooking", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Create a booking (seeker)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_booking_dto_1.CreateBookingDto]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('my-bookings'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List seeker's bookings" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findMyBookings", null);
__decorate([
    (0, common_1.Get)('guide-bookings'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: "List guide's received bookings" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findGuideBookings", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get booking details' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/cancel'),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a booking' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('reason')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Patch)(':id/confirm'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm a booking (guide)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "confirm", null);
__decorate([
    (0, common_1.Patch)(':id/complete'),
    (0, roles_decorator_1.Roles)(client_1.Role.GUIDE),
    (0, swagger_1.ApiOperation)({ summary: 'Mark booking as completed (guide)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BookingsController.prototype, "complete", null);
exports.BookingsController = BookingsController = __decorate([
    (0, swagger_1.ApiTags)('Bookings'),
    (0, common_1.Controller)('bookings'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [bookings_service_1.BookingsService])
], BookingsController);
//# sourceMappingURL=bookings.controller.js.map