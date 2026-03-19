import { UploadService } from './upload.service';
export declare class UploadController {
    private readonly uploadService;
    constructor(uploadService: UploadService);
    getPresignedUrl(folder: string, fileName: string, contentType: string): Promise<{
        uploadUrl: string;
        key: string;
        fileUrl: string;
    }>;
}
