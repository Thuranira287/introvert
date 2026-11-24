import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface BlogSummary {
  id: string;
  title: string;
  excerpt?: string;
  slug: string;
  readingTime: number;
  createdAt: string;
  author: { displayName: string; username: string };
  _count?: { likes: number; comments: number };
}

export default function BlogsScreen({ navigation }: any) {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['blogs', 'list'],
    queryFn: async () => {
      const response = await api.get('/blogs');
      return response.data.data.data as BlogSummary[];
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Blogs</Text>
        <TouchableOpacity style={styles.writeButton} onPress={() => navigation.navigate('NewBlog')}>
          <Text style={styles.writeButtonText}>+ Write</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isRefetching}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BlogDetail', { slug: item.slug })}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.excerpt ? (
              <Text style={styles.cardExcerpt} numberOfLines={2}>
                {item.excerpt}
              </Text>
            ) : null}
            <View style={styles.cardMeta}>
              <Text style={styles.cardAuthor}>{item.author.displayName}</Text>
              <Text style={styles.cardDot}>·</Text>
              <Text style={styles.cardReadTime}>{item.readingTime} min read</Text>
              {item._count ? (
                <>
                  <Text style={styles.cardDot}>·</Text>
                  <View style={styles.likesRow}>
                    <Icon name="heart" size={12} color="#9ca3af" />
                    <Text style={styles.cardLikes}> {item._count.likes}</Text>
                  </View>
                </>
              ) : null}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No blogs yet. Be the first to write one!</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  writeButton: { backgroundColor: '#4f46e5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  writeButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  cardExcerpt: { fontSize: 14, color: '#6b7280', marginBottom: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cardAuthor: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  cardDot: { fontSize: 12, color: '#d1d5db', marginHorizontal: 6 },
  cardReadTime: { fontSize: 12, color: '#9ca3af' },
  cardLikes: { fontSize: 12, color: '#9ca3af' },
  likesRow: { flexDirection: 'row', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
});
