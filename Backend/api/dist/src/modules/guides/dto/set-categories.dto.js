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
exports.SetCategoriesDto = exports.CategorySelectionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class CategorySelectionDto {
    categoryId;
    subcategoryIds;
    customSubcategoryNames;
}
exports.CategorySelectionDto = CategorySelectionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'clxxx...categoryId' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CategorySelectionDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'Existing subcategory IDs' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CategorySelectionDto.prototype, "subcategoryIds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'New custom subcategory names to create' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CategorySelectionDto.prototype, "customSubcategoryNames", void 0);
class SetCategoriesDto {
    categories;
    modalities;
    issuesHelped;
}
exports.SetCategoriesDto = SetCategoriesDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CategorySelectionDto], minItems: 1, maxItems: 5 }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(5),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CategorySelectionDto),
    __metadata("design:type", Array)
], SetCategoriesDto.prototype, "categories", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'Specific modality tags e.g. Reiki, Breathwork' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SetCategoriesDto.prototype, "modalities", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], description: 'Issues the guide helps with e.g. Anxiety, Burnout' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SetCategoriesDto.prototype, "issuesHelped", void 0);
//# sourceMappingURL=set-categories.dto.js.map