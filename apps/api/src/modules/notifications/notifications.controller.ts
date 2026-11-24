import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { RegisterPushTokenDto } from './dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

  @Get()
  getNotifications(@CurrentUser('id') userId: string, @Query('unreadOnly') unreadOnly?: string) {
    return this.notificationsService.getForUser(userId, unreadOnly === 'true');
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Post('push-tokens')
  registerPushToken(@CurrentUser('id') userId: string, @Body() dto: RegisterPushTokenDto) {
    return this.pushService.registerToken(userId, dto.token, dto.platform);
  }

  @Delete('push-tokens/:token')
  removePushToken(@Param('token') token: string) {
    return this.pushService.removeToken(token);
  }
}
