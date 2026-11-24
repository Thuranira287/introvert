import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateUserProfileDto } from './dto';
import { AchievementsService } from '../creator/achievements.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        _count: { select: { followers: true, following: true, blogs: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async findByUsername(username: string, viewerId?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
      },
      include: {
        profile: true,
        _count: { select: { followers: true, following: true, blogs: true } },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    let isFollowing = false;
    if (viewerId && viewerId !== user.id) {
      const follow = await this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
      });
      isFollowing = Boolean(follow);
    }

    return { ...this.sanitizeUser(user), isFollowing };
  }

  async findMany(query: { skip?: number; take?: number; search?: string; sortBy?: 'recent' | 'popular' }) {
    const { skip = 0, take = 20, search, sortBy = 'recent' } = query;

    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput =
      sortBy === 'popular' ? { followers: { _count: 'desc' } } : { createdAt: 'desc' };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { profile: true, _count: { select: { followers: true, following: true, blogs: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.sanitizeUser(u)),
      pagination: { total, skip, take, pages: Math.ceil(total / take) },
    };
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const { displayName, ...profileFields } = dto;

    const operations = [
      ...(displayName ? [this.prisma.user.update({ where: { id: userId }, data: { displayName } })] : []),
      this.prisma.profile.upsert({
        where: { userId },
        create: { userId, ...profileFields },
        update: profileFields,
      }),
    ];
    // The profile upsert is always the last operation; the user update is only present when displayName changed.
    const results = await this.prisma.$transaction(operations);
    const profile = results[results.length - 1];

    this.logger.log(`Profile updated: ${userId}`);
    return profile;
  }

  async deactivate(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    this.logger.log(`User deactivated: ${userId}`);
  }

  async hardDelete(userId: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Hard delete not allowed in production');
    }
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.warn(`User hard deleted: ${userId}`);
  }

  async checkUsernameAvailability(username: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    return count === 0;
  }

  async checkEmailAvailability(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    return count === 0;
  }

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: followingId } });
    if (!target) throw new NotFoundException('User not found');

    try {
      const result = await this.prisma.follow.create({ data: { followerId, followingId } });

      this.achievementsService.checkAndAward(followingId).catch((err) =>
        this.logger.warn(`Achievement check failed for user ${followingId}: ${err.message}`),
      );

      return result;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Already following this user');
      }
      throw error;
    }
  }

  async unfollow(followerId: string, followingId: string) {
    return this.prisma.follow.deleteMany({ where: { followerId, followingId } });
  }

  async getUserStats(userId: string) {
    const [followerCount, followingCount, friendCount, blogCount, messageCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.friendship.count({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      this.prisma.blog.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
      this.prisma.message.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
    ]);

    return {
      followers: followerCount,
      following: followingCount,
      friends: friendCount,
      blogs: blogCount,
      messages: messageCount,
    };
  }

  async searchUsers(query: string, limit = 20) {
    if (!query || query.length < 2) return [];

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profile: { select: { avatarUrl: true, bio: true, interests: true } },
      },
      take: limit,
    });
  }

  async getTrendingUsers(limit = 10) {
    return this.prisma.user.findMany({
      where: { isActive: true },
      include: {
        profile: true,
        _count: { select: { followers: true, blogs: true } },
      },
      orderBy: [{ followers: { _count: 'desc' } }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async getSuggestedUsers(userId: string, limit = 10) {
    const suggested = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        isActive: true,
        followers: { none: { followerId: userId } },
      },
      include: {
        profile: true,
        _count: { select: { followers: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: limit,
    });

    return suggested.map((u) => this.sanitizeUser(u));
  }

  private sanitizeUser(user: any) {
    const { passwordHash, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }
}
