import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VerificationBadge } from '../../components/VerificationBadge';
import api from '../../services/api';

export default function UserDetailScreen({ route, navigation }: any) {
  const { username } = route.params;
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['users', 'profile', username],
    queryFn: async () => {
      const response = await api.get(`/users/${username}`);
      return response.data.data;
    },
  });

  const followMutation = useMutation({
    mutationFn: async () =>
      user.isFollowing ? api.delete(`/users/${user.id}/follow`) : api.post(`/users/${user.id}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'profile', username] }),
  });

  const friendRequestMutation = useMutation({
    mutationFn: async () => api.post(`/friendships/${user.id}/request`),
  });

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const initials = user.displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user.displayName}</Text>
          <VerificationBadge verificationType={user.verificationType} size={16} />
        </View>
        <Text style={styles.username}>@{user.username}</Text>
        {user.profile?.bio ? <Text style={styles.bio}>{user.profile.bio}</Text> : null}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user._count?.followers ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user._count?.following ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user._count?.blogs ?? 0}</Text>
            <Text style={styles.statLabel}>Blogs</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.followButton, user.isFollowing && styles.followingButton]}
            onPress={() => followMutation.mutate()}
          >
            <Text style={[styles.followButtonText, user.isFollowing && styles.followingButtonText]}>
              {user.isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() =>
              navigation.navigate('MessagesTab', {
                screen: 'Chat',
                params: { userId: user.id, displayName: user.displayName },
              })
            }
          >
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.friendButton}
            onPress={() => friendRequestMutation.mutate()}
            disabled={friendRequestMutation.isPending || friendRequestMutation.isSuccess}
          >
            <Text style={styles.friendButtonText}>
              {friendRequestMutation.isSuccess ? 'Request Sent' : 'Add Friend'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { alignItems: 'center', padding: 24 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 28 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 20, fontWeight: '700', color: '#111827' },
  username: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  bio: { fontSize: 14, color: '#374151', textAlign: 'center', marginTop: 12, paddingHorizontal: 20 },
  statsRow: { flexDirection: 'row', marginTop: 20, gap: 32 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  followButton: { backgroundColor: '#4f46e5', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
  followingButton: { backgroundColor: '#e0e7ff' },
  followButtonText: { color: '#fff', fontWeight: '600' },
  followingButtonText: { color: '#4338ca' },
  messageButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  messageButtonText: { color: '#111827', fontWeight: '600' },
  friendButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  friendButtonText: { color: '#374151', fontWeight: '600' },
});
