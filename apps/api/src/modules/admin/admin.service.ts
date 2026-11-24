import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
} as const;

/** Fields safe to return from admin user mutations; never includes credentials. */
const SAFE_USER_RESULT_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  role: true,
  isActive: true,
  isVerified: true,
  verificationType: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsers30d,
      newUsers7d,
      activeUsers,
      totalBlogs,
      publishedBlogs,
      totalCommunities,
      totalEvents,
      upcomingEvents,
      pendingReports,
      totalMessages,
      totalAIConversations,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since30Days } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since7Days } } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.blog.count(),
      this.prisma.blog.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.community.count(),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { startsAt: { gte: new Date() }, status: 'UPCOMING' } }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.message.count(),
      this.prisma.aiConversation.count(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, new30d: newUsers30d, new7d: newUsers7d },
      blogs: { total: totalBlogs, published: publishedBlogs },
      communities: { total: totalCommunities },
      events: { total: totalEvents, upcoming: upcomingEvents },
      reports: { pending: pendingReports },
      engagement: { messages: totalMessages, aiConversations: totalAIConversations },
    };
  }

  /** Daily new-user signups for the last N days — feeds a simple growth chart. */
  async getSignupTrend(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const byDay = new Map<string, number>();
    for (const { createdAt } of users) {
      const key = createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async listUsers(query: { skip?: number; take?: number; search?: string }) {
    const { skip = 0, take = 20, search } = query;

    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isVerified: true,
          verificationType: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { blogs: true, followers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, pagination: { total, skip, take, pages: Math.ceil(total / take) } };
  }

  async updateUserRole(actingAdminId: string, targetUserId: string, role: string) {
    const actingAdmin = await this.prisma.user.findUnique({ where: { id: actingAdminId } });
    if (!actingAdmin) throw new NotFoundException('Acting admin not found');

    // Only SUPER_ADMIN can grant/revoke ADMIN or SUPER_ADMIN roles — a plain
    // ADMIN can moderate up to MODERATOR/VERIFIED_USER/USER only.
    const restrictedRoles = ['ADMIN', 'SUPER_ADMIN'];
    if (restrictedRoles.includes(role) && actingAdmin.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a super admin can grant admin-level roles');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (restrictedRoles.includes(target.role) && actingAdmin.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a super admin can modify another admin');
    }

    const updated = await this.prisma.user.update({ where: { id: targetUserId }, data: { role: role as any }, select: SAFE_USER_RESULT_SELECT });

    await this.logAction(actingAdminId, 'user.role_changed', { targetUserId, newRole: role });
    return updated;
  }

  async suspendUser(actingAdminId: string, targetUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (['ADMIN', 'SUPER_ADMIN'].includes(target.role)) {
      throw new ForbiddenException('Cannot suspend another admin from here');
    }

    const updated = await this.prisma.user.update({ where: { id: targetUserId }, data: { isActive: false }, select: SAFE_USER_RESULT_SELECT });
    await this.prisma.refreshToken.updateMany({ where: { userId: targetUserId }, data: { revoked: true } });

    await this.logAction(actingAdminId, 'user.suspended', { targetUserId });
    return updated;
  }

  async reactivateUser(actingAdminId: string, targetUserId: string) {
    const updated = await this.prisma.user.update({ where: { id: targetUserId }, data: { isActive: true }, select: SAFE_USER_RESULT_SELECT });
    await this.logAction(actingAdminId, 'user.reactivated', { targetUserId });
    return updated;
  }

  async createReport(reporterId: string, data: { reportedUserId?: string; entityType: string; entityId: string; reason: string }) {
    return this.prisma.report.create({
      data: { reporterId, ...data },
    });
  }

  async listReports(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        reporter: { select: USER_SELECT },
        reportedUser: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReportStatus(actingAdminId: string, reportId: string, status: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    const updated = await this.prisma.report.update({ where: { id: reportId }, data: { status: status as any } });
    await this.logAction(actingAdminId, 'report.status_changed', { reportId, newStatus: status });
    return updated;
  }

  /** Admin-level content removal — bypasses the normal "must be the author" check in BlogsService. */
  async removeBlog(actingAdminId: string, blogId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');

    await this.prisma.blog.delete({ where: { id: blogId } });
    await this.logAction(actingAdminId, 'blog.removed', { blogId, title: blog.title });
    return { success: true };
  }

  async removeComment(actingAdminId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.logAction(actingAdminId, 'comment.removed', { commentId });
    return { success: true };
  }

  async listCommunities(query: { skip?: number; take?: number; search?: string }) {
    const { skip = 0, take = 20, search } = query;
    const where = search ? { name: { contains: search, mode: 'insensitive' as const } } : {};

    const [communities, total] = await Promise.all([
      this.prisma.community.findMany({
        where,
        include: {
          owner: { select: USER_SELECT },
          _count: { select: { members: true, posts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.community.count({ where }),
    ]);

    return { data: communities, pagination: { total, skip, take, pages: Math.ceil(total / take) } };
  }

  /** Admin-level community removal — bypasses the "must be the owner" check CommunitiesService enforces for normal users. */
  async removeCommunity(actingAdminId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    await this.prisma.community.delete({ where: { id: communityId } });
    await this.logAction(actingAdminId, 'community.removed', { communityId, name: community.name });
    return { success: true };
  }

  async removeCommunityPost(actingAdminId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Community post not found');

    await this.prisma.communityPost.delete({ where: { id: postId } });
    await this.logAction(actingAdminId, 'community_post.removed', { postId, communityId: post.communityId });
    return { success: true };
  }

  /** Demotes/promotes a community member's role — e.g. to resolve a dispute the community's own owner can't or won't. */
  async setCommunityMemberRole(actingAdminId: string, communityId: string, userId: string, role: string) {
    const member = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!member) throw new NotFoundException('User is not a member of this community');

    const updated = await this.prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId } },
      data: { role: role as any },
    });
    await this.logAction(actingAdminId, 'community_member.role_changed', { communityId, userId, newRole: role });
    return updated;
  }

  async removeCommunityMember(actingAdminId: string, communityId: string, userId: string) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');
    if (community.ownerId === userId) {
      throw new ForbiddenException('Cannot remove the community owner — delete the community instead');
    }

    await this.prisma.communityMember.deleteMany({ where: { communityId, userId } });
    await this.logAction(actingAdminId, 'community_member.removed', { communityId, userId });
    return { success: true };
  }

  async listEvents(query: { skip?: number; take?: number; search?: string; includePast?: boolean }) {
    const { skip = 0, take = 20, search, includePast = false } = query;
    const where = {
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(includePast ? {} : { startsAt: { gte: new Date() } }),
    };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          organizer: { select: USER_SELECT },
          community: { select: { id: true, name: true, slug: true } },
          _count: { select: { attendees: true } },
        },
        orderBy: { startsAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);

    return { data: events, pagination: { total, skip, take, pages: Math.ceil(total / take) } };
  }

  /** Admin-level cancellation — bypasses the "must be the organizer" check EventsService enforces for normal users. */
  async cancelEvent(actingAdminId: string, eventId: string, reason?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const updated = await this.prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } });
    await this.logAction(actingAdminId, 'event.cancelled', { eventId, title: event.title, reason });
    return updated;
  }

  async removeEvent(actingAdminId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    await this.prisma.event.delete({ where: { id: eventId } });
    await this.logAction(actingAdminId, 'event.removed', { eventId, title: event.title });
    return { success: true };
  }

  async grantVerification(actingAdminId: string, targetUserId: string) {
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isVerified: true, verificationType: 'ADMIN_GRANTED', verifiedAt: new Date() },
      select: SAFE_USER_RESULT_SELECT,
    });

    await this.logAction(actingAdminId, 'user.verification_granted', { targetUserId });
    return updated;
  }

  async revokeVerification(actingAdminId: string, targetUserId: string) {
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { isVerified: false, verificationType: null, verifiedAt: null },
      select: SAFE_USER_RESULT_SELECT,
    });

    await this.logAction(actingAdminId, 'user.verification_revoked', { targetUserId });
    return updated;
  }

  async getAuditLogs(skip = 0, take = 50) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        include: { user: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count(),
    ]);
    return { data: logs, pagination: { total, skip, take } };
  }

  private async logAction(userId: string, action: string, metadata: Record<string, unknown>) {
    await this.prisma.auditLog.create({ data: { userId, action, metadata: metadata as any } });
  }
}
