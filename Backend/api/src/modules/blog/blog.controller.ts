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
  ) {
    return this.blogService.findAllPublished(
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 50) : 12,
      tag,
    );
  }

  // ─── Get Single Post by Slug (Public) ──────────────────────────────────────

  @Public()
  @Get(':guideSlug/:postSlug')
  @ApiOperation({ summary: 'Get a published blog post by guide slug and post slug' })
  @ApiResponse({ status: 200, description: 'Blog post' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  findBySlug(
    @Param('guideSlug') guideSlug: string,
    @Param('postSlug') postSlug: string,
  ) {
    return this.blogService.findBySlug(guideSlug, postSlug);
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
