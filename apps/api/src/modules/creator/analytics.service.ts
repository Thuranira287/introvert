import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything a user's own "My Progress" dashboard needs in one call:
   * lifetime totals, a 30-day trend for growth charts, and their
   * best-performing content. Scoped to the requesting user only — this is
   * not a public-facing stats endpoint.
   */
  async getUserDashboard(userId: string) {
    const since30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalBlogs,
      totalLikesReceived,
      totalCommentsReceived,
      totalFollowers,
      totalFollowing,
      totalCommunityPosts,
      totalEventsOrganized,
      profileViews30d,
      topBlogs,
    ] = await Promise.all([
      this.prisma.blog.count({ where: { authorId: userId, status: 'PUBLISHED' } }),
      this.prisma.like.count({ where: { blog: { authorId: userId } } }),
      this.prisma.comment.count({ where: { blog: { authorId: userId } } }),
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
      this.prisma.communityPost.count({ where: { authorId: userId } }),
      this.prisma.event.count({ where: { organizerId: userId } }),
      this.prisma.profileView.count({ where: { profileUserId: userId, createdAt: { gte: since30Days } } }),
      this.prisma.blog.findMany({
        where: { authorId: userId, status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          slug: true,
          views: true,
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { views: 'desc' },
        take: 5,
      }),
    ]);

    const [followerTrend, blogTrend] = await Promise.all([
      this.getDailyTrend('follow', { followingId: userId }, since30Days),
      this.getDailyTrend('blog', { authorId: userId, status: 'PUBLISHED' }, since30Days, 'publishedAt'),
    ]);

    return {
      totals: {
        blogs: totalBlogs,
        likesReceived: totalLikesReceived,
        commentsReceived: totalCommentsReceived,
        followers: totalFollowers,
        following: totalFollowing,
        communityPosts: totalCommunityPosts,
        eventsOrganized: totalEventsOrganized,
      },
      last30Days: {
        profileViews: profileViews30d,
        newFollowers: followerTrend.reduce((sum, d) => sum + d.count, 0),
        followerTrend,
        blogTrend,
      },
      topContent: topBlogs,
    };
  }

  /** Daily counts for the last N days for a simple growth-chart line, e.g. new followers per day. */
  private async getDailyTrend(
    model: 'follow' | 'blog',
    where: Record<string, unknown>,
    since: Date,
    dateField: 'createdAt' | 'publishedAt' = 'createdAt',
  ) {
    const rows: Array<Record<string, any>> =
      model === 'follow'
        ? await this.prisma.follow.findMany({ where: { ...where, createdAt: { gte: since } }, select: { createdAt: true } })
        : await this.prisma.blog.findMany({
            where: { ...where, publishedAt: { gte: since } },
            select: { publishedAt: true },
          });

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const date: Date | null = row[dateField];
      if (!date) continue;
      const key = date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return Array.from(byDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
