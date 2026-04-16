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
exports.EventCheckoutDto = exports.AttendeeDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
class AttendeeDto {
    firstName;
    lastName;
    email;
    dietaryNeeds;
    accessibilityNeeds;
}
exports.AttendeeDto = AttendeeDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendeeDto.prototype, "firstName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendeeDto.prototype, "lastName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], AttendeeDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendeeDto.prototype, "dietaryNeeds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendeeDto.prototype, "accessibilityNeeds", void 0);
class EventCheckoutDto {
    eventId;
    tierId;
    quantity;
    attendees;
}
exports.EventCheckoutDto = EventCheckoutDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The event ID' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EventCheckoutDto.prototype, "eventId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The ticket tier ID' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EventCheckoutDto.prototype, "tierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Number of tickets (must match attendees length)' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], EventCheckoutDto.prototype, "quantity", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [AttendeeDto], description: 'One entry per ticket' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AttendeeDto),
    __metadata("design:type", Array)
], EventCheckoutDto.prototype, "attendees", void 0);
//# sourceMappingURL=event-checkout.dto.js.map