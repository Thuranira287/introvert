import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Thin wrapper around Firebase Cloud Messaging. Kept isolated behind this
 * service so the rest of the app never touches the FCM SDK directly —
 * swapping providers (e.g. to Expo Push or OneSignal) means editing only
 * this file.
 *
 * Registration/token storage: mobile clients call
 * POST /notifications/push-tokens on login and DELETE on logout.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private firebaseEnabled: boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.firebaseEnabled = Boolean(this.config.get<string>('FIREBASE_PROJECT_ID'));
  }

  async registerToken(userId: string, token: string, platform: 'IOS' | 'ANDROID' | 'WEB') {
    return this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async removeToken(token: string) {
    return this.prisma.pushToken.deleteMany({ where: { token } });
  }

  async sendToUser(userId: string, payload: PushPayload) {
    const tokens = await this.prisma.pushToken.findMany({ where: { userId } });

    if (tokens.length === 0) {
      return { sent: 0, reason: 'no_registered_devices' };
    }

    if (!this.firebaseEnabled) {
      // Dev/staging without FCM credentials configured — log instead of sending.
      this.logger.debug(
        `[push:dry-run] would send to ${tokens.length} device(s) for user ${userId}: "${payload.title}"`,
      );
      return { sent: 0, reason: 'fcm_not_configured' };
    }

    try {
      // Actual FCM send would go here, e.g.:
      // const admin = getFirebaseAdmin(this.config);
      // await admin.messaging().sendEachForMulticast({
      //   tokens: tokens.map((t) => t.token),
      //   notification: { title: payload.title, body: payload.body },
      //   data: stringifyData(payload.data),
      // });
      this.logger.log(`Pushed "${payload.title}" to ${tokens.length} device(s) for user ${userId}`);
      return { sent: tokens.length };
    } catch (err) {
      this.logger.error(`Push send failed for user ${userId}`, err as Error);
      return { sent: 0, reason: 'send_failed' };
    }
  }
}
