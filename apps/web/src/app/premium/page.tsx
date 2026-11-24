'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Card, CardBody, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { VerificationBadge } from '@/components/VerificationBadge';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { BadgeCheck, Sparkles, TrendingUp, DollarSign } from 'lucide-react';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PERKS = [
  { icon: BadgeCheck, text: 'A verified badge next to your name everywhere on the platform' },
  { icon: Sparkles, text: 'Stand out in Discover, comments, and community posts' },
  { icon: TrendingUp, text: 'Unlock your full analytics dashboard' },
  { icon: DollarSign, text: 'Eligible to run ads on your profile and earn a share of the value' },
];

type PurchaseResponse =
  | { status: 'active' }
  | { status: 'requires_action'; clientSecret: string; paymentIntentId: string };

function CheckoutForm({ priceCents }: { priceCents: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const card = elements?.getElement(CardElement);
    if (!stripe || !card) return;

    setIsPurchasing(true);
    try {
      // Card details go straight from Stripe's iframe to Stripe; only the
      // resulting PaymentMethod id ever reaches this app's server.
      const { error: methodError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card });
      if (methodError || !paymentMethod) {
        setError(methodError?.message ?? 'Your card could not be read. Please check the details and try again.');
        return;
      }

      const purchase = await api.post('/monetization/premium/purchase', { paymentMethodId: paymentMethod.id });
      let result: PurchaseResponse = purchase.data.data;

      if (result.status === 'requires_action') {
        const authentication = await stripe.handleNextAction({ clientSecret: result.clientSecret });
        if (authentication.error) {
          setError(authentication.error.message ?? 'Card authentication failed. Please try again.');
          return;
        }
        const finalized = await api.post('/monetization/premium/finalize', {
          paymentIntentId: result.paymentIntentId,
        });
        result = finalized.data.data;
      }

      if (result.status === 'active') {
        await refreshUser();
        router.push('/dashboard');
      }
    } catch (err) {
      logger.error('Premium purchase failed', err);
      setError(getErrorMessage(err, 'Something went wrong while processing your payment. Please try again.'));
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Card details</label>
        <div className="px-4 py-3 border border-gray-300 rounded-lg bg-white">
          <CardElement options={{ hidePostalCode: false, style: { base: { fontSize: '16px' } } }} />
        </div>
      </div>

      <Button type="submit" fullWidth size="lg" isLoading={isPurchasing} disabled={!stripe || isPurchasing}>
        Subscribe for ${(priceCents / 100).toFixed(2)}/month
      </Button>
    </form>
  );
}

export default function PremiumPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [priceCents, setPriceCents] = useState<number | null>(null);

  useEffect(() => {
    api
      .get('/monetization/premium-price')
      .then((res) => setPriceCents(res.data.data.priceCents))
      .catch((err) => logger.error('Failed to load premium price', err));
  }, []);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (user.verificationType) {
    return (
      <>
        <Header />
        <main className="bg-gray-50 min-h-screen py-16 px-4">
          <div className="max-w-md mx-auto text-center flex flex-col items-center">
            <VerificationBadge verificationType={user.verificationType} size={40} />
            <h1 className="text-2xl font-bold text-gray-900 mt-4">You&apos;re already verified</h1>
            <p className="text-gray-600 mt-2">
              {user.verificationType === 'ADMIN_GRANTED'
                ? 'Your account was verified by an admin.'
                : 'Your premium verification is active.'}
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Verified</h1>
            <p className="text-gray-600">Stand out with a verified badge and unlock creator tools.</p>
          </div>

          <Card className="mb-6">
            <CardBody>
              <ul className="space-y-3">
                {PERKS.map((perk) => (
                  <li key={perk.text} className="flex items-start gap-3">
                    <perk.icon size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{perk.text}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-8">
              {priceCents === null ? (
                <div className="flex justify-center">
                  <Spinner />
                </div>
              ) : stripePromise ? (
                <>
                  <div className="text-center mb-6">
                    <p className="text-3xl font-bold text-gray-900">
                      ${(priceCents / 100).toFixed(2)}
                      <span className="text-base font-normal text-gray-500">/month</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Billed monthly. Cancel anytime.</p>
                  </div>
                  <Elements stripe={stripePromise}>
                    <CheckoutForm priceCents={priceCents} />
                  </Elements>
                </>
              ) : (
                <p className="text-sm text-gray-600 text-center">
                  Premium subscriptions are not available yet. Please check back soon.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}
