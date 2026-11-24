import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface DiscoverUser {
  id: string;
  username: string;
  displayName: string;
  profile?: { bio?: string; interests?: string[] };
  isFollowing?: boolean;
}

export default function ExploreScreen({ navigation }: any) {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery<DiscoverUser[]>({
    queryKey: ['users', 'search', search],
    queryFn: async () => {
      const response = await api.get('/users/search', { params: { q: search } });
      return response.data.data;
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => api.post(`/users/${userId}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'search'] }),
  });

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.shortcutRow}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => navigation.navigate('Communities')}>
          <Icon name="people-outline" size={24} color="#4338ca" style={styles.shortcutEmoji} />
          <Text style={styles.shortcutLabel}>Communities</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => navigation.navigate('Events')}>
          <Icon name="calendar-outline" size={24} color="#4338ca" style={styles.shortcutEmoji} />
          <Text style={styles.shortcutLabel}>Events</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search people..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => navigation.navigate('UserDetail', { username: item.username })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(item.displayName)}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.displayName}</Text>
                <Text style={styles.userHandle}>@{item.username}</Text>
                {item.profile?.bio ? (
                  <Text style={styles.userBio} numberOfLines={1}>
                    {item.profile.bio}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.followButton, item.isFollowing && styles.followingButton]}
                onPress={() => followMutation.mutate(item.id)}
              >
                <Text style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                  {item.isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No people found. Try a different search.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  shortcutRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  shortcutCard: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shortcutEmoji: { fontSize: 24, marginBottom: 4 },
  shortcutLabel: { fontSize: 13, fontWeight: '600', color: '#4338ca' },
  searchBar: { paddingHorizontal: 16, paddingVertical: 12 },
  searchInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  userHandle: { fontSize: 13, color: '#6b7280' },
  userBio: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  followButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  followingButton: { backgroundColor: '#e0e7ff' },
  followButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  followingButtonText: { color: '#4338ca' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
});
