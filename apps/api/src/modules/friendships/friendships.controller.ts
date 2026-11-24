import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FriendshipsService } from './friendships.service';

class RespondDto {
  @IsBoolean()
  accept: boolean;
}

@Controller('friendships')
@UseGuards(JwtAuthGuard)
export class FriendshipsController {
  constructor(private readonly friendshipsService: FriendshipsService) {}

  @Post(':userId/request')
  sendRequest(@CurrentUser('id') userId: string, @Param('userId') addresseeId: string) {
    return this.friendshipsService.sendRequest(userId, addresseeId);
  }

  @Post(':friendshipId/respond')
  respond(
    @CurrentUser('id') userId: string,
    @Param('friendshipId') friendshipId: string,
    @Body() dto: RespondDto,
  ) {
    return this.friendshipsService.respond(userId, friendshipId, dto.accept);
  }

  @Delete(':userId')
  unfriend(@CurrentUser('id') userId: string, @Param('userId') otherUserId: string) {
    return this.friendshipsService.unfriend(userId, otherUserId);
  }

  @Get()
  getFriends(@CurrentUser('id') userId: string) {
    return this.friendshipsService.getFriends(userId);
  }

  @Get('requests/pending')
  getPendingRequests(@CurrentUser('id') userId: string) {
    return this.friendshipsService.getPendingRequests(userId);
  }

  @Get('requests/sent')
  getSentRequests(@CurrentUser('id') userId: string) {
    return this.friendshipsService.getSentRequests(userId);
  }
}
