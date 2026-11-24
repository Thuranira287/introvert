import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { MonetizationService } from './monetization.service';
import { getPreviousMonthRange } from './date-utils';

const BATCH_SIZE = 100;

/**
 * Scheduled creator-program jobs. Every job is safe to run on several
 * instances at once (expiry and earnings crediting are both idempotent);
 * set DISABLE_CRON=true on web-facing replicas to run them on a single
 * worker instead.
 */
@Injectable()
export class CreatorCronService {
  private readonly logger = new Logger(CreatorCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly monetizationService: MonetizationService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'expire-lapsed-premium', timeZone: 'UTC' })
  async expireLapsedPremium(): Promise<number> {
    if (this.isDisabled()) return 0;

    const now = new Date();
    const expired = await this.forEachBatch(
      (afterId) =>
        this.prisma.user.findMany({
          where: { verificationType: 'PREMIUM', premiumExpiresAt: { lt: now }, id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        }),
      (userId) => this.monetizationService.expireLapsedPremium(userId),
    );

    if (expired > 0) this.logger.log(`Expired ${expired} lapsed premium subscription(s)`);
    return expired;
  }

  @Cron('0 4 1 * *', { name: 'calculate-monthly-earnings', timeZone: 'UTC' })
  async calculateMonthlyEarnings(now: Date = new Date()): Promise<number> {
    if (this.isDisabled()) return 0;

    const { start, end } = getPreviousMonthRange(now);
    const credited = await this.forEachBatch(
      (afterId) =>
        this.prisma.user.findMany({
          where: { isActive: true, isVerified: true, profile: { adsEnabled: true }, id: { gt: afterId } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        }),
      async (userId) => {
        const result = await this.monetizationService.calculatePeriodEarnings(userId, start, end);
        return !result.skipped;
      },
    );

    this.logger.log(`Credited earnings to ${credited} creator(s) for ${start.toISOString().slice(0, 7)}`);
    return credited;
  }

  /**
   * Walks matching users in id order using a keyset (id > last) rather than
   * a Prisma cursor, so the walk stays correct even when processing a user
   * removes them from the filter. One user's failure is logged and skipped
   * without aborting the run. Returns how many handlers reported success.
   */
  private async forEachBatch(
    fetchBatch: (afterId: string) => Promise<Array<{ id: string }>>,
    handle: (userId: string) => Promise<boolean>,
  ): Promise<number> {
    let afterId = '';
    let succeeded = 0;

    for (;;) {
      const batch = await fetchBatch(afterId);
      if (batch.length === 0) break;

      for (const { id } of batch) {
        try {
          if (await handle(id)) succeeded++;
        } catch (error) {
          this.logger.error(`Scheduled job failed for user ${id}`, error as Error);
        }
      }

      afterId = batch[batch.length - 1].id;
    }

    return succeeded;
  }

  private isDisabled(): boolean {
    return this.config.get<string>('DISABLE_CRON') === 'true';
  }
}
