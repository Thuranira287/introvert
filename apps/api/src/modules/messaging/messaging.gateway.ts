import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { NotificationsService } from '../notifications/notifications.service';

interface AuthenticatedSocket extends Socket {
  data: { user?: { sub: string; username: string; displayName: string } };
}

/**
 * Real-time messaging gateway. Namespaced under /messaging so it doesn't
 * collide with the /notifications gateway on the same Socket.io server.
 *
 * Client contract:
 *  - connect with `auth: { token: '<JWT>' }`
 *  - emit 'sendMessage' { receiverId, content } -> ack + 'newMessage' to both parties
 *  - emit 'typing' { receiverId } -> broadcasts 'userTyping' to the receiver if online
 *  - emit 'markRead' { conversationUserId } -> marks messages read, broadcasts 'messagesRead'
 *  - listen for 'newMessage', 'userTyping', 'userOnline', 'userOffline', 'messagesRead'
 */
@WebSocketGateway({
  namespace: '/messaging',
  cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);
  // userId -> set of socket ids (a user may have multiple tabs/devices)
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      });

      client.data.user = payload;
      const userId = payload.sub;

      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
      }
      this.onlineUsers.get(userId)!.add(client.id);

      client.join(`user:${userId}`);
      this.server.emit('userOnline', { userId });

      this.logger.log(`User ${userId} connected (${client.id})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.data.user?.sub;
    if (!userId) return;

    const sockets = this.onlineUsers.get(userId);
    sockets?.delete(client.id);

    if (sockets && sockets.size === 0) {
      this.onlineUsers.delete(userId);
      this.server.emit('userOffline', { userId });
    }

    this.logger.log(`User ${userId} disconnected (${client.id})`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { receiverId: string; content: string },
  ) {
    const senderId = client.data.user!.sub;

    const message = await this.messagingService.sendMessage(senderId, body.receiverId, body.content);

    // Deliver to both parties (works across multiple tabs/devices per user)
    this.server.to(`user:${body.receiverId}`).emit('newMessage', message);
    this.server.to(`user:${senderId}`).emit('newMessage', message);

    // Notify the recipient if they're not actively connected
    if (!this.onlineUsers.has(body.receiverId)) {
      await this.notificationsService.create({
        userId: body.receiverId,
        type: 'MESSAGE',
        title: `New message from ${client.data.user!.displayName}`,
        body: body.content.slice(0, 100),
        data: { senderId },
      });
    }

    return { status: 'ok', messageId: message.id };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { receiverId: string },
  ) {
    this.server.to(`user:${body.receiverId}`).emit('userTyping', {
      userId: client.data.user!.sub,
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { conversationUserId: string },
  ) {
    const userId = client.data.user!.sub;
    await this.messagingService.markConversationRead(userId, body.conversationUserId);

    this.server.to(`user:${body.conversationUserId}`).emit('messagesRead', { readBy: userId });

    return { status: 'ok' };
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
