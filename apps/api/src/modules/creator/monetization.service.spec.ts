import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { MonetizationService, PREMIUM_MONTHLY_PRICE_CENTS } from './monetization.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('MonetizationService', () => {
  let service: MonetizationService;
  let prisma: {
    user: Record<string, jest.Mock>;
    profile: Record<string, jest.Mock>;
    profileView: Record<string, jest.Mock>;
    earningsTransaction: Record<string, jest.Mock>;
    premiumPayment: Record<string, jest.Mock>;
    follow: Record<string, jest.Mock>;
    like: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let payments: { chargeForPremiumVerification: jest.Mock; verifyPremiumPayment: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      profile: { update: jest.fn(), updateMany: jest.fn() },
      profileView: { create: jest.fn(), count: jest.fn() },
      earningsTransaction: { aggregate: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      premiumPayment: { create: jest.fn() },
      follow: { count: jest.fn() },
      like: { count: jest.fn() },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    payments = { chargeForPremiumVerification: jest.fn(), verifyPremiumPayment: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonetizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: payments },
      ],
    }).compile();

    service = module.get<MonetizationService>(MonetizationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('purchasePremiumVerification', () => {
    const unverifiedUser = { id: 'u1', isVerified: false, premiumExpiresAt: null, verifiedAt: null };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data }));
      prisma.premiumPayment.create.mockResolvedValue({});
    });

    it('throws NotFoundException for a non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.purchasePremiumVerification('u1', 'pm_1')).rejects.toThrow(NotFoundException);
    });

    it('rejects an already-verified account without charging', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...unverifiedUser, isVerified: true });

      await expect(service.purchasePremiumVerification('u1', 'pm_1')).rejects.toThrow(BadRequestException);
      expect(payments.chargeForPremiumVerification).not.toHaveBeenCalled();
    });

    it('propagates 503 when payments are unconfigured and never grants premium', async () => {
      payments.chargeForPremiumVerification.mockRejectedValue(new ServiceUnavailableException());

      await expect(service.purchasePremiumVerification('u1', 'pm_1')).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a declined card with the processor message and grants nothing', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({ success: false, failureReason: 'Your card was declined.' });

      await expect(service.purchasePremiumVerification('u1', 'pm_1')).rejects.toThrow('Your card was declined.');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns the client secret and grants nothing while 3D Secure is pending', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({
        success: false,
        requiresAction: true,
        clientSecret: 'pi_9_secret_x',
        paymentIntentId: 'pi_9',
      });

      const result = await service.purchasePremiumVerification('u1', 'pm_1');

      expect(result).toEqual({ status: 'requires_action', clientSecret: 'pi_9_secret_x', paymentIntentId: 'pi_9' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('charges exactly the displayed monthly price', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({ success: true, paymentIntentId: 'pi_1' });

      await service.purchasePremiumVerification('u1', 'pm_1');

      expect(payments.chargeForPremiumVerification).toHaveBeenCalledWith('u1', 'pm_1', PREMIUM_MONTHLY_PRICE_CENTS);
      expect(service.getPremiumMonthlyPriceCents()).toBe(PREMIUM_MONTHLY_PRICE_CENTS);
    });

    it('activates one month of premium and records the payment atomically', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({ success: true, paymentIntentId: 'pi_1' });

      const result = await service.purchasePremiumVerification('u1', 'pm_1');

      expect(result.status).toBe('active');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.premiumPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          stripePaymentIntentId: 'pi_1',
          amountCents: PREMIUM_MONTHLY_PRICE_CENTS,
        }),
      });

      const userUpdate = prisma.user.update.mock.calls[0][0];
      expect(userUpdate.data).toMatchObject({ isVerified: true, verificationType: 'PREMIUM' });
      const daysUntilExpiry = (userUpdate.data.premiumExpiresAt.getTime() - Date.now()) / DAY_MS;
      expect(daysUntilExpiry).toBeGreaterThan(27);
      expect(daysUntilExpiry).toBeLessThan(32);
    });

    it('never selects credential fields on the returned user', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({ success: true, paymentIntentId: 'pi_1' });

      await service.purchasePremiumVerification('u1', 'pm_1');

      const select = prisma.user.update.mock.calls[0][0].select;
      expect(select).toBeDefined();
      expect(select).not.toHaveProperty('passwordHash');
      expect(select).not.toHaveProperty('twoFactorSecret');
    });

    it('refuses to apply the same payment twice', async () => {
      payments.chargeForPremiumVerification.mockResolvedValue({ success: true, paymentIntentId: 'pi_1' });
      prisma.premiumPayment.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.purchasePremiumVerification('u1', 'pm_1')).rejects.toThrow(ConflictException);
    });
  });

  describe('renewPremiumVerification', () => {
    it('blocks renewal for admin-granted verification', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', verificationType: 'ADMIN_GRANTED' });

      await expect(service.renewPremiumVerification('u1', 'pm_1')).rejects.toThrow(BadRequestException);
      expect(payments.chargeForPremiumVerification).not.toHaveBeenCalled();
    });

    it('blocks renewal when there is no premium subscription', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', verificationType: null });

      await expect(service.renewPremiumVerification('u1', 'pm_1')).rejects.toThrow(BadRequestException);
    });

    it('extends from the current expiry so an early renewal forfeits no paid time', async () => {
      const currentExpiry = new Date(Date.now() + 10 * DAY_MS);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        verificationType: 'PREMIUM',
        premiumExpiresAt: currentExpiry,
        verifiedAt: new Date(),
      });
      payments.chargeForPremiumVerification.mockResolvedValue({ success: true, paymentIntentId: 'pi_2' });
      prisma.premiumPayment.create.mockResolvedValue({});
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data }));

      await service.renewPremiumVerification('u1', 'pm_1');

      const newExpiry: Date = prisma.user.update.mock.calls[0][0].data.premiumExpiresAt;
      const daysBeyondOldExpiry = (newExpiry.getTime() - currentExpiry.getTime()) / DAY_MS;
      expect(daysBeyondOldExpiry).toBeGreaterThan(27);
      expect(daysBeyondOldExpiry).toBeLessThan(32);
    });
  });

  describe('finalizePremiumVerification', () => {
    it('rejects a payment that cannot be verified and grants nothing', async () => {
      payments.verifyPremiumPayment.mockResolvedValue({ success: false, failureReason: 'not yours' });

      await expect(service.finalizePremiumVerification('u1', 'pi_1')).rejects.toThrow('not yours');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('verifies against the displayed price, then activates', async () => {
      payments.verifyPremiumPayment.mockResolvedValue({ success: true, paymentIntentId: 'pi_1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', premiumExpiresAt: null, verifiedAt: null });
      prisma.premiumPayment.create.mockResolvedValue({});
      prisma.user.update.mockImplementation(({ data }) => Promise.resolve({ id: 'u1', ...data }));

      const result = await service.finalizePremiumVerification('u1', 'pi_1');

      expect(payments.verifyPremiumPayment).toHaveBeenCalledWith('u1', 'pi_1', PREMIUM_MONTHLY_PRICE_CENTS);
      expect(result.status).toBe('active');
    });
  });

  describe('expireLapsedPremium', () => {
    it('ignores users who are not on a premium subscription', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', verificationType: 'ADMIN_GRANTED', premiumExpiresAt: null });

      expect(await service.expireLapsedPremium('u1')).toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('leaves a still-active subscription alone', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        verificationType: 'PREMIUM',
        premiumExpiresAt: new Date(Date.now() + DAY_MS),
      });

      expect(await service.expireLapsedPremium('u1')).toBe(false);
    });

    it('revokes a lapsed subscription and switches profile ads off together', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        verificationType: 'PREMIUM',
        premiumExpiresAt: new Date(Date.now() - DAY_MS),
      });
      prisma.user.update.mockResolvedValue({});
      prisma.profile.updateMany.mockResolvedValue({ count: 1 });

      expect(await service.expireLapsedPremium('u1')).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isVerified: false, verificationType: null, premiumExpiresAt: null },
      });
      expect(prisma.profile.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { adsEnabled: false } });
    });
  });

  describe('setProfileAdsEnabled', () => {
    it('blocks enabling ads for a non-verified user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: false });

      await expect(service.setProfileAdsEnabled('u1', true)).rejects.toThrow(ForbiddenException);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('allows a verified user to enable ads', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: true });
      prisma.profile.update.mockResolvedValue({});

      await service.setProfileAdsEnabled('u1', true);

      expect(prisma.profile.update).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { adsEnabled: true } });
    });

    it('always allows turning ads off', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: false });
      prisma.profile.update.mockResolvedValue({});

      await service.setProfileAdsEnabled('u1', false);

      expect(prisma.profile.update).toHaveBeenCalled();
    });
  });

  describe('recordProfileView', () => {
    it('does not count a self-view', async () => {
      await service.recordProfileView('u1', 'u1');

      expect(prisma.profileView.create).not.toHaveBeenCalled();
    });

    it('records a view from another user', async () => {
      prisma.profileView.create.mockResolvedValue({});

      await service.recordProfileView('u1', 'u2');

      expect(prisma.profileView.create).toHaveBeenCalledWith({ data: { profileUserId: 'u1', viewerId: 'u2' } });
    });
  });

  describe('getEarningsSummary', () => {
    it('reports eligibility, the ad setting, and the running total', async () => {
      prisma.earningsTransaction.aggregate.mockResolvedValue({ _sum: { amountCents: 250 } });
      prisma.earningsTransaction.findMany.mockResolvedValue([]);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isVerified: true, profile: { adsEnabled: true } });

      expect(await service.getEarningsSummary('u1')).toMatchObject({
        isEligible: true,
        adsEnabled: true,
        totalEarnedCents: 250,
      });
    });
  });

  describe('calculatePeriodEarnings', () => {
    const periodStart = new Date('2026-09-01T00:00:00Z');
    const periodEnd = new Date('2026-10-01T00:00:00Z');
    const eligibleUser = { id: 'u1', isActive: true, isVerified: true, profile: { adsEnabled: true } };

    it.each([
      ['not verified', { ...eligibleUser, isVerified: false }],
      ['ads disabled', { ...eligibleUser, profile: { adsEnabled: false } }],
      ['suspended', { ...eligibleUser, isActive: false }],
    ])('skips a user who is %s', async (_label, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.calculatePeriodEarnings('u1', periodStart, periodEnd);

      expect(result.skipped).toBe(true);
      expect(prisma.earningsTransaction.create).not.toHaveBeenCalled();
    });

    it('is idempotent: a period that was already credited is skipped without recounting', async () => {
      prisma.user.findUnique.mockResolvedValue(eligibleUser);
      prisma.earningsTransaction.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.calculatePeriodEarnings('u1', periodStart, periodEnd);

      expect(result.skipped).toBe(true);
      expect(prisma.profileView.count).not.toHaveBeenCalled();
      expect(prisma.earningsTransaction.create).not.toHaveBeenCalled();
    });

    it('counts only activity inside the period', async () => {
      prisma.user.findUnique.mockResolvedValue(eligibleUser);
      prisma.earningsTransaction.findFirst.mockResolvedValue(null);
      prisma.profileView.count.mockResolvedValue(0);
      prisma.follow.count.mockResolvedValue(0);
      prisma.like.count.mockResolvedValue(0);

      await service.calculatePeriodEarnings('u1', periodStart, periodEnd);

      const range = { gte: periodStart, lt: periodEnd };
      expect(prisma.profileView.count.mock.calls[0][0].where.createdAt).toEqual(range);
      expect(prisma.follow.count.mock.calls[0][0].where.createdAt).toEqual(range);
      expect(prisma.like.count.mock.calls[0][0].where.createdAt).toEqual(range);
    });

    it('credits views, new followers, and likes at the published rates', async () => {
      prisma.user.findUnique.mockResolvedValue(eligibleUser);
      prisma.earningsTransaction.findFirst.mockResolvedValue(null);
      prisma.profileView.count.mockResolvedValue(1000); // 50 cents
      prisma.follow.count.mockResolvedValue(50); // 10 cents
      prisma.like.count.mockResolvedValue(200); // 20 cents
      prisma.earningsTransaction.create.mockImplementation(({ data }) => Promise.resolve({ id: 't1', ...data }));

      const result = await service.calculatePeriodEarnings('u1', periodStart, periodEnd);

      expect(result.skipped).toBe(false);
      expect(prisma.earningsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u1', amountCents: 80, periodStart, periodEnd }),
      });
    });

    it('skips a period with no measurable activity', async () => {
      prisma.user.findUnique.mockResolvedValue(eligibleUser);
      prisma.earningsTransaction.findFirst.mockResolvedValue(null);
      prisma.profileView.count.mockResolvedValue(0);
      prisma.follow.count.mockResolvedValue(0);
      prisma.like.count.mockResolvedValue(0);

      const result = await service.calculatePeriodEarnings('u1', periodStart, periodEnd);

      expect(result.skipped).toBe(true);
      expect(prisma.earningsTransaction.create).not.toHaveBeenCalled();
    });
  });
});
