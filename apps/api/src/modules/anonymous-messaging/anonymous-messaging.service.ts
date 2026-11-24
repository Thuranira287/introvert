import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AnonymousMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Sends an anonymous message. The sender's identity is ALWAYS stored
   * server-side (senderId) so moderation/reporting can trace abuse — it is
   * simply withheld from the API response shown to the receiver unless
   * revealIdentity is set. True anonymity from other users, not from the
   * platform, is the intended guarantee.
   */
  async send(senderId: string, receiverId: string, content: string, revealIdentity = false) {
    if (senderId === receiverId) {
      throw new ForbiddenException('Cannot send an anonymous message to yourself');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
      include: { profile: true },
    });

    if (!receiver) {
      throw new NotFoundException('Recipient not found');
    }

    if (receiver.profile && receiver.profile.allowAnonymousMessages === false) {
      throw new ForbiddenException('This user is not accepting anonymous messages');
    }

    const isBlocked = await this.prisma.block.findFirst({
      where: { blockerId: receiverId, blockedId: senderId },
    });
    if (isBlocked) {
      throw new ForbiddenException('Unable to send message to this user');
    }

    const message = await this.prisma.anonymousMessage.create({
      data: { senderId, receiverId, content },
    });

    await this.notificationsService.create({
      userId: receiverId,
      type: 'ANONYMOUS_MESSAGE',
      title: 'You received an anonymous message',
      body: content.slice(0, 100),
      data: { messageId: message.id, revealIdentity },
    });

    // Return the receiver-safe view (no senderId) unless the sender chose to reveal.
    return this.toReceiverView(message, revealIdentity ? senderId : null);
  }

  async getInbox(userId: string) {
    const messages = await this.prisma.anonymousMessage.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: 'desc' },
    });

    // senderId is stripped from the response by default to preserve anonymity for the receiver.
    return messages.map((m) => this.toReceiverView(m, null));
  }

  async markRead(userId: string, messageId: string) {
    return this.prisma.anonymousMessage.updateMany({
      where: { id: messageId, receiverId: userId },
      data: { isRead: true },
    });
  }

  /** Reply to an anonymous message. The reply is itself sent anonymously back to the original sender. */
  async reply(userId: string, originalMessageId: string, content: string) {
    const original = await this.prisma.anonymousMessage.findUnique({ where: { id: originalMessageId } });

    if (!original || original.receiverId !== userId) {
      throw new NotFoundException('Original message not found');
    }
    if (!original.senderId) {
      throw new ForbiddenException('Original sender is unavailable');
    }

    const reply = await this.prisma.anonymousMessage.create({
      data: {
        senderId: userId,
        receiverId: original.senderId,
        content,
        replyToId: original.id,
      },
    });

    await this.notificationsService.create({
      userId: original.senderId,
      type: 'ANONYMOUS_MESSAGE',
      title: 'You received a reply to your anonymous message',
      body: content.slice(0, 100),
      data: { messageId: reply.id },
    });

    return this.toReceiverView(reply, null);
  }

  private toReceiverView(message: { id: string; content: string; isRead: boolean; createdAt: Date; replyToId: string | null }, revealedSenderId: string | null) {
    return {
      id: message.id,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
      replyToId: message.replyToId,
      senderId: revealedSenderId,
      isAnonymous: revealedSenderId === null,
    };
  }
}
