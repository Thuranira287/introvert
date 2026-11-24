import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface EarningsSummary {
  isEligible: boolean;
  adsEnabled: boolean;
  totalEarnedCents: number;
  recentTransactions: { id: string; amountCents: number; reason: string; createdAt: string }[];
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EarningsScreen() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery<EarningsSummary>({
    queryKey: ['monetization', 'earnings'],
    queryFn: async () => (await api.get('/monetization/earnings')).data.data,
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => api.post('/monetization/profile-ads', { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monetization', 'earnings'] }),
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'Failed to update ads setting'),
  });

  if (isLoading || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!summary.isEligible) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notEligible}>
          <Icon name="lock-closed-outline" size={32} color="#9ca3af" />
          <Text style={styles.notEligibleText}>
            Verified and Premium members can run ads on their profile and earn a share of the estimated ad value.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Ads on your profile</Text>
            <Text style={styles.toggleSubtitle}>
              {summary.adsEnabled ? 'Ads are currently shown on your profile.' : 'Turn on ads to start earning.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggleButton, summary.adsEnabled && styles.toggleButtonActive]}
            onPress={() => toggleMutation.mutate(!summary.adsEnabled)}
            disabled={toggleMutation.isPending}
          >
            <Text style={[styles.toggleButtonText, summary.adsEnabled && styles.toggleButtonTextActive]}>
              {summary.adsEnabled ? 'Turn off' : 'Turn on'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <Icon name="cash-outline" size={20} color="#16a34a" />
            <Text style={styles.balanceValue}>{formatCents(summary.totalEarnedCents)}</Text>
          </View>
          <Text style={styles.balanceLabel}>Total estimated earnings</Text>

          <View style={styles.infoBox}>
            <Icon name="information-circle-outline" size={14} color="#9ca3af" />
            <Text style={styles.infoText}>
              Earnings are an internal estimate based on your profile views, followers, and likes — not a live sync with
              ad network revenue. Amounts are added periodically.
            </Text>
          </View>

          {summary.recentTransactions.length > 0 ? (
            summary.recentTransactions.map((t) => (
              <View key={t.id} style={styles.transactionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.transactionReason}>{t.reason}</Text>
                  <Text style={styles.transactionDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.transactionAmount}>+{formatCents(t.amountCents)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No earnings yet — they&apos;re calculated periodically once ads are on.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  notEligible: { alignItems: 'center', padding: 40, gap: 12 },
  notEligibleText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  toggleButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  toggleButtonActive: { backgroundColor: '#f3f4f6' },
  toggleButtonText: { fontSize: 13, fontWeight: '600', color: '#4f46e5' },
  toggleButtonTextActive: { color: '#374151' },
  balanceCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  balanceValue: { fontSize: 26, fontWeight: '700', color: '#111827' },
  balanceLabel: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 12 },
  infoText: { fontSize: 11, color: '#9ca3af', flex: 1 },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    marginTop: 8,
  },
  transactionReason: { fontSize: 13, color: '#374151' },
  transactionDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  transactionAmount: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  emptyText: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
});
