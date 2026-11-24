import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from './achievements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACHIEVEMENT_CATALOG } from './achievement-catalog';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let prisma: {
    achievement: Record<string, jest.Mock>;
    userAchievement: Record<string, jest.Mock>;
    blog: Record<string, jest.Mock>;
    communityPost: Record<string, jest.Mock>;
    follow: Record<string, jest.Mock>;
    like: Record<string, jest.Mock>;
    event: Record<string, jest.Mock>;
    communityMember: Record<string, jest.Mock>;
  };
  let notifications: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      achievement: { upsert: jest.fn(), findMany: jest.fn() },
      userAchievement: { findMany: jest.fn(), create: jest.fn() },
      blog: { count: jest.fn() },
      communityPost: { count: jest.fn() },
      follow: { count: jest.fn() },
      like: { count: jest.fn() },
      event: { count: jest.fn() },
      communityMember: { count: jest.fn() },
    };
    notifications = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('ensureSeeded', () => {
    it('upserts every catalog entry by its unique key', async () => {
      prisma.achievement.upsert.mockResolvedValue({});

      await service.ensureSeeded();

      expect(prisma.achievement.upsert).toHaveBeenCalledTimes(ACHIEVEMENT_CATALOG.length);
      expect(prisma.achievement.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: 'first_post' } }),
      );
    });
  });

  describe('checkAndAward', () => {
    const zeroCounts = () => {
      prisma.blog.count.mockResolvedValue(0);
      prisma.communityPost.count.mockResolvedValue(0);
      prisma.follow.count.mockResolvedValue(0);
      prisma.like.count.mockResolvedValue(0);
      prisma.event.count.mockResolvedValue(0);
      prisma.communityMember.count.mockResolvedValue(0);
    };

    it('awards nothing when no threshold is met', async () => {
      zeroCounts();
      prisma.achievement.findMany.mockResolvedValue([
        { id: 'a1', criteriaType: 'BLOG_COUNT', criteriaThreshold: 1, name: 'First Words' },
      ]);
      prisma.userAchievement.findMany.mockResolvedValue([]);

      const result = await service.checkAndAward('u1');

      expect(result).toEqual([]);
      expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    });

    it('awards an achievement whose threshold is newly met', async () => {
      zeroCounts();
      prisma.blog.count.mockResolvedValue(1);
      prisma.achievement.findMany.mockResolvedValue([
        { id: 'a1', criteriaType: 'BLOG_COUNT', criteriaThreshold: 1, name: 'First Words', description: 'x' },
      ]);
      prisma.userAchievement.findMany.mockResolvedValue([]);
      prisma.userAchievement.create.mockResolvedValue({});

      const result = await service.checkAndAward('u1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a1');
      expect(prisma.userAchievement.create).toHaveBeenCalledWith({ data: { userId: 'u1', achievementId: 'a1' } });
      expect(notifications.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'SYSTEM' }));
    });

    it('never re-awards an achievement the user already has', async () => {
      zeroCounts();
      prisma.blog.count.mockResolvedValue(5); // well above threshold
      prisma.achievement.findMany.mockResolvedValue([
        { id: 'a1', criteriaType: 'BLOG_COUNT', criteriaThreshold: 1, name: 'First Words' },
      ]);
      prisma.userAchievement.findMany.mockResolvedValue([{ achievementId: 'a1' }]); // already earned

      const result = await service.checkAndAward('u1');

      expect(result).toEqual([]);
      expect(prisma.userAchievement.create).not.toHaveBeenCalled();
    });

    it('awards multiple newly-qualifying achievements in one pass', async () => {
      zeroCounts();
      prisma.blog.count.mockResolvedValue(10);
      prisma.follow.count.mockResolvedValue(10);
      prisma.achievement.findMany.mockResolvedValue([
        { id: 'a1', criteriaType: 'BLOG_COUNT', criteriaThreshold: 1, name: 'First Words' },
        { id: 'a2', criteriaType: 'BLOG_COUNT', criteriaThreshold: 10, name: 'Prolific Writer' },
        { id: 'a3', criteriaType: 'FOLLOWER_COUNT', criteriaThreshold: 10, name: 'Rising Star' },
      ]);
      prisma.userAchievement.findMany.mockResolvedValue([]);
      prisma.userAchievement.create.mockResolvedValue({});

      const result = await service.checkAndAward('u1');

      expect(result).toHaveLength(3);
    });
  });

  describe('getProgress', () => {
    it('sorts earned achievements before unearned ones', async () => {
      prisma.achievement.findMany.mockResolvedValue([
        { id: 'a1', criteriaType: 'BLOG_COUNT', criteriaThreshold: 10, name: 'Prolific Writer' },
        { id: 'a2', criteriaType: 'BLOG_COUNT', criteriaThreshold: 1, name: 'First Words' },
      ]);
      prisma.userAchievement.findMany.mockResolvedValue([{ achievementId: 'a2', earnedAt: new Date() }]);
      prisma.blog.count.mockResolvedValue(1);
      prisma.communityPost.count.mockResolvedValue(0);
      prisma.follow.count.mockResolvedValue(0);
      prisma.like.count.mockResolvedValue(0);
      prisma.event.count.mockResolvedValue(0);
      prisma.communityMember.count.mockResolvedValue(0);

      const result = await service.getProgress('u1');

      expect(result[0].id).toBe('a2');
      expect(result[0].isEarned).toBe(true);
      expect(result[1].isEarned).toBe(false);
    });
  });
});
