import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AchievementsService } from '../creator/achievements.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: {
    event: Record<string, jest.Mock>;
    eventAttendee: Record<string, jest.Mock>;
    communityMember: Record<string, jest.Mock>;
  };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      event: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      eventAttendee: { findMany: jest.fn(), count: jest.fn(), upsert: jest.fn() },
      communityMember: { findMany: jest.fn() },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AchievementsService, useValue: { checkAndAward: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('auto-RSVPs the organizer as GOING', async () => {
      prisma.event.create.mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data }));

      await service.create('organizer1', { title: 'Book Club', startsAt: new Date().toISOString() } as any);

      const createCall = prisma.event.create.mock.calls[0][0];
      expect(createCall.data.attendees.create).toEqual({ userId: 'organizer1', status: 'GOING' });
    });

    it('does not notify anyone for a personal (non-community) event', async () => {
      prisma.event.create.mockResolvedValue({ id: 'e1' });

      await service.create('organizer1', { title: 'Solo walk', startsAt: new Date().toISOString() } as any);

      expect(notifications.create).not.toHaveBeenCalled();
    });

    it('notifies other community members (not the organizer) when attached to a community', async () => {
      prisma.event.create.mockResolvedValue({ id: 'e1' });
      prisma.communityMember.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }]);

      await service.create('organizer1', {
        title: 'Community Meetup',
        startsAt: new Date().toISOString(),
        communityId: 'c1',
      } as any);

      expect(prisma.communityMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { communityId: 'c1', userId: { not: 'organizer1' } } }),
      );
      expect(notifications.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a non-existent event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.update('u1', 'nope', {} as any)).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when the caller isn't the organizer", async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'someone-else' });

      await expect(service.update('u1', 'e1', { title: 'New title' } as any)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cancel', () => {
    it("throws ForbiddenException when the caller isn't the organizer", async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'someone-else' });

      await expect(service.cancel('u1', 'e1')).rejects.toThrow(ForbiddenException);
    });

    it('cancels and notifies attendees other than the organizer', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', organizerId: 'organizer1', title: 'Book Club' });
      prisma.event.update.mockResolvedValue({ id: 'e1', status: 'CANCELLED' });
      prisma.eventAttendee.findMany.mockResolvedValue([{ userId: 'u2' }]);

      const result = await service.cancel('organizer1', 'e1');

      expect(result.status).toBe('CANCELLED');
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
    });
  });

  describe('rsvp', () => {
    it('throws NotFoundException for a non-existent event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);

      await expect(service.rsvp('u1', 'nope', { status: 'GOING' })).rejects.toThrow(NotFoundException);
    });

    it('BLOCKS a GOING rsvp once the event is at capacity', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: 2, organizerId: 'organizer1' });
      prisma.eventAttendee.count.mockResolvedValue(2); // already full

      await expect(service.rsvp('u1', 'e1', { status: 'GOING' })).rejects.toThrow(ForbiddenException);
      expect(prisma.eventAttendee.upsert).not.toHaveBeenCalled();
    });

    it('allows a GOING rsvp when under capacity', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: 5, organizerId: 'organizer1' });
      prisma.eventAttendee.count.mockResolvedValue(2);
      prisma.eventAttendee.upsert.mockResolvedValue({ userId: 'u1', eventId: 'e1', status: 'GOING' });

      await service.rsvp('u1', 'e1', { status: 'GOING' });

      expect(prisma.eventAttendee.upsert).toHaveBeenCalled();
    });

    it('never capacity-checks a NOT_GOING or INTERESTED rsvp', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: 1, organizerId: 'organizer1' });
      prisma.eventAttendee.upsert.mockResolvedValue({ userId: 'u1', eventId: 'e1', status: 'INTERESTED' });

      await service.rsvp('u1', 'e1', { status: 'INTERESTED' });

      expect(prisma.eventAttendee.count).not.toHaveBeenCalled();
      expect(prisma.eventAttendee.upsert).toHaveBeenCalled();
    });

    it('notifies the organizer when someone else RSVPs GOING', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: null, organizerId: 'organizer1', title: 'Book Club' });
      prisma.eventAttendee.upsert.mockResolvedValue({ userId: 'u1', eventId: 'e1', status: 'GOING' });

      await service.rsvp('u1', 'e1', { status: 'GOING' });

      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'organizer1', type: 'EVENT_RSVP' }));
    });

    it('does NOT notify when the organizer RSVPs to their own event', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', capacity: null, organizerId: 'organizer1', title: 'Book Club' });
      prisma.eventAttendee.upsert.mockResolvedValue({ userId: 'organizer1', eventId: 'e1', status: 'GOING' });

      await service.rsvp('organizer1', 'e1', { status: 'GOING' });

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });
});
