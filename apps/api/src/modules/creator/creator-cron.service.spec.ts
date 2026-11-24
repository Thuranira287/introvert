import { ConfigService } from '@nestjs/config';
import { CreatorCronService } from './creator-cron.service';
import { MonetizationService } from './monetization.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CreatorCronService', () => {
  let service: CreatorCronService;
  let prisma: { user: { findMany: jest.Mock } };
  let monetization: { expireLapsedPremium: jest.Mock; calculatePeriodEarnings: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    prisma = { user: { findMany: jest.fn() } };
    monetization = { expireLapsedPremium: jest.fn(), calculatePeriodEarnings: jest.fn() };
    config = { get: jest.fn().mockReturnValue(undefined) };

    service = new CreatorCronService(
      prisma as unknown as PrismaService,
      monetization as unknown as MonetizationService,
      config as unknown as ConfigService,
    );
  });

  describe('expireLapsedPremium', () => {
    it('walks every batch using a keyset on id and counts expirations', async () => {
      prisma.user.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([{ id: 'c' }])
        .mockResolvedValueOnce([]);
      monetization.expireLapsedPremium.mockResolvedValue(true);

      const expired = await service.expireLapsedPremium();

      expect(expired).toBe(3);
      expect(prisma.user.findMany).toHaveBeenCalledTimes(3);
      expect(prisma.user.findMany.mock.calls[1][0].where.id).toEqual({ gt: 'b' });
      expect(prisma.user.findMany.mock.calls[2][0].where.id).toEqual({ gt: 'c' });
    });

    it('only selects premium subscriptions whose period has lapsed', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.expireLapsedPremium();

      const where = prisma.user.findMany.mock.calls[0][0].where;
      expect(where.verificationType).toBe('PREMIUM');
      expect(where.premiumExpiresAt.lt).toBeInstanceOf(Date);
    });

    it('keeps going when one user fails and excludes the failure from the count', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]).mockResolvedValueOnce([]);
      monetization.expireLapsedPremium
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('db hiccup'))
        .mockResolvedValueOnce(true);

      const expired = await service.expireLapsedPremium();

      expect(expired).toBe(2);
      expect(monetization.expireLapsedPremium).toHaveBeenCalledTimes(3);
    });

    it('does nothing when scheduled jobs are disabled', async () => {
      config.get.mockReturnValue('true');

      expect(await service.expireLapsedPremium()).toBe(0);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('calculateMonthlyEarnings', () => {
    it('credits the previous calendar month and counts only non-skipped users', async () => {
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]).mockResolvedValueOnce([]);
      monetization.calculatePeriodEarnings
        .mockResolvedValueOnce({ skipped: false })
        .mockResolvedValueOnce({ skipped: true, reason: 'no activity' });

      const credited = await service.calculateMonthlyEarnings(new Date('2026-10-01T04:00:00Z'));

      expect(credited).toBe(1);
      const [, start, end] = monetization.calculatePeriodEarnings.mock.calls[0];
      expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(end.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    });

    it('only selects active, verified creators with profile ads enabled', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      await service.calculateMonthlyEarnings(new Date('2026-10-01T04:00:00Z'));

      expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
        isActive: true,
        isVerified: true,
        profile: { adsEnabled: true },
      });
    });

    it('does nothing when scheduled jobs are disabled', async () => {
      config.get.mockReturnValue('true');

      expect(await service.calculateMonthlyEarnings()).toBe(0);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
