import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, RsvpDto } from './dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateEventDto) {
    return this.eventsService.create(userId, dto);
  }

  @Public()
  @Get()
  findUpcoming(@Query('communityId') communityId?: string) {
    return this.eventsService.findUpcoming(communityId);
  }

  @Get('me')
  getUserEvents(@CurrentUser('id') userId: string) {
    return this.eventsService.getUserEvents(userId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(userId, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.eventsService.cancel(userId, id);
  }

  @Post(':id/rsvp')
  rsvp(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: RsvpDto) {
    return this.eventsService.rsvp(userId, id, dto);
  }

  @Get(':id/attendees')
  getAttendees(@Param('id') id: string) {
    return this.eventsService.getAttendees(id);
  }
}
