import {
  Controller, Post, Get, Put, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SoulToursService } from './soul-tours.service';
import {
  CreateTourDto, CreateDepartureDto, CreateItineraryDayDto,
} from './dto/create-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';
import { BookTourDto, CancelBookingDto } from './dto/book-tour.dto';
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

  // ─── Tour CRUD (Guide) ─────────────────────────────────────────────────────

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

  // ─── Departures (Guide) ────────────────────────────────────────────────────

  @Post(':id/departures')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Add a departure to a tour' })
  addDeparture(
    @CurrentUser() user: CurrentUserData,
    @Param('id') tourId: string,
    @Body() dto: CreateDepartureDto,
  ) {
    return this.soulToursService.addDeparture(user.id, tourId, dto);
  }

  @Delete(':id/departures/:departureId')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Cancel a departure' })
  cancelDeparture(
    @CurrentUser() user: CurrentUserData,
    @Param('id') tourId: string,
    @Param('departureId') departureId: string,
  ) {
    return this.soulToursService.cancelDeparture(user.id, tourId, departureId);
  }

  // ─── Itinerary (Guide) ─────────────────────────────────────────────────────

  @Post(':id/itinerary')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Replace tour itinerary (full overwrite)' })
  replaceItinerary(
    @CurrentUser() user: CurrentUserData,
    @Param('id') tourId: string,
    @Body() body: { days: CreateItineraryDayDto[] },
  ) {
    return this.soulToursService.replaceItinerary(user.id, tourId, body.days);
  }

  // ─── Manifest (Guide) ──────────────────────────────────────────────────────

  @Get(':id/manifest')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Traveler manifest for a tour (decrypted passports)' })
  @ApiQuery({ name: 'departureId', required: false })
  getManifest(
    @CurrentUser() user: CurrentUserData,
    @Param('id') tourId: string,
    @Query('departureId') departureId?: string,
  ) {
    return this.soulToursService.getManifest(user.id, tourId, departureId);
  }

  // ─── Public ────────────────────────────────────────────────────────────────

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

  // ─── Bookings (Seeker) ─────────────────────────────────────────────────────

  @Get('my-bookings')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's tour bookings" })
  findMyBookings(@CurrentUser() user: CurrentUserData) {
    return this.soulToursService.findMyBookings(user.id);
  }

  @Post('book')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Book a soul tour (seeker)' })
  bookTour(@CurrentUser() user: CurrentUserData, @Body() dto: BookTourDto) {
    return this.soulToursService.bookTour(user.id, dto);
  }

  @Get('bookings/:bookingId')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Get a single tour booking (seeker view, scrubbed)' })
  getBooking(
    @CurrentUser() user: CurrentUserData,
    @Param('bookingId') bookingId: string,
  ) {
    return this.soulToursService.getBookingForSeeker(user.id, bookingId);
  }

  @Get('bookings/:bookingId/balance-due')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Get remaining balance for a booking (used by pay-balance page)' })
  getBalanceDue(
    @CurrentUser() user: CurrentUserData,
    @Param('bookingId') bookingId: string,
  ) {
    return this.soulToursService.getBalanceDue(user.id, bookingId);
  }

  @Post('bookings/:bookingId/cancel')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Cancel a tour booking (seeker)' })
  cancelBooking(
    @CurrentUser() user: CurrentUserData,
    @Param('bookingId') bookingId: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.soulToursService.cancelBooking(user.id, bookingId, dto);
  }
}
