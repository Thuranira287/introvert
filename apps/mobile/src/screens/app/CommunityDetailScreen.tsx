import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

interface CommunityDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  owner: { id: string; username: string; displayName: string };
  _count: { members: number; posts: number };
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string; displayName: string };
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export default function CommunityDetailScreen({ route, navigation }: any) {
  const { slug } = route.params;
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);

  React.useEffect(() => {
    SecureStore.getItemAsync('user').then((u) => {
      if (u) setMyUserId(JSON.parse(u).id);
    });
  }, []);

  const { data: community, isLoading } = useQuery<CommunityDetail>({
    queryKey: ['community', slug],
    queryFn: async () => (await api.get(`/communities/${slug}`)).data.data,
  });

  const { data: members } = useQuery({
    queryKey: ['community', slug, 'members'],
    queryFn: async () => (await api.get(`/communities/${community!.id}/members`)).data.data,
    enabled: !!community,
  });

  const { data: posts } = useQuery<Post[]>({
    queryKey: ['community', slug, 'posts'],
    queryFn: async () => (await api.get(`/communities/${community!.id}/posts`)).data.data,
    enabled: !!community,
  });

  const isMember = members?.some((m: any) => m.user.id === myUserId) ?? false;
  const isOwner = community?.owner.id === myUserId;

  const joinMutation = useMutation({
    mutationFn: async () => api.post(`/communities/${community!.id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      queryClient.invalidateQueries({ queryKey: ['community', slug, 'members'] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => api.post(`/communities/${community!.id}/leave`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community', slug] });
      queryClient.invalidateQueries({ queryKey: ['community', slug, 'members'] });
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => api.post(`/communities/${community!.id}/posts`, { content: postText }),
    onSuccess: () => {
      setPostText('');
      queryClient.invalidateQueries({ queryKey: ['community', slug, 'posts'] });
    },
  });

  if (isLoading || !community) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={posts ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <Text style={styles.communityName}>{community.name}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{community.visibility}</Text>
                </View>
              </View>
              {community.description ? <Text style={styles.communityDescription}>{community.description}</Text> : null}
              <View style={styles.statsRow}>
                <Text style={styles.statText}>{community._count.members} members</Text>
                <Text style={styles.statText}>{community._count.posts} posts</Text>
              </View>

              {!isOwner && (
                <TouchableOpacity
                  style={[styles.joinButton, isMember && styles.leaveButton]}
                  onPress={() => (isMember ? leaveMutation.mutate() : joinMutation.mutate())}
                  disabled={joinMutation.isPending || leaveMutation.isPending}
                >
                  <Text style={[styles.joinButtonText, isMember && styles.leaveButtonText]}>
                    {isMember ? 'Leave Community' : 'Join Community'}
                  </Text>
                </TouchableOpacity>
              )}

              {(isMember || isOwner) && (
                <TouchableOpacity
                  style={styles.planEventButton}
                  onPress={() => navigation.navigate('NewEvent', { communityId: community.id })}
                >
                  <Text style={styles.planEventButtonText}>+ Plan an event for this community</Text>
                </TouchableOpacity>
              )}
            </View>

            {(isMember || isOwner) && (
              <View style={styles.composer}>
                <TextInput
                  style={styles.composerInput}
                  placeholder="Share something with the community..."
                  placeholderTextColor="#9ca3af"
                  value={postText}
                  onChangeText={setPostText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.postButton, !postText.trim() && styles.postButtonDisabled]}
                  onPress={() => postMutation.mutate()}
                  disabled={!postText.trim() || postMutation.isPending}
                >
                  <Text style={styles.postButtonText}>Post</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.postCard}>
            <View style={styles.postAvatar}>
              <Text style={styles.postAvatarText}>{initials(item.author.displayName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.postAuthor}>{item.author.displayName}</Text>
              <Text style={styles.postContent}>{item.content}</Text>
              <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No posts yet. Be the first!</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  listContent: { padding: 16 },
  headerCard: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  communityName: { fontSize: 20, fontWeight: '700', color: '#111827', flex: 1 },
  badge: { backgroundColor: '#e0e7ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#4338ca' },
  communityDescription: { fontSize: 14, color: '#4b5563', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 12 },
  statText: { fontSize: 12, color: '#6b7280' },
  joinButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  leaveButton: { backgroundColor: '#f3f4f6' },
  joinButtonText: { color: '#fff', fontWeight: '600' },
  leaveButtonText: { color: '#374151' },
  planEventButton: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  planEventButtonText: { color: '#4f46e5', fontSize: 13, fontWeight: '600' },
  composer: { marginBottom: 16, gap: 8 },
  composerInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  postButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  postCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  postAuthor: { fontSize: 13, fontWeight: '700', color: '#111827' },
  postContent: { fontSize: 13, color: '#374151', marginTop: 2 },
  postDate: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 20, fontSize: 14 },
});
