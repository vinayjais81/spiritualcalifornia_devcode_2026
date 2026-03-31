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
exports.CartController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cart_service_1 = require("./cart.service");
const add_cart_item_dto_1 = require("./dto/add-cart-item.dto");
const update_cart_item_dto_1 = require("./dto/update-cart-item.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const public_decorator_1 = require("../auth/decorators/public.decorator");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
let CartController = class CartController {
    cartService;
    constructor(cartService) {
        this.cartService = cartService;
    }
    getCart(user, sessionId) {
        return this.cartService.getCart(user?.id, sessionId);
    }
    addItem(user, sessionId, dto) {
        return this.cartService.addItem(dto, user?.id, sessionId);
    }
    updateItem(user, sessionId, itemId, dto) {
        return this.cartService.updateItem(itemId, dto, user?.id, sessionId);
    }
    removeItem(user, sessionId, itemId) {
        return this.cartService.removeItem(itemId, user?.id, sessionId);
    }
    clearCart(user) {
        return this.cartService.clearCart(user.id);
    }
    mergeGuestCart(user, sessionId) {
        return this.cartService.mergeGuestCart(user.id, sessionId);
    }
};
exports.CartController = CartController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get cart (authenticated user or guest via x-session-id header)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-session-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "getCart", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('items'),
    (0, swagger_1.ApiOperation)({ summary: 'Add item to cart' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-session-id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_cart_item_dto_1.AddCartItemDto]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "addItem", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Put)('items/:itemId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update cart item quantity' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-session-id')),
    __param(2, (0, common_1.Param)('itemId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, update_cart_item_dto_1.UpdateCartItemDto]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "updateItem", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Delete)('items/:itemId'),
    (0, swagger_1.ApiOperation)({ summary: 'Remove item from cart' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-session-id')),
    __param(2, (0, common_1.Param)('itemId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "removeItem", null);
__decorate([
    (0, common_1.Delete)(),
    (0, swagger_1.ApiOperation)({ summary: 'Clear entire cart' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "clearCart", null);
__decorate([
    (0, common_1.Post)('merge'),
    (0, swagger_1.ApiOperation)({ summary: 'Merge guest cart into authenticated user cart (call after login)' }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-session-id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CartController.prototype, "mergeGuestCart", null);
exports.CartController = CartController = __decorate([
    (0, swagger_1.ApiTags)('Cart'),
    (0, common_1.Controller)('cart'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [cart_service_1.CartService])
], CartController);
//# sourceMappingURL=cart.controller.js.map