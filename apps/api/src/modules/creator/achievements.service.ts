import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ACHIEVEMENT_CATALOG, AchievementDefinition } from './achievement-catalog';

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Upserts the catalog by key on startup so new achievements can be added
   * to achievement-catalog.ts without a manual migration step, while never
   * touching users' already-earned progress. */
  async onModuleInit() {
    try {
      await this.ensureSeeded();
    } catch (err) {
      // Don't crash boot if the DB isn't reachable yet during local dev.
      this.logger.warn(`Achievement catalog seed skipped: ${(err as Error).message}`);
    }
  }

  async ensureSeeded() {
    for (const def of ACHIEVEMENT_CATALOG) {
      await this.prisma.achievement.upsert({
        where: { key: def.key },
        create: def,
        update: {
          name: def.name,
          description: def.description,
          icon: def.icon,
          criteriaType: def.criteriaType,
          criteriaThreshold: def.criteriaThreshold,
        },
      });
    }
  }

  /**
   * Computes the user's current value for every criteria type in one pass,
   * then awards any achievement whose threshold is newly met. Call this
   * after any action that could move the needle — a blog/community post
   * being published, a follow, an event being organized. Cheap enough to
   * call synchronously; if this ever becomes a hot path, move to a queue.
   */
  async checkAndAward(userId: string) {
    const [blogCount, communityPostCount, followerCount, likesReceived, eventsOrganized, communitiesJoined] =
      await Promise.all([
        this.prisma.blog.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
        this.prisma.communityPost.count({ where: { authorId: userId } }),
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.like.count({ where: { blog: { authorId: userId } } }),
        this.prisma.event.count({ where: { organizerId: userId } }),
        this.prisma.communityMember.count({ where: { userId } }),
      ]);

    const progress: Record<AchievementDefinition['criteriaType'], number> = {
      BLOG_COUNT: blogCount,
      COMMUNITY_POST_COUNT: communityPostCount,
      FOLLOWER_COUNT: followerCount,
      LIKES_RECEIVED: likesReceived,
      EVENTS_ORGANIZED: eventsOrganized,
      COMMUNITIES_JOINED: communitiesJoined,
    };

    const [achievements, alreadyEarned] = await Promise.all([
      this.prisma.achievement.findMany(),
      this.prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
    ]);
    const earnedIds = new Set(alreadyEarned.map((e) => e.achievementId));

    const newlyEarned: typeof achievements = [];

    for (const achievement of achievements) {
      if (earnedIds.has(achievement.id)) continue;
      if (progress[achievement.criteriaType as AchievementDefinition['criteriaType']] >= achievement.criteriaThreshold) {
        newlyEarned.push(achievement);
      }
    }

    for (const achievement of newlyEarned) {
      await this.prisma.userAchievement.create({ data: { userId, achievementId: achievement.id } });
      await this.notificationsService.create({
        userId,
        type: 'SYSTEM',
        title: `Achievement unlocked: ${achievement.name}`,
        body: achievement.description,
        data: { achievementId: achievement.id },
      });
    }

    return newlyEarned;
  }

  async getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  /** All achievements with the user's current progress toward each —
   * powers a "3 of 9 unlocked, 60% to your next badge" style UI. */
  async getProgress(userId: string) {
    const [achievements, earned] = await Promise.all([
      this.prisma.achievement.findMany(),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);
    const earnedMap = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));

    const [blogCount, communityPostCount, followerCount, likesReceived, eventsOrganized, communitiesJoined] =
      await Promise.all([
        this.prisma.blog.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
        this.prisma.communityPost.count({ where: { authorId: userId } }),
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.like.count({ where: { blog: { authorId: userId } } }),
        this.prisma.event.count({ where: { organizerId: userId } }),
        this.prisma.communityMember.count({ where: { userId } }),
      ]);

    const progress: Record<AchievementDefinition['criteriaType'], number> = {
      BLOG_COUNT: blogCount,
      COMMUNITY_POST_COUNT: communityPostCount,
      FOLLOWER_COUNT: followerCount,
      LIKES_RECEIVED: likesReceived,
      EVENTS_ORGANIZED: eventsOrganized,
      COMMUNITIES_JOINED: communitiesJoined,
    };

    return achievements
      .map((a) => ({
        ...a,
        currentValue: progress[a.criteriaType as AchievementDefinition['criteriaType']],
        earnedAt: earnedMap.get(a.id) ?? null,
        isEarned: earnedMap.has(a.id),
      }))
      .sort((a, b) => (a.isEarned === b.isEarned ? 0 : a.isEarned ? -1 : 1));
  }
}
