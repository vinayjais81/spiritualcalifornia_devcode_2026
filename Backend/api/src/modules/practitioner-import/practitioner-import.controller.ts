import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProspectStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { PractitionerImportService } from './practitioner-import.service';
import {
  ExcludeProspectDto,
  ListRowsQueryDto,
  UpdateProspectDto,
  UploadImportDto,
} from './dto/practitioner-import.dto';

/** Big enough for a few thousand practitioners, small enough to reject a mistake. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const XLSX_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .xlsx
];

@ApiTags('Admin — Practitioner Import')
@Controller('admin/practitioner-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class PractitionerImportController {
  constructor(private readonly service: PractitionerImportService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Parse a practitioner spreadsheet into a draft batch. Creates no accounts and sends no email.',
  })
  async upload(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImportDto,
  ) {
    if (!file) throw new BadRequestException('Attach an .xlsx file.');
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Only .xlsx files are supported. Export from Excel or Sheets and retry.');
    }
    if (!XLSX_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Unexpected file type (${file.mimetype}).`);
    }
    return this.service.uploadAndParse(user.id, file, dto.sourceLabel);
  }

  @Get()
  @ApiOperation({ summary: 'List import batches' })
  listBatches() {
    return this.service.listBatches();
  }

  // Literal segments stay above the `:id` routes below.
  @Get('rows/:rowId/context')
  @ApiOperation({ summary: 'Everything the spreadsheet said about one row' })
  async rowContext(@Param('rowId') rowId: string) {
    return this.service.getRow(rowId);
  }

  @Patch('rows/:rowId')
  @ApiOperation({ summary: 'Edit a prospect — chiefly adding an email found by hand' })
  updateRow(
    @CurrentUser() user: CurrentUserData,
    @Param('rowId') rowId: string,
    @Body() dto: UpdateProspectDto,
  ) {
    return this.service.updateRow(user.id, rowId, dto);
  }

  @Post('rows/:rowId/approve')
  @ApiOperation({ summary: 'Approve a row that was held for review' })
  approveRow(@CurrentUser() user: CurrentUserData, @Param('rowId') rowId: string) {
    return this.service.approveRow(user.id, rowId);
  }

  @Post('rows/:rowId/exclude')
  @ApiOperation({ summary: 'Exclude a row permanently — survives re-imports' })
  excludeRow(
    @CurrentUser() user: CurrentUserData,
    @Param('rowId') rowId: string,
    @Body() dto: ExcludeProspectDto,
  ) {
    return this.service.excludeRow(user.id, rowId, dto.reason);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Batch detail with per-status and per-sheet counts' })
  getBatch(@Param('id') id: string) {
    return this.service.getBatch(id);
  }

  @Get(':id/rows')
  @ApiOperation({ summary: 'Rows in a batch, filterable by status and sheet' })
  listRows(@Param('id') id: string, @Query() query: ListRowsQueryDto) {
    return this.service.listRows(id, query);
  }

  @Get(':id/rows.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="practitioner-import.csv"')
  @ApiOperation({ summary: 'Export the current filter for outreach done outside the panel' })
  exportCsv(
    @Param('id') id: string,
    @Query('status') status?: ProspectStatus,
    @Query('sheet') sheet?: string,
  ) {
    return this.service.exportRowsCsv(id, status, sheet);
  }

  @Post(':id/commit')
  @ApiOperation({
    summary: 'Create invited guide accounts for every ready row. Still sends no email.',
  })
  commit(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.commit(user.id, id);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive a batch' })
  archive(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.service.archiveBatch(user.id, id);
  }
}
