import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Note: PrismaService not needed in upload service — S3 only
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type UploadFolder = 'avatars' | 'credentials' | 'guide-media' | 'products' | 'events';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cloudfrontUrl: string;
  private readonly isStub: boolean;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', 'stub-bucket');
    this.region = this.config.get<string>('AWS_REGION', 'us-west-1');
    this.cloudfrontUrl = this.config.get<string>('AWS_CLOUDFRONT_URL', '');

    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY', '');

    // [STUB] If AWS keys are placeholders, operate in stub mode
    this.isStub =
      !accessKeyId ||
      accessKeyId.startsWith('your-') ||
      accessKeyId === '';

    if (!this.isStub) {
      this.s3 = new S3Client({
        region: this.region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('[STUB] AWS S3 keys not configured — upload service in stub mode');
    }
  }

  /**
   * Generate a pre-signed PUT URL for direct client → S3 upload.
   * [STUB] Returns a mock URL when AWS credentials are absent.
   */
  async getPresignedPutUrl(
    folder: UploadFolder,
    fileName: string,
    contentType: string,
    expiresInSeconds = 300,
  ): Promise<{ uploadUrl: string; key: string; fileUrl: string }> {
    const ext = fileName.split('.').pop() ?? 'bin';
    const key = `${folder}/${randomUUID()}.${ext}`;

    if (this.isStub) {
      this.logger.warn(`[STUB] Mock pre-signed URL for key: ${key}`);
      return {
        uploadUrl: `https://stub-s3.example.com/${this.bucket}/${key}?stub=true`,
        key,
        fileUrl: `https://stub-cdn.example.com/${key}`,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn: expiresInSeconds });
    const fileUrl = this.cloudfrontUrl
      ? `${this.cloudfrontUrl}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return { uploadUrl, key, fileUrl };
  }

  getFileUrl(key: string): string {
    if (this.isStub) return `https://stub-cdn.example.com/${key}`;
    return this.cloudfrontUrl
      ? `${this.cloudfrontUrl}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
