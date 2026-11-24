import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { slugify } from '../../utils/slugify';
import { CreateCommunityDto, UpdateCommunityDto, CreateCommunityPostDto } from './dto';
import { AchievementsService } from '../creator/achievements.service';

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async create(ownerId: string, dto: CreateCommunityDto) {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.community.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const community = await this.prisma.community.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        visibility: dto.visibility ?? 'PUBLIC',
        coverImageUrl: dto.coverImageUrl,
        ownerId,
        members: {
          create: { userId: ownerId, role: 'ADMIN' },
        },
      },
      include: { _count: { select: { members: true } } },
    });

    return community;
  }

  async findAll(search?: string) {
    return this.prisma.community.findMany({
      where: {
        visibility: 'PUBLIC',
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { members: true, posts: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      include: {
        owner: { select: { id: true, username: true, displayName: true } },
        _count: { select: { members: true, posts: true } },
      },
    });

    if (!community) throw new NotFoundException('Community not found');
    return community;
  }

  async update(userId: string, communityId: string, dto: UpdateCommunityDto) {
    await this.assertModerator(userId, communityId);
    return this.prisma.community.update({ where: { id: communityId }, data: dto });
  }

  async delete(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this community');
    }
    return this.prisma.community.delete({ where: { id: communityId } });
  }

  async join(userId: string, communityId: string) {
    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (existing) throw new ConflictException('Already a member');

    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const member = await this.prisma.communityMember.create({
      data: { communityId, userId, role: 'MEMBER' },
    });

    if (community.ownerId !== userId) {
      await this.notificationsService.create({
        userId: community.ownerId,
        type: 'COMMUNITY_INVITE',
        title: `Someone joined ${community.name}`,
        data: { communityId },
      });
    }

    this.achievementsService.checkAndAward(userId).catch(() => {
      // Non-critical side effect — a failed check here shouldn't fail the join.
    });

    return member;
  }

  async leave(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (community?.ownerId === userId) {
      throw new ForbiddenException('Owner cannot leave their own community — transfer ownership or delete it');
    }
    return this.prisma.communityMember.deleteMany({ where: { communityId, userId } });
  }

  /** Communities the user belongs to (owner or member) — used to populate
   * "attach to a community" pickers, e.g. when creating an event. */
  async getUserCommunities(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: { include: { _count: { select: { members: true } } } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({ ...m.community, myRole: m.role }));
  }

  async getMembers(communityId: string) {
    return this.prisma.communityMember.findMany({
      where: { communityId },
      include: { user: { select: { id: true, username: true, displayName: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async createPost(userId: string, communityId: string, dto: CreateCommunityPostDto) {
    await this.assertMember(userId, communityId);

    const post = await this.prisma.communityPost.create({
      data: { communityId, authorId: userId, content: dto.content, imageUrl: dto.imageUrl },
      include: { author: { select: { id: true, username: true, displayName: true } } },
    });

    this.achievementsService.checkAndAward(userId).catch(() => {
      // Non-critical side effect — a failed check here shouldn't fail the post.
    });

    // Notify other members (fan-out kept simple; a large community would batch/queue this)
    const members = await this.prisma.communityMember.findMany({
      where: { communityId, userId: { not: userId } },
      select: { userId: true },
    });

    await Promise.all(
      members.map((m) =>
        this.notificationsService.create({
          userId: m.userId,
          type: 'COMMUNITY_POST',
          title: 'New post in your community',
          body: dto.content.slice(0, 100),
          data: { communityId, postId: post.id },
        }),
      ),
    );

    return post;
  }

  async getPosts(communityId: string) {
    return this.prisma.communityPost.findMany({
      where: { communityId },
      include: { author: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertMember(userId: string, communityId: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this community');
    return member;
  }

  private async assertModerator(userId: string, communityId: string) {
    const member = await this.assertMember(userId, communityId);
    if (member.role !== 'ADMIN' && member.role !== 'MODERATOR') {
      throw new ForbiddenException('Requires moderator or admin role');
    }
    return member;
  }
}
