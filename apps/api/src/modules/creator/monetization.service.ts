import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { addOneMonth } from './date-utils';

/** Per-unit rates in cents, applied to activity within a single earnings period. */
const RATE_PER_PROFILE_VIEW_CENTS = 0.05;
const RATE_PER_NEW_FOLLOWER_CENTS = 0.2;
const RATE_PER_LIKE_RECEIVED_CENTS = 0.1;

export const PREMIUM_MONTHLY_PRICE_CENTS = 999;

const PREMIUM_USER_SELECT = {
  id: true,
  isVerified: true,
  verificationType: true,
  premiumExpiresAt: true,
} as const;

export type PremiumPaymentResult =
  | { status: 'active'; user: { id: string; isVerified: boolean; verificationType: string | null; premiumExpiresAt: Date | null } }
  | { status: 'requires_action'; clientSecret: string; paymentIntentId: string };

@Injectable()
export class MonetizationService {
  private readonly logger = new Logger(MonetizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  getPremiumMonthlyPriceCents(): number {
    return PREMIUM_MONTHLY_PRICE_CENTS;
  }

  async purchasePremiumVerification(userId: string, paymentMethodId: string): Promise<PremiumPaymentResult> {
    const user = await this.getUserOrThrow(userId);
    if (user.isVerified) {
      throw new BadRequestException('This account is already verified');
    }
    return this.chargeAndActivate(userId, paymentMethodId);
  }

  async renewPremiumVerification(userId: string, paymentMethodId: string): Promise<PremiumPaymentResult> {
    const user = await this.getUserOrThrow(userId);
    if (user.verificationType === 'ADMIN_GRANTED') {
      throw new BadRequestException('This account was verified by an admin and does not need a subscription');
    }
    if (user.verificationType !== 'PREMIUM') {
      throw new BadRequestException('There is no premium subscription to renew');
    }
    return this.chargeAndActivate(userId, paymentMethodId);
  }

  /** Completes a charge that needed client-side authentication (3D Secure). */
  async finalizePremiumVerification(userId: string, paymentIntentId: string): Promise<PremiumPaymentResult> {
    const result = await this.paymentsService.verifyPremiumPayment(userId, paymentIntentId, PREMIUM_MONTHLY_PRICE_CENTS);
    if (!result.success) {
      throw new BadRequestException(result.failureReason ?? 'The payment could not be verified');
    }
    return { status: 'active', user: await this.activatePremium(userId, paymentIntentId) };
  }

  /**
   * Revokes premium once its paid period has lapsed. Also switches profile
   * ads off, since ads are a verified-only feature. Admin-granted
   * verification has no expiry and is never touched.
   */
  async expireLapsedPremium(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.verificationType !== 'PREMIUM' || !user.premiumExpiresAt) return false;
    if (user.premiumExpiresAt > new Date()) return false;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { isVerified: false, verificationType: null, premiumExpiresAt: null },
      }),
      this.prisma.profile.updateMany({ where: { userId }, data: { adsEnabled: false } }),
    ]);

    this.logger.log(`Premium expired for user ${userId}`);
    return true;
  }

  async setProfileAdsEnabled(userId: string, enabled: boolean) {
    const user = await this.getUserOrThrow(userId);
    if (enabled && !user.isVerified) {
      throw new ForbiddenException('Only verified or premium accounts can run ads on their profile');
    }
    return this.prisma.profile.update({ where: { userId }, data: { adsEnabled: enabled } });
  }

  async recordProfileView(profileUserId: string, viewerId?: string) {
    if (profileUserId === viewerId) return;
    return this.prisma.profileView.create({ data: { profileUserId, viewerId } });
  }

  async getEarningsSummary(userId: string) {
    const [balance, transactions, user] = await Promise.all([
      this.prisma.earningsTransaction.aggregate({ where: { userId }, _sum: { amountCents: true } }),
      this.prisma.earningsTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    ]);

    return {
      isEligible: Boolean(user?.isVerified),
      adsEnabled: Boolean(user?.profile?.adsEnabled),
      totalEarnedCents: balance._sum.amountCents ?? 0,
      recentTransactions: transactions,
    };
  }

  /**
   * Credits one period's estimated earnings, based only on activity inside
   * [periodStart, periodEnd): profile views, new followers, and likes
   * received. Idempotent per user and period, so a re-run (restart,
   * overlapping instances) can never double-credit. This is an internal
   * estimate, not a sync with ad-network revenue.
   */
  async calculatePeriodEarnings(userId: string, periodStart: Date, periodEnd: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.isActive || !user.isVerified || !user.profile?.adsEnabled) {
      return { skipped: true, reason: 'User is not eligible for earnings' };
    }

    const existing = await this.prisma.earningsTransaction.findFirst({ where: { userId, periodStart, periodEnd } });
    if (existing) {
      return { skipped: true, reason: 'Earnings for this period were already credited' };
    }

    const inPeriod = { gte: periodStart, lt: periodEnd };
    const [views, newFollowers, likes] = await Promise.all([
      this.prisma.profileView.count({ where: { profileUserId: userId, createdAt: inPeriod } }),
      this.prisma.follow.count({ where: { followingId: userId, createdAt: inPeriod } }),
      this.prisma.like.count({ where: { blog: { authorId: userId }, createdAt: inPeriod } }),
    ]);

    const amountCents = Math.round(
      views * RATE_PER_PROFILE_VIEW_CENTS +
        newFollowers * RATE_PER_NEW_FOLLOWER_CENTS +
        likes * RATE_PER_LIKE_RECEIVED_CENTS,
    );

    if (amountCents <= 0) {
      return { skipped: true, reason: 'No measurable activity this period' };
    }

    const transaction = await this.prisma.earningsTransaction.create({
      data: {
        userId,
        amountCents,
        reason: `Estimated profile ad earnings: ${views} views, ${newFollowers} new followers, ${likes} likes`,
        periodStart,
        periodEnd,
      },
    });

    return { skipped: false, transaction };
  }

  private async chargeAndActivate(userId: string, paymentMethodId: string): Promise<PremiumPaymentResult> {
    const charge = await this.paymentsService.chargeForPremiumVerification(
      userId,
      paymentMethodId,
      PREMIUM_MONTHLY_PRICE_CENTS,
    );

    if (charge.requiresAction && charge.clientSecret && charge.paymentIntentId) {
      return { status: 'requires_action', clientSecret: charge.clientSecret, paymentIntentId: charge.paymentIntentId };
    }

    if (!charge.success || !charge.paymentIntentId) {
      throw new BadRequestException(charge.failureReason ?? 'Payment was declined. Please try a different payment method.');
    }

    return { status: 'active', user: await this.activatePremium(userId, charge.paymentIntentId) };
  }

  /**
   * Extends premium by one month from the later of now and the current
   * expiry, so early renewals never forfeit paid time. The payment record
   * and the user update commit together; the unique PaymentIntent id makes
   * applying the same payment twice impossible.
   */
  private async activatePremium(userId: string, paymentIntentId: string) {
    const user = await this.getUserOrThrow(userId);
    const now = new Date();
    const periodStart = user.premiumExpiresAt && user.premiumExpiresAt > now ? user.premiumExpiresAt : now;
    const periodEnd = addOneMonth(periodStart);

    try {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.premiumPayment.create({
          data: {
            userId,
            stripePaymentIntentId: paymentIntentId,
            amountCents: PREMIUM_MONTHLY_PRICE_CENTS,
            periodStart,
            periodEnd,
          },
        }),
        this.prisma.user.update({
          where: { id: userId },
          data: {
            isVerified: true,
            verificationType: 'PREMIUM',
            verifiedAt: user.verifiedAt ?? now,
            premiumExpiresAt: periodEnd,
          },
          select: PREMIUM_USER_SELECT,
        }),
      ]);
      this.logger.log(`Premium activated for user ${userId} through ${periodEnd.toISOString()}`);
      return updated;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('This payment has already been applied');
      }
      throw error;
    }
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
