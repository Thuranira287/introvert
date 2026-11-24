import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

const ICON_MAP: Record<string, string> = {
  'edit-3': 'create-outline',
  'book-open': 'book-outline',
  'message-circle': 'chatbubble-outline',
  'trending-up': 'trending-up-outline',
  'heart-handshake': 'heart-outline',
  'thumbs-up': 'thumbs-up-outline',
  award: 'ribbon-outline',
  'calendar-check': 'calendar-outline',
  users: 'people-outline',
};

interface AchievementProgress {
  id: string;
  name: string;
  description: string;
  icon: string;
  criteriaThreshold: number;
  currentValue: number;
  isEarned: boolean;
}

export default function AchievementsScreen() {
  const { data: achievements, isLoading } = useQuery<AchievementProgress[]>({
    queryKey: ['achievements', 'progress'],
    queryFn: async () => (await api.get('/achievements/progress')).data.data,
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const earnedCount = achievements?.filter((a) => a.isEarned).length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerSubtitle}>
        {earnedCount} of {achievements?.length ?? 0} unlocked
      </Text>
      <FlatList
        data={achievements ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const iconName = ICON_MAP[item.icon] ?? 'ribbon-outline';
          const progressPct = Math.min(100, Math.round((item.currentValue / item.criteriaThreshold) * 100));

          return (
            <View style={[styles.card, !item.isEarned && styles.cardLocked]}>
              <View style={[styles.iconCircle, item.isEarned ? styles.iconCircleEarned : styles.iconCircleLocked]}>
                <Icon
                  name={item.isEarned ? iconName : 'lock-closed-outline'}
                  size={24}
                  color={item.isEarned ? '#4f46e5' : '#9ca3af'}
                />
              </View>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
              {!item.isEarned && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {item.currentValue} / {item.criteriaThreshold}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingVertical: 12 },
  listContent: { paddingHorizontal: 12, paddingBottom: 20 },
  row: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardLocked: { opacity: 0.7 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleEarned: { backgroundColor: '#eef2ff' },
  iconCircleLocked: { backgroundColor: '#f3f4f6' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center' },
  cardDescription: { fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  progressWrap: { width: '100%', marginTop: 10 },
  progressTrack: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 3 },
  progressFill: { height: 5, backgroundColor: '#6366f1', borderRadius: 3 },
  progressText: { fontSize: 10, color: '#9ca3af', textAlign: 'center', marginTop: 4 },
});
