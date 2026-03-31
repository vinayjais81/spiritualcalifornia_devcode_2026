import { Controller, Post, Get, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SoulToursService } from './soul-tours.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto } from './dto/book-tour.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Soul Tours')
@Controller('soul-tours')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SoulToursController {
  constructor(private readonly soulToursService: SoulToursService) {}

  @Post()
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Create a soul tour (guide)' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateTourDto) {
    return this.soulToursService.create(user.id, dto);
  }

  @Get('mine')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List guide's tours" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.soulToursService.findByGuide(user.id);
  }

  @Get('my-bookings')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's tour bookings" })
  findMyBookings(@CurrentUser() user: CurrentUserData) {
    return this.soulToursService.findMyBookings(user.id);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List published tours (public)' })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  findPublished(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.soulToursService.findPublished(Number(page) || 1, Number(limit) || 12);
  }

  @Public()
  @Get(':slugOrId')
  @ApiOperation({ summary: 'Get tour details by slug or ID (public)' })
  findOne(@Param('slugOrId') slugOrId: string) {
    return this.soulToursService.findOne(slugOrId);
  }

  @Put(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Update a tour' })
  update(@CurrentUser() user: CurrentUserData, @Param('id') id: string, @Body() dto: UpdateTourDto) {
    return this.soulToursService.update(user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Delete a tour' })
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.soulToursService.delete(user.id, id);
  }

  @Post('book')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Book a soul tour (seeker)' })
  bookTour(@CurrentUser() user: CurrentUserData, @Body() dto: BookTourDto) {
    return this.soulToursService.bookTour(user.id, dto);
  }
}
