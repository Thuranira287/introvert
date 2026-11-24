import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { VerificationBadge } from '../../components/VerificationBadge';
import api from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { logger } from '../../utils/logger';

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

const PERKS = [
  { icon: 'checkmark-circle-outline', text: 'A verified badge next to your name everywhere on the platform' },
  { icon: 'sparkles-outline', text: 'Stand out in Discover, comments, and community posts' },
  { icon: 'stats-chart-outline', text: 'Unlock your full analytics dashboard' },
  { icon: 'cash-outline', text: 'Eligible to run ads on your profile and earn a share of the value' },
];

type PurchaseResponse =
  { status: 'active' } | { status: 'requires_action'; clientSecret: string; paymentIntentId: string };

function CheckoutForm({ priceCents, onSuccess }: { priceCents: number; onSuccess: () => void }) {
  const { createPaymentMethod, handleNextAction } = useStripe();
  const [cardComplete, setCardComplete] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState('');

  const handlePurchase = async () => {
    setError('');
    setIsPurchasing(true);
    try {
      // CardField keeps card data inside Stripe's native view; only the
      // resulting PaymentMethod id is sent to our server.
      const { paymentMethod, error: methodError } = await createPaymentMethod({ paymentMethodType: 'Card' });
      if (methodError || !paymentMethod) {
        setError(methodError?.message ?? 'Your card could not be read. Please check the details and try again.');
        return;
      }

      const purchase = await api.post('/monetization/premium/purchase', { paymentMethodId: paymentMethod.id });
      let result: PurchaseResponse = purchase.data.data;

      if (result.status === 'requires_action') {
        const { error: actionError } = await handleNextAction(result.clientSecret);
        if (actionError) {
          setError(actionError.message ?? 'Card authentication failed. Please try again.');
          return;
        }
        const finalized = await api.post('/monetization/premium/finalize', {
          paymentIntentId: result.paymentIntentId,
        });
        result = finalized.data.data;
      }

      if (result.status === 'active') onSuccess();
    } catch (err) {
      logger.error('Premium purchase failed', err);
      setError(getErrorMessage(err, 'Something went wrong while processing your payment. Please try again.'));
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Card details</Text>
      <CardField
        postalCodeEnabled
        placeholders={{ number: '4242 4242 4242 4242' }}
        cardStyle={{
          backgroundColor: '#ffffff',
          textColor: '#111827',
          borderColor: '#d1d5db',
          borderWidth: 1,
          borderRadius: 10,
        }}
        style={styles.cardField}
        onCardChange={(details) => setCardComplete(details.complete)}
      />

      <TouchableOpacity
        style={[styles.submitButton, (!cardComplete || isPurchasing) && styles.submitButtonDisabled]}
        onPress={handlePurchase}
        disabled={!cardComplete || isPurchasing}
      >
        {isPurchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Subscribe for ${(priceCents / 100).toFixed(2)}/month</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function PremiumScreen({ navigation }: any) {
  const queryClient = useQueryClient();
  const [priceCents, setPriceCents] = useState<number | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => (await api.get('/users/me/profile')).data.data,
  });

  useEffect(() => {
    api
      .get('/monetization/premium-price')
      .then((res) => setPriceCents(res.data.data.priceCents))
      .catch((err) => logger.error('Failed to load premium price', err));
  }, []);

  const handleSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
    navigation.goBack();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (me?.verificationType) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.alreadyVerified}>
          <VerificationBadge verificationType={me.verificationType} size={40} />
          <Text style={styles.alreadyVerifiedTitle}>You&apos;re already verified</Text>
          <Text style={styles.alreadyVerifiedSubtitle}>
            {me.verificationType === 'ADMIN_GRANTED'
              ? 'Your account was verified by an admin.'
              : 'Your premium verification is active.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Get Verified</Text>
        <Text style={styles.subtitle}>Stand out with a verified badge and unlock creator tools.</Text>

        <View style={styles.perksCard}>
          {PERKS.map((perk) => (
            <View key={perk.text} style={styles.perkRow}>
              <Icon name={perk.icon} size={18} color="#4f46e5" />
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.purchaseCard}>
          {priceCents === null ? (
            <ActivityIndicator color="#6366f1" />
          ) : publishableKey ? (
            <StripeProvider publishableKey={publishableKey}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>
                  ${(priceCents / 100).toFixed(2)}
                  <Text style={styles.priceSuffix}>/month</Text>
                </Text>
                <Text style={styles.priceNote}>Billed monthly. Cancel anytime.</Text>
              </View>
              <CheckoutForm priceCents={priceCents} onSuccess={handleSuccess} />
            </StripeProvider>
          ) : (
            <Text style={styles.unavailable}>Premium subscriptions are not available yet. Please check back soon.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 6, marginBottom: 20 },
  perksCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 20, gap: 12 },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  perkText: { flex: 1, fontSize: 13, color: '#374151' },
  purchaseCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 20 },
  priceRow: { alignItems: 'center', marginBottom: 20 },
  price: { fontSize: 28, fontWeight: '700', color: '#111827' },
  priceSuffix: { fontSize: 14, fontWeight: '400', color: '#6b7280' },
  priceNote: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  unavailable: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#b91c1c', fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  cardField: { width: '100%', height: 50, marginBottom: 16 },
  submitButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  alreadyVerified: { alignItems: 'center', padding: 40, gap: 8 },
  alreadyVerifiedTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 8 },
  alreadyVerifiedSubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});
