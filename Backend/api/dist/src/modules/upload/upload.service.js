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
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
let UploadService = UploadService_1 = class UploadService {
    config;
    logger = new common_1.Logger(UploadService_1.name);
    s3 = null;
    bucket;
    region;
    cloudfrontUrl;
    isStub;
    constructor(config) {
        this.config = config;
        this.bucket = this.config.get('AWS_S3_BUCKET', 'stub-bucket');
        this.region = this.config.get('AWS_REGION', 'us-west-1');
        this.cloudfrontUrl = this.config.get('AWS_CLOUDFRONT_URL', '');
        const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID', '');
        const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY', '');
        this.isStub =
            !accessKeyId ||
                accessKeyId.startsWith('your-') ||
                accessKeyId === '';
        if (!this.isStub) {
            this.s3 = new client_s3_1.S3Client({
                region: this.region,
                credentials: { accessKeyId, secretAccessKey },
            });
        }
        else {
            this.logger.warn('[STUB] AWS S3 keys not configured — upload service in stub mode');
        }
    }
    async getPresignedPutUrl(folder, fileName, contentType, expiresInSeconds = 300) {
        const ext = fileName.split('.').pop() ?? 'bin';
        const key = `${folder}/${(0, crypto_1.randomUUID)()}.${ext}`;
        if (this.isStub) {
            this.logger.warn(`[STUB] Mock pre-signed URL for key: ${key}`);
            return {
                uploadUrl: `https://stub-s3.example.com/${this.bucket}/${key}?stub=true`,
                key,
                fileUrl: `https://stub-cdn.example.com/${key}`,
            };
        }
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: expiresInSeconds });
        const fileUrl = this.cloudfrontUrl
            ? `${this.cloudfrontUrl}/${key}`
            : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
        return { uploadUrl, key, fileUrl };
    }
    getFileUrl(key) {
        if (this.isStub)
            return `https://stub-cdn.example.com/${key}`;
        return this.cloudfrontUrl
            ? `${this.cloudfrontUrl}/${key}`
            : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }
    async getPresignedDownloadUrl(key, expiresInSeconds = 3600, downloadFilename) {
        if (this.isStub) {
            this.logger.warn(`[STUB] Mock download URL for key: ${key}`);
            return `https://stub-cdn.example.com/${key}?download=true&stub=true`;
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            ...(downloadFilename
                ? { ResponseContentDisposition: `attachment; filename="${downloadFilename}"` }
                : {}),
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: expiresInSeconds });
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map