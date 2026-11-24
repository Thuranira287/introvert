import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { slugify } from '../../utils/slugify';
import { AchievementsService } from '../creator/achievements.service';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profile: { select: { avatarUrl: true } },
} as const;

@Injectable()
export class BlogsService {
  private readonly logger = new Logger(BlogsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async createBlog(
    userId: string,
    data: {
      title: string;
      content: string;
      excerpt?: string;
      coverImageUrl?: string;
      categoryId?: string;
      tags?: string[];
      publish?: boolean;
    },
  ) {
    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: data.categoryId } });
      if (!category) throw new BadRequestException('Category not found');
    }

    const slug = await this.generateUniqueSlug(data.title);
    const readingTime = this.computeReadingTime(data.content);
    const publish = data.publish ?? false;

    const blog = await this.prisma.blog.create({
      data: {
        authorId: userId,
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImageUrl: data.coverImageUrl,
        categoryId: data.categoryId,
        tags: data.tags ?? [],
        readingTime,
        status: publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: publish ? new Date() : null,
      },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        _count: { select: { comments: true, likes: true } },
      },
    });

    this.logger.log(`Blog created: ${blog.id} by user ${userId}`);

    if (publish) {
      this.achievementsService.checkAndAward(userId).catch((err) =>
        this.logger.warn(`Achievement check failed for user ${userId}: ${err.message}`),
      );
    }

    return blog;
  }

  async getBlogById(id: string, viewerId?: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        comments: {
          include: { author: { select: AUTHOR_SELECT } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { comments: true, likes: true, bookmarks: true } },
      },
    });

    if (!blog) throw new NotFoundException('Blog not found');

    const isOwner = viewerId && blog.authorId === viewerId;
    if (blog.status !== 'PUBLISHED' && !isOwner) {
      throw new ForbiddenException('This blog is not published');
    }

    if (!isOwner) {
      await this.prisma.blog.update({ where: { id }, data: { views: { increment: 1 } } });
    }

    return blog;
  }

  async getBlogBySlug(slug: string, viewerId?: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { slug },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        _count: { select: { comments: true, likes: true } },
      },
    });

    if (!blog) throw new NotFoundException('Blog not found');

    const isOwner = viewerId && blog.authorId === viewerId;
    if (blog.status !== 'PUBLISHED' && !isOwner) {
      throw new NotFoundException('Blog not found');
    }

    if (!isOwner) {
      await this.prisma.blog.update({ where: { id: blog.id }, data: { views: { increment: 1 } } });
    }

    return blog;
  }

  async listBlogs(query: {
    skip?: number;
    take?: number;
    categoryId?: string;
    search?: string;
    sortBy?: 'recent' | 'popular' | 'trending';
    featured?: boolean;
  }) {
    const { skip = 0, take = 20, categoryId, search, sortBy = 'recent', featured } = query;

    const where: Prisma.BlogWhereInput = {
      status: 'PUBLISHED',
      ...(categoryId && { categoryId }),
      ...(featured !== undefined && { featured }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { tags: { hasSome: [search] } },
        ],
      }),
    };

    const orderBy: Prisma.BlogOrderByWithRelationInput =
      sortBy === 'popular'
        ? { likes: { _count: 'desc' } }
        : sortBy === 'trending'
          ? { views: 'desc' }
          : { publishedAt: 'desc' };

    const [blogs, total] = await Promise.all([
      this.prisma.blog.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          author: { select: AUTHOR_SELECT },
          category: true,
          _count: { select: { comments: true, likes: true } },
        },
      }),
      this.prisma.blog.count({ where }),
    ]);

    return { data: blogs, pagination: { total, skip, take, pages: Math.ceil(total / take) } };
  }

  async getUserBlogs(userId: string, publishedOnly = true) {
    return this.prisma.blog.findMany({
      where: { authorId: userId, ...(publishedOnly && { status: 'PUBLISHED' }) },
      include: { category: true, _count: { select: { comments: true, likes: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBlog(
    blogId: string,
    userId: string,
    data: Partial<{
      title: string;
      content: string;
      excerpt: string;
      coverImageUrl: string;
      categoryId: string;
      tags: string[];
      featured: boolean;
      publish: boolean;
    }>,
  ) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');
    if (blog.authorId !== userId) throw new ForbiddenException('You can only edit your own blogs');

    let slug = blog.slug;
    if (data.title && data.title !== blog.title) {
      slug = await this.generateUniqueSlug(data.title, blogId);
    }

    const readingTime = data.content ? this.computeReadingTime(data.content) : blog.readingTime;
    const { publish, ...rest } = data;
    const wasPublished = blog.status === 'PUBLISHED';

    const updated = await this.prisma.blog.update({
      where: { id: blogId },
      data: {
        ...rest,
        slug,
        readingTime,
        ...(publish !== undefined && {
          status: publish ? 'PUBLISHED' : 'DRAFT',
          ...(publish && !wasPublished ? { publishedAt: new Date() } : {}),
        }),
      },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        _count: { select: { comments: true, likes: true } },
      },
    });

    this.logger.log(`Blog updated: ${blogId}`);

    if (publish && !wasPublished) {
      this.achievementsService.checkAndAward(userId).catch((err) =>
        this.logger.warn(`Achievement check failed for user ${userId}: ${err.message}`),
      );
    }

    return updated;
  }

  async deleteBlog(blogId: string, userId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');
    if (blog.authorId !== userId) throw new ForbiddenException('You can only delete your own blogs');

    await this.prisma.blog.delete({ where: { id: blogId } });
    this.logger.log(`Blog deleted: ${blogId}`);
  }

  async likeBlog(blogId: string, userId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');

    const existing = await this.prisma.like.findUnique({
      where: { userId_blogId: { userId, blogId } },
    });

    if (existing) {
      await this.prisma.like.delete({ where: { userId_blogId: { userId, blogId } } });
      return { liked: false };
    }

    await this.prisma.like.create({ data: { userId, blogId } });

    this.achievementsService.checkAndAward(blog.authorId).catch((err) =>
      this.logger.warn(`Achievement check failed for user ${blog.authorId}: ${err.message}`),
    );

    return { liked: true };
  }

  async bookmarkBlog(blogId: string, userId: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_blogId: { userId, blogId } },
    });

    if (existing) {
      await this.prisma.bookmark.delete({ where: { userId_blogId: { userId, blogId } } });
      return { bookmarked: false };
    }

    await this.prisma.bookmark.create({ data: { userId, blogId } });
    return { bookmarked: true };
  }

  async getUserBookmarks(userId: string) {
    return this.prisma.bookmark.findMany({
      where: { userId },
      include: {
        blog: { include: { author: { select: AUTHOR_SELECT }, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTrendingBlogs(limit = 10) {
    return this.prisma.blog.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: [{ views: 'desc' }, { likes: { _count: 'desc' } }],
      take: limit,
    });
  }

  async getFeaturedBlogs() {
    return this.prisma.blog.findMany({
      where: { status: 'PUBLISHED', featured: true },
      include: {
        author: { select: AUTHOR_SELECT },
        category: true,
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  private computeReadingTime(content: string): number {
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title);
    let slug = base;
    let suffix = 1;

    while (
      await this.prisma.blog.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }

    return slug;
  }
}
