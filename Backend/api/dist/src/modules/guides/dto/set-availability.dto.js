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
exports.SetAvailabilityDto = exports.AvailabilitySlotDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
class AvailabilitySlotDto {
    dayOfWeek;
    startTime;
    endTime;
    isRecurring;
    bufferMin;
}
exports.AvailabilitySlotDto = AvailabilitySlotDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: '0=Sun, 1=Mon ... 6=Sat' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], AvailabilitySlotDto.prototype, "dayOfWeek", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '09:00' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AvailabilitySlotDto.prototype, "startTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '17:00' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AvailabilitySlotDto.prototype, "endTime", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AvailabilitySlotDto.prototype, "isRecurring", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 0 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], AvailabilitySlotDto.prototype, "bufferMin", void 0);
class SetAvailabilityDto {
    slots;
}
exports.SetAvailabilityDto = SetAvailabilityDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [AvailabilitySlotDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => AvailabilitySlotDto),
    __metadata("design:type", Array)
], SetAvailabilityDto.prototype, "slots", void 0);
//# sourceMappingURL=set-availability.dto.js.map