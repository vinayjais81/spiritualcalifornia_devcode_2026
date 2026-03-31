import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../auth/decorators/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get user's notifications (paginated)" })
  @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  findMine(@CurrentUser() user: CurrentUserData, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.notificationsService.findByUser(user.id, Number(page) || 1, Number(limit) || 20);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@CurrentUser() user: CurrentUserData, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAllAsRead(user.id);
  }
}
