import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

/**
 * Validates the JWT passed by Socket.io clients (via `auth.token` in the
 * handshake, or an `Authorization: Bearer <token>` header) and attaches the
 * decoded payload to `client.data.user`. Used by MessagingGateway and
 * NotificationsGateway.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client = context.switchToWs().getClient<Socket>();
      const token = this.extractToken(client);

      if (!token) {
        throw new Error('No token provided');
      }

      const payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET') || 'dev-secret-change-me',
      });

      client.data.user = payload;
      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      return false;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake?.auth?.token as string | undefined;
    if (authToken) return authToken;

    const header = client.handshake?.headers?.authorization;
    if (header && header.startsWith('Bearer ')) {
      return header.substring(7);
    }

    return null;
  }
}
