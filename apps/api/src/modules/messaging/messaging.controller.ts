import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  getConversations(@CurrentUser('id') userId: string) {
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:userId')
  getConversationMessages(
    @CurrentUser('id') userId: string,
    @Param('userId') otherUserId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagingService.getConversationMessages(userId, otherUserId, 50, cursor);
  }

  @Post()
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    // REST fallback for clients that can't hold a WS connection (e.g. push-triggered replies).
    // Real-time delivery still happens through MessagingGateway for connected clients.
    return this.messagingService.sendMessage(userId, dto.receiverId, dto.content);
  }

  @Post('conversations/:userId/read')
  markRead(@CurrentUser('id') userId: string, @Param('userId') otherUserId: string) {
    return this.messagingService.markConversationRead(userId, otherUserId);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.messagingService.getUnreadCount(userId);
  }
}
