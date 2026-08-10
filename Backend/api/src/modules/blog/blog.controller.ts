import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { BlogService } from './blog.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('Blog')
@Controller('blog')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  // ─── Create Post (Guide only) ──────────────────────────────────────────────

  @Post()
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Create a new blog post (draft or published)' })
  @ApiResponse({ status: 201, description: 'Post created' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreatePostDto) {
    return this.blogService.create(user.id, dto);
  }

  // ─── List My Posts (Guide Dashboard) ───────────────────────────────────────

  @Get('mine')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List authenticated guide's blog posts (drafts + published)" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.blogService.findByGuide(user.id);
  }

  // ─── List All Published Posts (Public Journal) ─────────────────────────────

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all published blog posts (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'tag', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tag') tag?: string,
    @Query('category') category?: string,
  ) {
    return this.blogService.findAllPublished(
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 12,
      tag,
      category,
    );
  }

  // ─── Category Tabs (Public) ────────────────────────────────────────────────

  /**
   * Must stay above `@Get(':slug')` — a single-segment wildcard declared first
   * would capture "categories" as a post slug and 404. Same hazard as the
   * PaymentsController route ordering.
   */
  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Journal filter tabs, derived from published posts' })
  @ApiResponse({ status: 200, description: '{ total, categories: [{ label, count }] }' })
  getCategories() {
    return this.blogService.getCategories();
  }

  // ─── Get Single Post by Flat Slug (Public) ─────────────────────────────────

  /**
   * Primary article route. Slugs are globally unique so no author segment is
   * needed — /journal/{slug} serves editorial and practitioner posts alike.
   *
   * Declared after the literal `@Get('mine')` above: a single-segment wildcard
   * would otherwise swallow it. Same hazard as the PaymentsController route
   * ordering — literal routes must sit above wildcards.
   */
  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a published blog post by its global slug' })
  @ApiResponse({ status: 200, description: 'Blog post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findByFlatSlug(@Param('slug') slug: string) {
    return this.blogService.findByFlatSlug(slug);
  }

  // ─── Legacy: Get Post by Guide Slug + Post Slug (Public) ───────────────────
  // Retained so pre-flat-routing links resolve instead of 404ing. The frontend
  // route redirects to /journal/{slug}.

  @Public()
  @Get(':guideSlug/:postSlug')
  @ApiOperation({ summary: '[Legacy] Get a published post by guide slug and post slug' })
  @ApiResponse({ status: 200, description: 'Blog post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findBySlug(
    @Param('guideSlug') guideSlug: string,
    @Param('postSlug') postSlug: string,
  ) {
    return this.blogService.findBySlug(guideSlug, postSlug);
  }

  // ─── Applaud a Post (Public) ──────────────────────────────────────────────

  @Public()
  @Post(':id/applaud')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applaud (clap for) a published blog post' })
  @ApiResponse({ status: 200, description: 'New applause count' })
  applaud(@Param('id') id: string) {
    return this.blogService.applaud(id);
  }

  // ─── Update Post (Guide only) ─────────────────────────────────────────────

  @Put(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Update a blog post' })
  update(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.blogService.update(user.id, id, dto);
  }

  // ─── Delete Post (Guide only) ─────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.GUIDE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a blog post' })
  delete(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.blogService.delete(user.id, id);
  }
}
