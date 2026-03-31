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
exports.CheckoutController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const checkout_service_1 = require("./checkout.service");
const validate_promo_dto_1 = require("./dto/validate-promo.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const public_decorator_1 = require("../auth/decorators/public.decorator");
let CheckoutController = class CheckoutController {
    checkoutService;
    constructor(checkoutService) {
        this.checkoutService = checkoutService;
    }
    getShippingMethods() {
        return this.checkoutService.getShippingMethods();
    }
    getTaxRates() {
        return this.checkoutService.getTaxRates();
    }
    validatePromo(dto) {
        return this.checkoutService.validatePromoCode(dto.code, dto.subtotal);
    }
    calculateSummary(data) {
        return this.checkoutService.calculateOrderSummary(data);
    }
};
exports.CheckoutController = CheckoutController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('shipping-methods'),
    (0, swagger_1.ApiOperation)({ summary: 'List available shipping methods' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "getShippingMethods", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('tax-rates'),
    (0, swagger_1.ApiOperation)({ summary: 'List tax rates by state' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "getTaxRates", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('validate-promo'),
    (0, swagger_1.ApiOperation)({ summary: 'Validate a promo code and calculate discount' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [validate_promo_dto_1.ValidatePromoDto]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "validatePromo", null);
__decorate([
    (0, common_1.Post)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Calculate order summary (subtotal, tax, shipping, discount, total)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CheckoutController.prototype, "calculateSummary", null);
exports.CheckoutController = CheckoutController = __decorate([
    (0, swagger_1.ApiTags)('Checkout'),
    (0, common_1.Controller)('checkout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [checkout_service_1.CheckoutService])
], CheckoutController);
//# sourceMappingURL=checkout.controller.js.map