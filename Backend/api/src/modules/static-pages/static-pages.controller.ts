import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '@prisma/client';
import { StaticPagesService } from './static-pages.service';
import { UpsertStaticPageDto } from './dto/upsert-static-page.dto';

/**
 * Two endpoint groups on the same controller:
 *
 *   Public:  GET /static-pages/:slug — fetch a published page for rendering
 *   Admin:   /admin/static-pages — full CRUD for ADMIN + SUPER_ADMIN
 *
 * Keeping them together makes the service layer one-stop; the routes split
 * cleanly because the admin group is nested under /admin.
 */
@ApiTags('Static Pages')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaticPagesController {
  constructor(private readonly staticPages: StaticPagesService) {}

  // ─── Public: render by slug ─────────────────────────────────────────────

  @Public()
  @Get('static-pages/:slug')
  @ApiOperation({ summary: 'Fetch a published static page by slug' })
  @ApiResponse({ status: 200, description: 'The page payload' })
  @ApiResponse({ status: 404, description: 'Slug not found or not published' })
  findPublicBySlug(@Param('slug') slug: string) {
    return this.staticPages.findPublicBySlug(slug);
  }

  // ─── Admin: CRUD ─────────────────────────────────────────────────────────

  @Get('admin/static-pages')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all static pages (drafts + published)' })
  listAll() {
    return this.staticPages.listAll();
  }

  @Get('admin/static-pages/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get one static page by id' })
  findById(@Param('id') id: string) {
    return this.staticPages.findById(id);
  }

  @Post('admin/static-pages')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new static page' })
  create(@Body() dto: UpsertStaticPageDto) {
    return this.staticPages.create(dto);
  }

  @Put('admin/static-pages/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update an existing static page' })
  update(@Param('id') id: string, @Body() dto: UpsertStaticPageDto) {
    return this.staticPages.update(id, dto);
  }

  @Delete('admin/static-pages/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a static page' })
  delete(@Param('id') id: string) {
    return this.staticPages.delete(id);
  }
}
