import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateEventDto, UpdateEventDto, RsvpDto } from './dto';
import { AchievementsService } from '../creator/achievements.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async create(organizerId: string, dto: CreateEventDto) {
    const event = await this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        communityId: dto.communityId,
        organizerId,
        location: dto.location,
        isOnline: dto.isOnline ?? false,
        meetingUrl: dto.meetingUrl,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        capacity: dto.capacity,
        attendees: {
          create: { userId: organizerId, status: 'GOING' },
        },
      },
      include: { _count: { select: { attendees: true } } },
    });

    this.achievementsService.checkAndAward(organizerId).catch(() => {
      // Non-critical side effect — a failed check here shouldn't fail event creation.
    });

    // Notify community members if this event belongs to a community
    if (dto.communityId) {
      const members = await this.prisma.communityMember.findMany({
        where: { communityId: dto.communityId, userId: { not: organizerId } },
        select: { userId: true },
      });
      await Promise.all(
        members.map((m) =>
          this.notificationsService.create({
            userId: m.userId,
            type: 'EVENT_REMINDER',
            title: `New event: ${dto.title}`,
            body: dto.description?.slice(0, 100),
            data: { eventId: event.id },
          }),
        ),
      );
    }

    return event;
  }

  async findUpcoming(communityId?: string) {
    return this.prisma.event.findMany({
      where: {
        startsAt: { gte: new Date() },
        status: { in: ['UPCOMING', 'ONGOING'] },
        ...(communityId ? { communityId } : {}),
      },
      include: {
        organizer: { select: { id: true, username: true, displayName: true } },
        _count: { select: { attendees: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, username: true, displayName: true } },
        community: { select: { id: true, name: true, slug: true } },
        _count: { select: { attendees: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(userId: string, id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can update this event');
    }

    return this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async cancel(userId: string, id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can cancel this event');
    }

    const updated = await this.prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });

    const attendees = await this.prisma.eventAttendee.findMany({
      where: { eventId: id, userId: { not: userId } },
      select: { userId: true },
    });
    await Promise.all(
      attendees.map((a) =>
        this.notificationsService.create({
          userId: a.userId,
          type: 'EVENT_REMINDER',
          title: `Event cancelled: ${event.title}`,
          data: { eventId: id },
        }),
      ),
    );

    return updated;
  }

  async rsvp(userId: string, eventId: string, dto: RsvpDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    if (dto.status === 'GOING' && event.capacity) {
      const goingCount = await this.prisma.eventAttendee.count({
        where: { eventId, status: 'GOING' },
      });
      if (goingCount >= event.capacity) {
        throw new ForbiddenException('This event is at capacity');
      }
    }

    const attendance = await this.prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId, userId } },
      create: { eventId, userId, status: dto.status },
      update: { status: dto.status },
    });

    if (dto.status === 'GOING' && event.organizerId !== userId) {
      await this.notificationsService.create({
        userId: event.organizerId,
        type: 'EVENT_RSVP',
        title: `Someone is going to ${event.title}`,
        data: { eventId },
      });
    }

    return attendance;
  }

  async getAttendees(eventId: string) {
    return this.prisma.eventAttendee.findMany({
      where: { eventId },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    });
  }

  async getUserEvents(userId: string) {
    return this.prisma.eventAttendee.findMany({
      where: { userId },
      include: { event: true },
      orderBy: { event: { startsAt: 'asc' } },
    });
  }
}
