import { Controller, Post, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CreateServiceBookingDto } from './dto/create-service-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Bookings')
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ─── Service Booking Checkout (Calendly-first flow) ────────────────────────

  @Post('service-checkout')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Create service booking with Stripe payment intent (Calendly flow)' })
  @ApiResponse({ status: 201, description: 'Booking + PaymentIntent created' })
  createServiceBooking(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateServiceBookingDto,
  ) {
    return this.bookingsService.createServiceBooking(user.id, dto);
  }

  @Post()
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: 'Create a booking (seeker)' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get('my-bookings')
  @Roles(Role.SEEKER)
  @ApiOperation({ summary: "List seeker's bookings" })
  findMyBookings(@CurrentUser() user: CurrentUserData) {
    return this.bookingsService.findMySeekerBookings(user.id);
  }

  @Get('guide-bookings')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: "List guide's received bookings" })
  findGuideBookings(@CurrentUser() user: CurrentUserData) {
    return this.bookingsService.findMyGuideBookings(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details' })
  findOne(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.bookingsService.findOne(user.id, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  cancel(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.bookingsService.cancel(user.id, id, reason);
  }

  @Patch(':id/confirm')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Confirm a booking (guide)' })
  confirm(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.bookingsService.confirm(user.id, id);
  }

  @Patch(':id/complete')
  @Roles(Role.GUIDE)
  @ApiOperation({ summary: 'Mark booking as completed (guide)' })
  complete(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.bookingsService.complete(user.id, id);
  }
}
