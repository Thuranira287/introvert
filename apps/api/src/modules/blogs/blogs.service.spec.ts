import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../creator/achievements.service';

describe('BlogsService', () => {
  let service: BlogsService;
  let prisma: {
    blog: Record<string, jest.Mock>;
    category: Record<string, jest.Mock>;
    like: Record<string, jest.Mock>;
    bookmark: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      blog: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      category: { findUnique: jest.fn() },
      like: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      bookmark: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AchievementsService, useValue: { checkAndAward: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();

    service = module.get<BlogsService>(BlogsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createBlog', () => {
    it('generates a URL-safe slug from the title', async () => {
      prisma.blog.findFirst.mockResolvedValue(null); // slug is unique on first try
      prisma.blog.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b1', ...data }));

      const result = await service.createBlog('u1', {
        title: 'My First Blog: A Journey!',
        content: 'x'.repeat(60),
      });

      expect(result.slug).toBe('my-first-blog-a-journey');
    });

    it('appends a numeric suffix when the slug is already taken', async () => {
      prisma.blog.findFirst
        .mockResolvedValueOnce({ id: 'existing' }) // base slug taken
        .mockResolvedValueOnce(null); // -1 suffix is free
      prisma.blog.create.mockImplementation(({ data }) => Promise.resolve({ id: 'b2', ...data }));

      const result = await service.createBlog('u1', { title: 'Duplicate Title', content: 'x'.repeat(60) });

      expect(result.slug).toBe('duplicate-title-1');
    });

    it('defaults to DRAFT status when publish is not specified', async () => {
      prisma.blog.findFirst.mockResolvedValue(null);
      prisma.blog.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.createBlog('u1', { title: 'Draft Post', content: 'x'.repeat(60) });

      expect(result.status).toBe('DRAFT');
      expect(result.publishedAt).toBeNull();
    });

    it('sets PUBLISHED status and publishedAt when publish is true', async () => {
      prisma.blog.findFirst.mockResolvedValue(null);
      prisma.blog.create.mockImplementation(({ data }) => Promise.resolve(data));

      const result = await service.createBlog('u1', {
        title: 'Live Post',
        content: 'x'.repeat(60),
        publish: true,
      });

      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateBlog', () => {
    it('throws NotFoundException for a non-existent blog', async () => {
      prisma.blog.findUnique.mockResolvedValue(null);

      await expect(service.updateBlog('nope', 'u1', { title: 'X' })).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when the caller isn't the author", async () => {
      prisma.blog.findUnique.mockResolvedValue({ id: 'b1', authorId: 'someone-else', slug: 's', status: 'DRAFT' });

      await expect(service.updateBlog('b1', 'u1', { title: 'X' })).rejects.toThrow(ForbiddenException);
    });

    it('allows the author to update their own blog', async () => {
      prisma.blog.findUnique.mockResolvedValue({
        id: 'b1',
        authorId: 'u1',
        slug: 'old-slug',
        title: 'Old title',
        status: 'DRAFT',
        readingTime: 1,
      });
      prisma.blog.update.mockResolvedValue({ id: 'b1', title: 'New title' });

      await service.updateBlog('b1', 'u1', { title: 'New title' });

      expect(prisma.blog.update).toHaveBeenCalled();
    });
  });

  describe('deleteBlog', () => {
    it("throws ForbiddenException when the caller isn't the author", async () => {
      prisma.blog.findUnique.mockResolvedValue({ id: 'b1', authorId: 'someone-else' });

      await expect(service.deleteBlog('b1', 'u1')).rejects.toThrow(ForbiddenException);
      expect(prisma.blog.delete).not.toHaveBeenCalled();
    });

    it('deletes when the caller is the author', async () => {
      prisma.blog.findUnique.mockResolvedValue({ id: 'b1', authorId: 'u1' });
      prisma.blog.delete.mockResolvedValue({});

      await service.deleteBlog('b1', 'u1');

      expect(prisma.blog.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    });
  });

  describe('likeBlog', () => {
    it('creates a like when none exists yet (toggle on)', async () => {
      prisma.blog.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.like.findUnique.mockResolvedValue(null);
      prisma.like.create.mockResolvedValue({});

      const result = await service.likeBlog('b1', 'u1');

      expect(result).toEqual({ liked: true });
      expect(prisma.like.create).toHaveBeenCalledWith({ data: { userId: 'u1', blogId: 'b1' } });
    });

    it('removes an existing like (toggle off)', async () => {
      prisma.blog.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.like.findUnique.mockResolvedValue({ userId: 'u1', blogId: 'b1' });
      prisma.like.delete.mockResolvedValue({});

      const result = await service.likeBlog('b1', 'u1');

      expect(result).toEqual({ liked: false });
      expect(prisma.like.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException for a non-existent blog', async () => {
      prisma.blog.findUnique.mockResolvedValue(null);

      await expect(service.likeBlog('nope', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
