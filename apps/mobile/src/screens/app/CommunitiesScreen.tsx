import { useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  _count: { members: number; posts: number };
}

export default function CommunitiesScreen({ navigation }: any) {
  const [search, setSearch] = useState('');

  const { data: communities, isLoading } = useQuery<Community[]>({
    queryKey: ['communities', search],
    queryFn: async () => {
      const response = await api.get('/communities', { params: { search: search || undefined } });
      return response.data.data;
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('NewCommunity')}>
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={communities ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('CommunityDetail', { slug: item.slug })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.visibility}</Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>{item._count.members} members</Text>
                <Text style={styles.cardMeta}>{item._count.posts} posts</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{search ? 'No communities found.' : 'No communities yet — start one!'}</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  createButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  createButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', flex: 1 },
  badge: { backgroundColor: '#e0e7ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#4338ca' },
  cardDescription: { fontSize: 13, color: '#6b7280', marginTop: 6 },
  cardFooter: { flexDirection: 'row', gap: 16, marginTop: 10 },
  cardMeta: { fontSize: 12, color: '#9ca3af' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
});
