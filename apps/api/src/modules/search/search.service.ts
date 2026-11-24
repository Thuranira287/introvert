import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fans a query out across users, blogs, and communities in parallel.
   * Kept intentionally simple (ILIKE-style `contains`) — worth swapping for
   * Postgres full-text search or a dedicated search service (Meilisearch,
   * Algolia) once content volume makes substring matching too slow.
   */
  async searchAll(query: string, limit = 5) {
    if (!query || query.trim().length < 2) {
      return { users: [], blogs: [], communities: [] };
    }

    const [users, blogs, communities] = await Promise.all([
      this.prisma.user.findMany({
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
          profile: { select: { avatarUrl: true, bio: true } },
        },
        take: limit,
      }),

      this.prisma.blog.findMany({
        where: {
          status: 'PUBLISHED',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query.toLowerCase()] } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          author: { select: { username: true, displayName: true } },
        },
        take: limit,
      }),

      this.prisma.community.findMany({
        where: {
          visibility: 'PUBLIC',
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { members: true } },
        },
        take: limit,
      }),
    ]);

    return { users, blogs, communities };
  }
}
