import { ConfigService } from '@nestjs/config';
export type UploadFolder = 'avatars' | 'credentials' | 'guide-media' | 'products' | 'events';
export declare class UploadService {
    private readonly config;
    private readonly logger;
    private readonly s3;
    private readonly bucket;
    private readonly region;
    private readonly cloudfrontUrl;
    private readonly isStub;
    constructor(config: ConfigService);
    getPresignedPutUrl(folder: UploadFolder, fileName: string, contentType: string, expiresInSeconds?: number): Promise<{
        uploadUrl: string;
        key: string;
        fileUrl: string;
    }>;
    getFileUrl(key: string): string;
}
