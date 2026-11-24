import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profile: { select: { avatarUrl: true } },
} as const;

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }

    const addressee = await this.prisma.user.findUnique({ where: { id: addresseeId } });
    if (!addressee) throw new NotFoundException('User not found');

    // A request may already exist in either direction — check both before creating.
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new ConflictException('You are already friends with this user');
      }
      if (existing.status === 'PENDING') {
        throw new ConflictException('A friend request is already pending between you two');
      }
      // DECLINED or BLOCKED — allow a fresh request by resetting it, unless blocked.
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException('Unable to send a friend request to this user');
      }
    }

    const request = existing
      ? await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { requesterId, addresseeId, status: 'PENDING' },
        })
      : await this.prisma.friendship.create({
          data: { requesterId, addresseeId, status: 'PENDING' },
        });

    await this.notificationsService.create({
      userId: addresseeId,
      type: 'FOLLOW', // reuses the closest existing notification type; a dedicated FRIEND_REQUEST type can be added if this grows
      title: 'New friend request',
      data: { requesterId, friendshipId: request.id },
    });

    return request;
  }

  async respond(userId: string, friendshipId: string, accept: boolean) {
    const friendship = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) throw new NotFoundException('Friend request not found');
    if (friendship.addresseeId !== userId) {
      throw new ForbiddenException('Only the recipient can respond to this request');
    }
    if (friendship.status !== 'PENDING') {
      throw new BadRequestException('This request has already been responded to');
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED' },
    });

    if (accept) {
      await this.notificationsService.create({
        userId: friendship.requesterId,
        type: 'FOLLOW',
        title: 'Your friend request was accepted',
        data: { friendshipId },
      });
    }

    return updated;
  }

  async unfriend(userId: string, otherUserId: string) {
    return this.prisma.friendship.deleteMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: USER_SELECT },
        addressee: { select: USER_SELECT },
      },
    });

    return friendships.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: { requester: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSentRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: { addressee: { select: USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
