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
exports.CancelBookingDto = exports.PayBalanceDto = exports.BookTourDto = exports.TravelerDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
class TravelerDto {
    isPrimary;
    firstName;
    lastName;
    dateOfBirth;
    nationality;
    passportNumber;
    passportExpiry;
    email;
    phone;
}
exports.TravelerDto = TravelerDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Whether this is the primary traveler / booking contact' }),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TravelerDto.prototype, "isPrimary", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'First name as on passport' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Last name as on passport' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "nationality", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "passportNumber", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "passportExpiry", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TravelerDto.prototype, "phone", void 0);
class BookTourDto {
    tourId;
    departureId;
    roomTypeId;
    travelers;
    travelersDetails;
    dietaryRequirements;
    dietaryNotes;
    healthConditions;
    intentions;
    specialRequests;
    chosenDepositAmount;
    paymentMethod;
}
exports.BookTourDto = BookTourDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "tourId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The specific bookable departure' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "departureId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "roomTypeId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BookTourDto.prototype, "travelers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [TravelerDto], description: 'Per-person manifest — must equal `travelers` length' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => TravelerDto),
    __metadata("design:type", Array)
], BookTourDto.prototype, "travelersDetails", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'e.g. vegetarian | vegan | gluten-free | other | none' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "dietaryRequirements", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "dietaryNotes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "healthConditions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "intentions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BookTourDto.prototype, "specialRequests", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The deposit amount the user picked in checkout (USD)' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], BookTourDto.prototype, "chosenDepositAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Payment method — only STRIPE_CARD supported in v1' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['STRIPE_CARD', 'BANK_TRANSFER', 'CRYPTO']),
    __metadata("design:type", String)
], BookTourDto.prototype, "paymentMethod", void 0);
class PayBalanceDto {
    amount;
}
exports.PayBalanceDto = PayBalanceDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Optional partial balance amount; defaults to full remaining balance' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PayBalanceDto.prototype, "amount", void 0);
class CancelBookingDto {
    reason;
}
exports.CancelBookingDto = CancelBookingDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CancelBookingDto.prototype, "reason", void 0);
//# sourceMappingURL=book-tour.dto.js.map