import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface DashboardData {
  totals: {
    blogs: number;
    likesReceived: number;
    commentsReceived: number;
    followers: number;
  };
  last30Days: {
    profileViews: number;
    newFollowers: number;
    followerTrend: { date: string; count: number }[];
  };
  topContent: { id: string; title: string; views: number; _count: { likes: number } }[];
}

function StatTile({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statIconCircle}>
        <Icon name={icon} size={18} color="#4f46e5" />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function TrendBars({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) {
    return <Text style={styles.emptyTrend}>No activity in the last 30 days yet.</Text>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <View style={styles.trendRow}>
      {data.map((d) => (
        <View key={d.date} style={[styles.trendBar, { height: Math.max(4, (d.count / max) * 60) }]} />
      ))}
    </View>
  );
}

export default function MyProgressScreen() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => (await api.get('/analytics/dashboard')).data.data,
  });

  if (isLoading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          <StatTile icon="document-text-outline" label="Published blogs" value={data.totals.blogs} />
          <StatTile icon="heart-outline" label="Likes received" value={data.totals.likesReceived} />
          <StatTile icon="chatbubble-outline" label="Comments" value={data.totals.commentsReceived} />
          <StatTile icon="people-outline" label="Followers" value={data.totals.followers} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>New followers (30d)</Text>
            <View style={styles.cardBadge}>
              <Icon name="trending-up-outline" size={14} color="#4f46e5" />
              <Text style={styles.cardBadgeText}>{data.last30Days.newFollowers}</Text>
            </View>
          </View>
          <TrendBars data={data.last30Days.followerTrend} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Profile views (30d)</Text>
            <View style={styles.cardBadge}>
              <Icon name="eye-outline" size={14} color="#4f46e5" />
              <Text style={styles.cardBadgeText}>{data.last30Days.profileViews}</Text>
            </View>
          </View>
        </View>

        {data.topContent.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your top-performing posts</Text>
            {data.topContent.map((blog) => (
              <View key={blog.id} style={styles.topPostRow}>
                <Text style={styles.topPostTitle} numberOfLines={1}>
                  {blog.title}
                </Text>
                <View style={styles.topPostStats}>
                  <Icon name="eye-outline" size={12} color="#9ca3af" />
                  <Text style={styles.topPostStatText}>{blog.views}</Text>
                  <Icon name="heart-outline" size={12} color="#9ca3af" style={{ marginLeft: 8 }} />
                  <Text style={styles.topPostStatText}>{blog._count.likes}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280' },
  card: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardBadgeText: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 60 },
  trendBar: { flex: 1, backgroundColor: '#6366f1', borderRadius: 2, minWidth: 3 },
  emptyTrend: { fontSize: 12, color: '#9ca3af', textAlign: 'center', paddingVertical: 16 },
  topPostRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8, marginTop: 8 },
  topPostTitle: { fontSize: 13, color: '#1f2937' },
  topPostStats: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  topPostStatText: { fontSize: 11, color: '#9ca3af', marginLeft: 3 },
});
