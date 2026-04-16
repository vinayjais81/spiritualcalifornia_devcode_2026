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
exports.TicketsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tickets_service_1 = require("./tickets.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const event_checkout_dto_1 = require("./dto/event-checkout.dto");
let TicketsController = class TicketsController {
    ticketsService;
    constructor(ticketsService) {
        this.ticketsService = ticketsService;
    }
    eventCheckout(user, dto) {
        return this.ticketsService.eventCheckout(user.id, dto);
    }
    getMyEventTickets(user) {
        return this.ticketsService.getMyEventTickets(user.id);
    }
    getPurchaseGroup(user, groupId) {
        return this.ticketsService.getPurchaseGroup(user.id, groupId);
    }
};
exports.TicketsController = TicketsController;
__decorate([
    (0, common_1.Post)('event-checkout'),
    (0, roles_decorator_1.Roles)('SEEKER'),
    (0, swagger_1.ApiOperation)({ summary: 'Checkout event tickets — creates purchases + Stripe PaymentIntent' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, event_checkout_dto_1.EventCheckoutDto]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "eventCheckout", null);
__decorate([
    (0, common_1.Get)('my-events'),
    (0, roles_decorator_1.Roles)('SEEKER'),
    (0, swagger_1.ApiOperation)({ summary: "Get seeker's event ticket purchases grouped by event" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "getMyEventTickets", null);
__decorate([
    (0, common_1.Get)('purchase-group/:groupId'),
    (0, roles_decorator_1.Roles)('SEEKER'),
    (0, swagger_1.ApiOperation)({ summary: 'Get purchase group details (tickets + QR codes)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "getPurchaseGroup", null);
exports.TicketsController = TicketsController = __decorate([
    (0, swagger_1.ApiTags)('Tickets'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('tickets'),
    __metadata("design:paramtypes", [tickets_service_1.TicketsService])
], TicketsController);
//# sourceMappingURL=tickets.controller.js.map