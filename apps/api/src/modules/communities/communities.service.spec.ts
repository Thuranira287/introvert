import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AchievementsService } from '../creator/achievements.service';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  let prisma: {
    community: Record<string, jest.Mock>;
    communityMember: Record<string, jest.Mock>;
    communityPost: Record<string, jest.Mock>;
  };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      community: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
      communityMember: { findUnique: jest.fn(), create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
      communityPost: { create: jest.fn(), findMany: jest.fn() },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AchievementsService, useValue: { checkAndAward: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('generates a unique slug and adds the owner as an ADMIN member', async () => {
      prisma.community.findUnique.mockResolvedValue(null); // slug free on first try
      prisma.community.create.mockImplementation(({ data }) => Promise.resolve({ id: 'c1', ...data }));

      const result = await service.create('owner1', { name: 'Quiet Bookworms' } as any);

      expect(result.slug).toBe('quiet-bookworms');
      const createCall = prisma.community.create.mock.calls[0][0];
      expect(createCall.data.members.create).toEqual({ userId: 'owner1', role: 'ADMIN' });
      expect(createCall.data.ownerId).toBe('owner1');
    });

    it('appends a numeric suffix when the slug is taken', async () => {
      prisma.community.findUnique.mockResolvedValueOnce({ id: 'existing' }).mockResolvedValueOnce(null);
      prisma.community.create.mockImplementation(({ data }) => Promise.resolve({ id: 'c2', ...data }));

      const result = await service.create('owner1', { name: 'Quiet Bookworms' } as any);

      expect(result.slug).toBe('quiet-bookworms-1');
    });

    it('defaults visibility to PUBLIC when not specified', async () => {
      prisma.community.findUnique.mockResolvedValue(null);
      prisma.community.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.create('owner1', { name: 'Test' } as any);

      expect(result.visibility).toBe('PUBLIC');
    });
  });

  describe('join', () => {
    it('throws ConflictException when already a member', async () => {
      prisma.communityMember.findUnique.mockResolvedValue({ userId: 'u1', communityId: 'c1' });

      await expect(service.join('u1', 'c1')).rejects.toThrow(ConflictException);
      expect(prisma.communityMember.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a non-existent community', async () => {
      prisma.communityMember.findUnique.mockResolvedValue(null);
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(service.join('u1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it('notifies the owner when someone else joins', async () => {
      prisma.communityMember.findUnique.mockResolvedValue(null);
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1', name: 'Book Club' });
      prisma.communityMember.create.mockResolvedValue({ userId: 'u1', communityId: 'c1', role: 'MEMBER' });

      await service.join('u1', 'c1');

      expect(notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'owner1', type: 'COMMUNITY_INVITE' }),
      );
    });

    it('does NOT notify when the owner joins their own community', async () => {
      prisma.communityMember.findUnique.mockResolvedValue(null);
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1', name: 'Book Club' });
      prisma.communityMember.create.mockResolvedValue({ userId: 'owner1', communityId: 'c1', role: 'MEMBER' });

      await service.join('owner1', 'c1');

      expect(notifications.create).not.toHaveBeenCalled();
    });
  });

  describe('leave', () => {
    it('BLOCKS the owner from leaving their own community', async () => {
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' });

      await expect(service.leave('owner1', 'c1')).rejects.toThrow(ForbiddenException);
      expect(prisma.communityMember.deleteMany).not.toHaveBeenCalled();
    });

    it('allows a regular member to leave', async () => {
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'owner1' });
      prisma.communityMember.deleteMany.mockResolvedValue({ count: 1 });

      await service.leave('u1', 'c1');

      expect(prisma.communityMember.deleteMany).toHaveBeenCalledWith({
        where: { communityId: 'c1', userId: 'u1' },
      });
    });
  });

  describe('delete', () => {
    it('throws NotFoundException for a non-existent community', async () => {
      prisma.community.findUnique.mockResolvedValue(null);

      await expect(service.delete('u1', 'nope')).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when the caller isn't the owner", async () => {
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'someone-else' });

      await expect(service.delete('u1', 'c1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes when the caller is the owner', async () => {
      prisma.community.findUnique.mockResolvedValue({ id: 'c1', ownerId: 'u1' });
      prisma.community.delete.mockResolvedValue({});

      await service.delete('u1', 'c1');

      expect(prisma.community.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });
  });

  describe('createPost', () => {
    it('BLOCKS a non-member from posting', async () => {
      prisma.communityMember.findUnique.mockResolvedValue(null);

      await expect(service.createPost('u1', 'c1', { content: 'hi' } as any)).rejects.toThrow(ForbiddenException);
      expect(prisma.communityPost.create).not.toHaveBeenCalled();
    });

    it('allows a member to post and notifies other members (not the poster)', async () => {
      prisma.communityMember.findUnique.mockResolvedValue({ userId: 'u1', communityId: 'c1', role: 'MEMBER' });
      prisma.communityPost.create.mockResolvedValue({ id: 'p1', content: 'hi', communityId: 'c1' });
      prisma.communityMember.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }]);

      await service.createPost('u1', 'c1', { content: 'hi' } as any);

      expect(notifications.create).toHaveBeenCalledTimes(2);
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u3' }));
    });
  });

  describe('update', () => {
    it('BLOCKS a plain member (non-moderator) from updating community settings', async () => {
      prisma.communityMember.findUnique.mockResolvedValue({ userId: 'u1', communityId: 'c1', role: 'MEMBER' });

      await expect(service.update('u1', 'c1', { name: 'New name' })).rejects.toThrow(ForbiddenException);
    });

    it('allows a MODERATOR to update community settings', async () => {
      prisma.communityMember.findUnique.mockResolvedValue({ userId: 'u1', communityId: 'c1', role: 'MODERATOR' });
      prisma.community.update.mockResolvedValue({ id: 'c1', name: 'New name' });

      await service.update('u1', 'c1', { name: 'New name' });

      expect(prisma.community.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { name: 'New name' } });
    });
  });

  describe('getUserCommunities', () => {
    it('returns communities the user belongs to, tagged with their role', async () => {
      prisma.communityMember.findMany.mockResolvedValue([
        { role: 'ADMIN', community: { id: 'c1', name: 'Owned Community' } },
        { role: 'MEMBER', community: { id: 'c2', name: 'Joined Community' } },
      ]);

      const result = await service.getUserCommunities('u1');

      expect(result).toEqual([
        { id: 'c1', name: 'Owned Community', myRole: 'ADMIN' },
        { id: 'c2', name: 'Joined Community', myRole: 'MEMBER' },
      ]);
    });
  });
});
