import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

export interface VerificationBadgeProps {
  verificationType?: 'ADMIN_GRANTED' | 'PREMIUM' | null;
  size?: number;
  showLabel?: boolean;
}

/**
 * Small checkmark shown next to a verified user's name. Mirrors the web
 * VerificationBadge component — both verification paths render the same
 * visual mark to other users; the distinction only matters in admin
 * tooling and the user's own settings.
 */
export function VerificationBadge({ verificationType, size = 16, showLabel = false }: VerificationBadgeProps) {
  if (!verificationType) return null;

  const label = verificationType === 'ADMIN_GRANTED' ? 'Verified' : 'Verified (Premium)';

  return (
    <View style={styles.row}>
      <Icon name="checkmark-circle" size={size} color="#4f46e5" />
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
});
