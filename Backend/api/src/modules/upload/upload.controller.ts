import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService, UploadFolder } from './upload.service';

const ALLOWED_FOLDERS: UploadFolder[] = [
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
  // Digital product types
  'audio/mpeg',       // .mp3
  'audio/mp4',        // .m4a
  'audio/x-m4a',     // .m4a (Safari)
  'application/zip',
  'application/epub+zip',
];

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * GET /upload/presigned-url?folder=credentials&fileName=cert.pdf&contentType=application/pdf
   * Returns a short-lived S3 pre-signed PUT URL for direct browser → S3 upload.
   */
  @Get('presigned-url')
  @ApiOperation({ summary: 'Get a pre-signed S3 PUT URL for direct upload' })
  @ApiQuery({ name: 'folder', enum: ALLOWED_FOLDERS })
  @ApiQuery({ name: 'fileName', type: String })
  @ApiQuery({ name: 'contentType', type: String })
  async getPresignedUrl(
    @Query('folder') folder: string,
    @Query('fileName') fileName: string,
    @Query('contentType') contentType: string,
  ) {
    if (!ALLOWED_FOLDERS.includes(folder as UploadFolder)) {
      throw new BadRequestException(
        `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`,
      );
    }

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new BadRequestException(
        `Unsupported content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      );
    }

    if (!fileName || fileName.length > 200) {
      throw new BadRequestException('Invalid file name');
    }

    return this.uploadService.getPresignedPutUrl(
      folder as UploadFolder,
      fileName,
      contentType,
    );
  }
}
