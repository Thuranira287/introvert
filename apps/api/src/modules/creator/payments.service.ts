import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface ChargeResult {
  success: boolean;
  paymentIntentId?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  failureReason?: string;
}

const PREMIUM_PURPOSE = 'premium_verification';
const CURRENCY = 'usd';

/**
 * Stripe wrapper. Unlike the optional integrations elsewhere in this
 * codebase, an unconfigured instance never simulates success: granting a
 * paid badge without a real, verified charge would be worse than failing,
 * so every method throws a 503 until STRIPE_SECRET_KEY is set.
 *
 * Payment methods are tokenized client-side (Stripe.js / native SDK), so
 * raw card data never reaches this server. Charges that need Strong
 * Customer Authentication (3D Secure) return requiresAction plus a client
 * secret; the client completes authentication and the server then verifies
 * the PaymentIntent itself before fulfilling.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async chargeForPremiumVerification(
    userId: string,
    paymentMethodId: string,
    amountCents: number,
  ): Promise<ChargeResult> {
    const stripe = this.requireStripe();
    const billingMonth = new Date().toISOString().slice(0, 7);

    try {
      const intent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: CURRENCY,
          payment_method: paymentMethodId,
          allowed_payment_method_types: ['card'],
          confirm: true,
          description: 'Introvert Corner premium verification',
          metadata: { userId, purpose: PREMIUM_PURPOSE },
        },
        { idempotencyKey: `premium:${userId}:${paymentMethodId}:${billingMonth}` },
      );

      if (intent.status === 'succeeded') {
        return { success: true, paymentIntentId: intent.id };
      }

      if (intent.status === 'requires_action' && intent.client_secret) {
        return {
          success: false,
          requiresAction: true,
          paymentIntentId: intent.id,
          clientSecret: intent.client_secret,
        };
      }

      this.logger.warn(`Premium charge for user ${userId} ended in status ${intent.status}`);
      return { success: false, failureReason: 'The payment could not be completed. Please try another payment method.' };
    } catch (error) {
      if (this.isCardError(error)) {
        return { success: false, failureReason: (error as Error).message };
      }
      this.logger.error(`Stripe charge failed for user ${userId}`, error as Error);
      throw new ServiceUnavailableException('Payment processing is temporarily unavailable. Please try again shortly.');
    }
  }

  /**
   * Confirms with Stripe directly that a PaymentIntent succeeded, belongs
   * to this user, and was for exactly the expected amount. The client's
   * claim that it paid is never trusted.
   */
  async verifyPremiumPayment(userId: string, paymentIntentId: string, expectedAmountCents: number): Promise<ChargeResult> {
    const stripe = this.requireStripe();

    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

      const belongsToUser = intent.metadata?.userId === userId && intent.metadata?.purpose === PREMIUM_PURPOSE;
      if (!belongsToUser || intent.amount !== expectedAmountCents || intent.currency !== CURRENCY) {
        this.logger.warn(`Rejected payment verification for user ${userId}: intent ${paymentIntentId} mismatch`);
        return { success: false, failureReason: 'This payment does not match your subscription.' };
      }

      if (intent.status !== 'succeeded') {
        return { success: false, failureReason: 'The payment has not completed.' };
      }

      return { success: true, paymentIntentId: intent.id };
    } catch (error) {
      this.logger.error(`Stripe verification failed for intent ${paymentIntentId}`, error as Error);
      throw new ServiceUnavailableException('Payment verification is temporarily unavailable. Please try again shortly.');
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Payments are not configured on this server. Premium verification is unavailable until a payment provider is connected.',
      );
    }
    return this.stripe;
  }

  private isCardError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && (error as { type?: string }).type === 'StripeCardError';
  }
}
