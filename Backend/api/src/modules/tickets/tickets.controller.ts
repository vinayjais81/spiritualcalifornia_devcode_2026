import {
  Controller, Post, Get, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';
import { EventCheckoutDto } from './dto/event-checkout.dto';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post('event-checkout')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Checkout event tickets — creates purchases + Stripe PaymentIntent' })
  eventCheckout(@CurrentUser() user: CurrentUserData, @Body() dto: EventCheckoutDto) {
    return this.ticketsService.eventCheckout(user.id, dto);
  }

  @Get('my-events')
  @Roles('SEEKER')
  @ApiOperation({ summary: "Get seeker's event ticket purchases grouped by event" })
  getMyEventTickets(@CurrentUser() user: CurrentUserData) {
    return this.ticketsService.getMyEventTickets(user.id);
  }

  @Get('purchase-group/:groupId')
  @Roles('SEEKER')
  @ApiOperation({ summary: 'Get purchase group details (tickets + QR codes)' })
  getPurchaseGroup(@CurrentUser() user: CurrentUserData, @Param('groupId') groupId: string) {
    return this.ticketsService.getPurchaseGroup(user.id, groupId);
  }
}
