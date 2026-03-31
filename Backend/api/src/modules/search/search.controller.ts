import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '@prisma/client';

@ApiTags('Search')
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search across guides, products, and events' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  searchAll(@Query('q') q: string) {
    return this.searchService.searchAll(q || '');
  }

  @Public()
  @Get('guides')
  @ApiOperation({ summary: 'Search guides with filters' })
  @ApiQuery({ name: 'q', required: false }) @ApiQuery({ name: 'filters', required: false }) @ApiQuery({ name: 'page', required: false })
  searchGuides(@Query('q') q?: string, @Query('filters') filters?: string, @Query('page') page?: string) {
    return this.searchService.searchGuides(q || '', filters, Number(page) || 0);
  }

  @Public()
  @Get('products')
  @ApiOperation({ summary: 'Search products with filters' })
  @ApiQuery({ name: 'q', required: false }) @ApiQuery({ name: 'filters', required: false }) @ApiQuery({ name: 'page', required: false })
  searchProducts(@Query('q') q?: string, @Query('filters') filters?: string, @Query('page') page?: string) {
    return this.searchService.searchProducts(q || '', filters, Number(page) || 0);
  }

  @Public()
  @Get('events')
  @ApiOperation({ summary: 'Search events with filters' })
  @ApiQuery({ name: 'q', required: false }) @ApiQuery({ name: 'filters', required: false }) @ApiQuery({ name: 'page', required: false })
  searchEvents(@Query('q') q?: string, @Query('filters') filters?: string, @Query('page') page?: string) {
    return this.searchService.searchEvents(q || '', filters, Number(page) || 0);
  }

  @Post('reindex')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reindex all data to Algolia (admin only)' })
  reindexAll() {
    return this.searchService.reindexAll();
  }
}
