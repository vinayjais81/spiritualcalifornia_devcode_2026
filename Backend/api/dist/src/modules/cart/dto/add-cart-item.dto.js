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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCartItemDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class AddCartItemDto {
    itemType;
    itemId;
    variantId;
    quantity;
    metadata;
}
exports.AddCartItemDto = AddCartItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.CartItemType }),
    (0, class_validator_1.IsEnum)(client_1.CartItemType),
    __metadata("design:type", String)
], AddCartItemDto.prototype, "itemType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID of the product, event tier, tour, or service' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddCartItemDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Product variant ID (for physical products with sizes)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddCartItemDto.prototype, "variantId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AddCartItemDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Extra data (selected date, room type, etc.)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AddCartItemDto.prototype, "metadata", void 0);
//# sourceMappingURL=add-cart-item.dto.js.map