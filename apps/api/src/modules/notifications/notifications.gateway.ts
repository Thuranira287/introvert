import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

interface AuthenticatedSocket extends Socket {
  data: { user?: { sub: string } };
}

/**
 * Real-time notification delivery, separate namespace from messaging so a
 * client can subscribe to one without the other. NotificationsService calls
 * back into this gateway (via registerEmitter) whenever it creates a
 * notification, so any part of the app — likes, follows, community posts,
 * event reminders — reaches connected clients instantly.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.notificationsService.registerEmitter((userId, event, payload) => {
      this.server.to(`user:${userId}`).emit(event, payload);
    });
  }

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
      client.join(`user:${payload.sub}`);

      const unreadCount = await this.notificationsService.getUnreadCount(payload.sub);
      client.emit('unreadCount', { count: unreadCount });
    } catch (err) {
      this.logger.warn(`Notification socket auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect() {
    // No per-user cleanup needed — room membership is dropped automatically.
  }
}
