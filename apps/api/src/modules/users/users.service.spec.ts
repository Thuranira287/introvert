import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../creator/achievements.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: Record<string, jest.Mock>;
    follow: Record<string, jest.Mock>;
    profile: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
      follow: { create: jest.fn(), deleteMany: jest.fn() },
      profile: { upsert: jest.fn() },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AchievementsService, useValue: { checkAndAward: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('follow', () => {
    it('throws BadRequestException when following yourself', async () => {
      await expect(service.follow('u1', 'u1')).rejects.toThrow(BadRequestException);
      expect(prisma.follow.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.follow('u1', 'u2')).rejects.toThrow(NotFoundException);
    });

    it('creates a follow relationship for a valid target', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      prisma.follow.create.mockResolvedValue({ followerId: 'u1', followingId: 'u2' });

      await service.follow('u1', 'u2');

      expect(prisma.follow.create).toHaveBeenCalledWith({
        data: { followerId: 'u1', followingId: 'u2' },
      });
    });

    it('translates a unique-constraint violation into ConflictException (already following)', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
      prisma.follow.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.follow('u1', 'u2')).rejects.toThrow(ConflictException);
    });
  });

  describe('unfollow', () => {
    it('removes the follow relationship', async () => {
      prisma.follow.deleteMany.mockResolvedValue({ count: 1 });

      await service.unfollow('u1', 'u2');

      expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
        where: { followerId: 'u1', followingId: 'u2' },
      });
    });
  });

  describe('checkUsernameAvailability', () => {
    it('returns true when no user has the username', async () => {
      prisma.user.count.mockResolvedValue(0);
      await expect(service.checkUsernameAvailability('freename')).resolves.toBe(true);
    });

    it('returns false when the username is taken', async () => {
      prisma.user.count.mockResolvedValue(1);
      await expect(service.checkUsernameAvailability('taken')).resolves.toBe(false);
    });

    it('lowercases the username before checking (case-insensitive uniqueness)', async () => {
      prisma.user.count.mockResolvedValue(0);
      await service.checkUsernameAvailability('MixedCase');
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { username: 'mixedcase' } });
    });
  });

  describe('updateProfile', () => {
    it('returns the updated profile when only profile fields change (no displayName)', async () => {
      prisma.profile.upsert.mockResolvedValue({ userId: 'u1', bio: 'New bio' });

      const result = await service.updateProfile('u1', { bio: 'New bio' } as any);

      expect(result).toEqual({ userId: 'u1', bio: 'New bio' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the display name and still returns the profile, not the user', async () => {
      prisma.user.update.mockResolvedValue({ id: 'u1', displayName: 'New Name' });
      prisma.profile.upsert.mockResolvedValue({ userId: 'u1', bio: 'New bio' });

      const result = await service.updateProfile('u1', { displayName: 'New Name', bio: 'New bio' } as any);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { displayName: 'New Name' } });
      expect(result).toEqual({ userId: 'u1', bio: 'New bio' });
    });

    it('does not pass displayName through to the profile record', async () => {
      prisma.user.update.mockResolvedValue({});
      prisma.profile.upsert.mockResolvedValue({});

      await service.updateProfile('u1', { displayName: 'New Name', bio: 'x' } as any);

      const upsert = prisma.profile.upsert.mock.calls[0][0];
      expect(upsert.update).toEqual({ bio: 'x' });
      expect(upsert.create).toEqual({ userId: 'u1', bio: 'x' });
    });
  });
});
