import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';

const mockCreate = jest.fn();
const mockRetrieve = jest.fn();

jest.mock('stripe', () => {
  const StripeMock = jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: (...args: unknown[]) => mockCreate(...args),
      retrieve: (...args: unknown[]) => mockRetrieve(...args),
    },
  }));
  return { __esModule: true, default: StripeMock };
});

function buildService(secretKey?: string): PaymentsService {
  const config = { get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? secretKey : undefined) };
  return new PaymentsService(config as unknown as ConfigService);
}

describe('PaymentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when Stripe is not configured', () => {
    it('refuses to charge instead of simulating success', async () => {
      const service = buildService(undefined);

      await expect(service.chargeForPremiumVerification('u1', 'pm_123', 999)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(Stripe).not.toHaveBeenCalled();
    });

    it('refuses to verify a payment', async () => {
      const service = buildService(undefined);

      await expect(service.verifyPremiumPayment('u1', 'pi_123', 999)).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('chargeForPremiumVerification', () => {
    const service = buildService('sk_test_123');

    it('creates and confirms an on-session card PaymentIntent for the exact amount', async () => {
      mockCreate.mockResolvedValue({ id: 'pi_1', status: 'succeeded' });

      const result = await service.chargeForPremiumVerification('u1', 'pm_abc', 999);

      expect(result).toEqual({ success: true, paymentIntentId: 'pi_1' });
      const [params, options] = mockCreate.mock.calls[0];
      expect(params).toMatchObject({
        amount: 999,
        currency: 'usd',
        payment_method: 'pm_abc',
        allowed_payment_method_types: ['card'],
        confirm: true,
        metadata: { userId: 'u1', purpose: 'premium_verification' },
      });
      expect(params).not.toHaveProperty('off_session');
      expect(options.idempotencyKey).toContain('u1');
      expect(options.idempotencyKey).toContain('pm_abc');
    });

    it('returns the client secret when 3D Secure authentication is required', async () => {
      mockCreate.mockResolvedValue({ id: 'pi_2', status: 'requires_action', client_secret: 'pi_2_secret_x' });

      const result = await service.chargeForPremiumVerification('u1', 'pm_abc', 999);

      expect(result).toEqual({
        success: false,
        requiresAction: true,
        paymentIntentId: 'pi_2',
        clientSecret: 'pi_2_secret_x',
      });
    });

    it('reports a failure for any other non-succeeded status', async () => {
      mockCreate.mockResolvedValue({ id: 'pi_3', status: 'requires_payment_method' });

      const result = await service.chargeForPremiumVerification('u1', 'pm_abc', 999);

      expect(result.success).toBe(false);
      expect(result.failureReason).toBeDefined();
    });

    it('returns a decline as a failed result rather than throwing', async () => {
      mockCreate.mockRejectedValue(Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError' }));

      const result = await service.chargeForPremiumVerification('u1', 'pm_abc', 999);

      expect(result).toEqual({ success: false, failureReason: 'Your card was declined.' });
    });

    it('surfaces operational Stripe errors as 503, not as a declined card', async () => {
      mockCreate.mockRejectedValue(Object.assign(new Error('network down'), { type: 'StripeConnectionError' }));

      await expect(service.chargeForPremiumVerification('u1', 'pm_abc', 999)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('verifyPremiumPayment', () => {
    const service = buildService('sk_test_123');
    const goodIntent = {
      id: 'pi_ok',
      status: 'succeeded',
      amount: 999,
      currency: 'usd',
      metadata: { userId: 'u1', purpose: 'premium_verification' },
    };

    it('accepts a succeeded intent that belongs to the user for the expected amount', async () => {
      mockRetrieve.mockResolvedValue(goodIntent);

      await expect(service.verifyPremiumPayment('u1', 'pi_ok', 999)).resolves.toEqual({
        success: true,
        paymentIntentId: 'pi_ok',
      });
    });

    it("rejects another user's payment", async () => {
      mockRetrieve.mockResolvedValue({ ...goodIntent, metadata: { userId: 'someone-else', purpose: 'premium_verification' } });

      const result = await service.verifyPremiumPayment('u1', 'pi_ok', 999);

      expect(result.success).toBe(false);
    });

    it('rejects a payment made for a different purpose', async () => {
      mockRetrieve.mockResolvedValue({ ...goodIntent, metadata: { userId: 'u1', purpose: 'something_else' } });

      expect((await service.verifyPremiumPayment('u1', 'pi_ok', 999)).success).toBe(false);
    });

    it('rejects a payment for the wrong amount', async () => {
      mockRetrieve.mockResolvedValue({ ...goodIntent, amount: 100 });

      expect((await service.verifyPremiumPayment('u1', 'pi_ok', 999)).success).toBe(false);
    });

    it('rejects an intent that has not succeeded', async () => {
      mockRetrieve.mockResolvedValue({ ...goodIntent, status: 'requires_action' });

      expect((await service.verifyPremiumPayment('u1', 'pi_ok', 999)).success).toBe(false);
    });

    it('surfaces retrieval errors as 503', async () => {
      mockRetrieve.mockRejectedValue(new Error('boom'));

      await expect(service.verifyPremiumPayment('u1', 'pi_ok', 999)).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
