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
exports.OrdersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const orders_service_1 = require("./orders.service");
const downloads_service_1 = require("./downloads.service");
const create_order_dto_1 = require("./dto/create-order.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const client_1 = require("@prisma/client");
let OrdersController = class OrdersController {
    ordersService;
    downloadsService;
    constructor(ordersService, downloadsService) {
        this.ordersService = ordersService;
        this.downloadsService = downloadsService;
    }
    create(user, dto) {
        return this.ordersService.create(user.id, dto);
    }
    findMine(user) {
        return this.ordersService.findMyOrders(user.id);
    }
    getMyDownloads(user) {
        return this.downloadsService.getMyDownloads(user.id);
    }
    findOne(user, id) {
        return this.ordersService.findOne(user.id, id);
    }
    getDownloadUrl(user, orderId, itemId) {
        return this.downloadsService.getDownloadUrl(user.id, orderId, itemId);
    }
};
exports.OrdersController = OrdersController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Create an order with payment intent' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List seeker's orders" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findMine", null);
__decorate([
    (0, common_1.Get)('downloads'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: "List all downloadable digital products from paid orders" }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getMyDownloads", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get order details' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':orderId/download/:itemId'),
    (0, roles_decorator_1.Roles)(client_1.Role.SEEKER),
    (0, swagger_1.ApiOperation)({ summary: 'Get a signed download URL for a purchased digital product' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], OrdersController.prototype, "getDownloadUrl", null);
exports.OrdersController = OrdersController = __decorate([
    (0, swagger_1.ApiTags)('Orders'),
    (0, common_1.Controller)('orders'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [orders_service_1.OrdersService,
        downloads_service_1.DownloadsService])
], OrdersController);
//# sourceMappingURL=orders.controller.js.map