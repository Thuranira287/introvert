import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from './push.service';

export interface CreateNotificationInput {
  userId: string;
  type:
    | 'LIKE'
    | 'COMMENT'
    | 'FOLLOW'
    | 'MESSAGE'
    | 'ANONYMOUS_MESSAGE'
    | 'COMMUNITY_INVITE'
    | 'COMMUNITY_POST'
    | 'EVENT_REMINDER'
    | 'EVENT_RSVP'
    | 'MENTION'
    | 'SYSTEM';
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Injected lazily by NotificationsGateway to avoid a circular import
  // (Gateway needs the service to persist; service needs the gateway to
  // push in real time). Set once at gateway bootstrap.
  private emitter?: (userId: string, event: string, payload: unknown) => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  registerEmitter(emitter: (userId: string, event: string, payload: unknown) => void) {
    this.emitter = emitter;
  }

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as any,
      },
    });

    // Real-time push to any connected socket
    this.emitter?.(input.userId, 'notification', notification);

    // Mobile push notification (FCM) for offline users
    await this.pushService.sendToUser(input.userId, {
      title: input.title,
      body: input.body ?? '',
      data: input.data,
    });

    return notification;
  }

  async getForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
