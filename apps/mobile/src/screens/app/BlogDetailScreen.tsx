import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface CommentNode {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string; username: string };
  replies: CommentNode[];
}

function CommentItem({ comment, depth = 0 }: { comment: CommentNode; depth?: number }) {
  return (
    <View style={{ marginLeft: depth * 16, marginBottom: 12 }}>
      <View style={styles.commentBubble}>
        <Text style={styles.commentAuthor}>{comment.author.displayName}</Text>
        <Text style={styles.commentContent}>{comment.content}</Text>
        <Text style={styles.commentDate}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
      </View>
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </View>
  );
}

export default function BlogDetailScreen({ route }: any) {
  const { slug, blogId } = route.params;
  const queryClient = useQueryClient();

  const { data: blog, isLoading } = useQuery({
    queryKey: ['blogs', 'detail', slug ?? blogId],
    queryFn: async () => {
      const response = await api.get(slug ? `/blogs/${slug}` : `/blogs/id/${blogId}`);
      return response.data.data;
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => api.post(`/blogs/${blog.id}/like`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blogs', 'detail', slug] }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => api.post(`/blogs/${blog.id}/bookmark`),
  });

  const [commentText, setCommentText] = useState('');

  const { data: comments } = useQuery({
    queryKey: ['comments', blog?.id],
    queryFn: async () => {
      const response = await api.get(`/blogs/${blog.id}/comments`);
      return response.data.data as CommentNode[];
    },
    enabled: !!blog?.id,
  });

  const commentMutation = useMutation({
    mutationFn: async () => api.post(`/blogs/${blog.id}/comments`, { content: commentText }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', blog.id] });
    },
  });

  if (isLoading || !blog) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{blog.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {blog.author.displayName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.authorName}>{blog.author.displayName}</Text>
            <Text style={styles.metaSub}>
              {blog.readingTime} min read · {new Date(blog.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={styles.body}>{blog.content}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => likeMutation.mutate()}>
            <Icon name="heart-outline" size={16} color="#374151" />
            <Text style={styles.actionText}> {blog._count?.likes ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => bookmarkMutation.mutate()}>
            <Icon name="bookmark-outline" size={16} color="#374151" />
            <Text style={styles.actionText}> Save</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsHeader}>Comments ({comments?.length ?? 0})</Text>

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a thoughtful comment..."
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.commentPostButton, !commentText.trim() && styles.commentPostButtonDisabled]}
              onPress={() => commentMutation.mutate()}
              disabled={!commentText.trim()}
            >
              <Text style={styles.commentPostButtonText}>Post</Text>
            </TouchableOpacity>
          </View>

          {comments?.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarSmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  authorName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  metaSub: { fontSize: 12, color: '#6b7280' },
  body: { fontSize: 15, lineHeight: 24, color: '#374151', marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 16 },
  actionButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  commentsSection: { marginTop: 28, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 20 },
  commentsHeader: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 20 },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
  },
  commentPostButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  commentPostButtonDisabled: { opacity: 0.5 },
  commentPostButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  commentBubble: { backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 4 },
  commentContent: { fontSize: 13, color: '#374151', lineHeight: 18 },
  commentDate: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
});
