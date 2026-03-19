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
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const upload_service_1 = require("./upload.service");
const ALLOWED_FOLDERS = [
    'avatars',
    'credentials',
    'guide-media',
    'products',
    'events',
];
const ALLOWED_CONTENT_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'video/mp4',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'application/zip',
    'application/epub+zip',
];
let UploadController = class UploadController {
    uploadService;
    constructor(uploadService) {
        this.uploadService = uploadService;
    }
    async getPresignedUrl(folder, fileName, contentType) {
        if (!ALLOWED_FOLDERS.includes(folder)) {
            throw new common_1.BadRequestException(`Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`);
        }
        if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
            throw new common_1.BadRequestException(`Unsupported content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
        }
        if (!fileName || fileName.length > 200) {
            throw new common_1.BadRequestException('Invalid file name');
        }
        return this.uploadService.getPresignedPutUrl(folder, fileName, contentType);
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Get)('presigned-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a pre-signed S3 PUT URL for direct upload' }),
    (0, swagger_1.ApiQuery)({ name: 'folder', enum: ALLOWED_FOLDERS }),
    (0, swagger_1.ApiQuery)({ name: 'fileName', type: String }),
    (0, swagger_1.ApiQuery)({ name: 'contentType', type: String }),
    __param(0, (0, common_1.Query)('folder')),
    __param(1, (0, common_1.Query)('fileName')),
    __param(2, (0, common_1.Query)('contentType')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "getPresignedUrl", null);
exports.UploadController = UploadController = __decorate([
    (0, swagger_1.ApiTags)('Upload'),
    (0, common_1.Controller)('upload'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [upload_service_1.UploadService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map