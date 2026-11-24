import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnonymousMessagingService } from './anonymous-messaging.service';
import { SendAnonymousMessageDto } from './dto';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

class ReplyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

@Controller('anonymous-messages')
@UseGuards(JwtAuthGuard)
export class AnonymousMessagingController {
  constructor(private readonly service: AnonymousMessagingService) {}

  @Post()
  send(@CurrentUser('id') userId: string, @Body() dto: SendAnonymousMessageDto) {
    return this.service.send(userId, dto.receiverId, dto.content, dto.revealIdentity ?? false);
  }

  @Get('inbox')
  getInbox(@CurrentUser('id') userId: string) {
    return this.service.getInbox(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.markRead(userId, id);
  }

  @Post(':id/reply')
  reply(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: ReplyDto) {
    return this.service.reply(userId, id, dto.content);
  }
}
