import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a draft event (published when guide goes live)' })
  create(@CurrentUser() user: CurrentUserData, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the authenticated guide's events" })
  findMine(@CurrentUser() user: CurrentUserData) {
    return this.eventsService.findByGuide(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an event owned by the authenticated guide' })
  remove(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.eventsService.delete(user.id, id);
  }
}
