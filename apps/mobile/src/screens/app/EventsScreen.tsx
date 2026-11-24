import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

interface EventSummary {
  id: string;
  title: string;
  startsAt: string;
  isOnline: boolean;
  location?: string;
  community?: { name: string } | null;
  _count: { attendees: number };
}

export default function EventsScreen({ navigation }: any) {
  const { data: events, isLoading } = useQuery<EventSummary[]>({
    queryKey: ['events'],
    queryFn: async () => (await api.get('/events')).data.data,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('NewEvent')}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const date = new Date(item.startsAt);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
              >
                <View style={styles.dateBox}>
                  <Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: 'short' })}</Text>
                  <Text style={styles.dateDay}>{date.getDate()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {date.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
                  </Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.isOnline ? 'Online' : item.location || 'In-person'}</Text>
                    </View>
                    <Text style={styles.attendeeCount}>{item._count.attendees} going</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No upcoming events yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  createButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dateBox: { width: 52, alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 8, paddingVertical: 8 },
  dateMonth: { fontSize: 11, fontWeight: '600', color: '#4f46e5' },
  dateDay: { fontSize: 18, fontWeight: '700', color: '#4338ca' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { backgroundColor: '#e0e7ff', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#4338ca' },
  attendeeCount: { fontSize: 11, color: '#9ca3af' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
});
