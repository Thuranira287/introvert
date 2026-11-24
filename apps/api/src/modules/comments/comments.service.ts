import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profile: { select: { avatarUrl: true } },
} as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, blogId: string, content: string, parentId?: string) {
    const blog = await this.prisma.blog.findUnique({ where: { id: blogId } });
    if (!blog) throw new NotFoundException('Blog not found');

    if (parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: parentId } });
      if (!parent || parent.blogId !== blogId) {
        throw new NotFoundException('Parent comment not found on this blog');
      }
    }

    const comment = await this.prisma.comment.create({
      data: { blogId, authorId: userId, content, parentId },
      include: { author: { select: AUTHOR_SELECT } },
    });

    // Notify the blog author (top-level comment) or the parent comment's
    // author (reply) — whichever is more relevant, and never notify yourself.
    const notifyUserId = parentId
      ? (await this.prisma.comment.findUnique({ where: { id: parentId } }))?.authorId
      : blog.authorId;

    if (notifyUserId && notifyUserId !== userId) {
      await this.notificationsService.create({
        userId: notifyUserId,
        type: 'COMMENT',
        title: parentId ? 'Someone replied to your comment' : 'New comment on your blog',
        body: content.slice(0, 100),
        data: { blogId, commentId: comment.id },
      });
    }

    return comment;
  }

  async findByBlog(blogId: string) {
    // Fetch all comments for the blog, then assemble into a top-level +
    // nested-replies tree in memory — simpler and fast enough at blog-post
    // comment volumes than a recursive CTE.
    const comments = await this.prisma.comment.findMany({
      where: { blogId },
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { replies: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byId = new Map(comments.map((c) => [c.id, { ...c, replies: [] as any[] }]));
    const roots: any[] = [];

    for (const comment of byId.values()) {
      if (comment.parentId && byId.has(comment.parentId)) {
        byId.get(comment.parentId)!.replies.push(comment);
      } else {
        roots.push(comment);
      }
    }

    return roots;
  }

  async update(userId: string, commentId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('You can only edit your own comments');

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async delete(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.authorId !== userId) throw new ForbiddenException('You can only delete your own comments');

    // Cascades to replies via the schema's onDelete: Cascade on Comment.parent
    await this.prisma.comment.delete({ where: { id: commentId } });
  }
}
