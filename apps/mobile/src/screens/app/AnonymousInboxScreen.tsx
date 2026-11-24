import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

interface AnonymousMessage {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string | null;
  isAnonymous: boolean;
}

export default function AnonymousInboxScreen() {
  const queryClient = useQueryClient();
  const [replyTarget, setReplyTarget] = useState<AnonymousMessage | null>(null);
  const [replyText, setReplyText] = useState('');

  const {
    data: messages,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['anonymous-messages', 'inbox'],
    queryFn: async () => {
      const response = await api.get('/anonymous-messages/inbox');
      return response.data.data as AnonymousMessage[];
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/anonymous-messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['anonymous-messages', 'inbox'] }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => api.post(`/anonymous-messages/${replyTarget!.id}/reply`, { content: replyText }),
    onSuccess: () => {
      setReplyTarget(null);
      setReplyText('');
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
      <Text style={styles.headerTitle}>Anonymous Messages</Text>
      <Text style={styles.headerSubtitle}>These messages were sent without revealing the sender's identity.</Text>

      <FlatList
        data={messages ?? []}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, !item.isRead && styles.cardUnread]}
            onPress={() => !item.isRead && markReadMutation.mutate(item.id)}
          >
            <Text style={styles.cardContent}>{item.content}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              {item.isAnonymous && (
                <TouchableOpacity onPress={() => setReplyTarget(item)}>
                  <Text style={styles.replyLink}>Reply anonymously</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No anonymous messages yet.</Text>}
      />

      <Modal visible={!!replyTarget} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reply anonymously</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Write your reply..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => replyMutation.mutate()}
                style={styles.modalSendButton}
                disabled={!replyText.trim()}
              >
                <Text style={styles.modalSendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827', paddingHorizontal: 20, paddingTop: 12 },
  headerSubtitle: { fontSize: 13, color: '#6b7280', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardUnread: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  cardContent: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cardDate: { fontSize: 11, color: '#9ca3af' },
  replyLink: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalCancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: '#6b7280', fontWeight: '600' },
  modalSendButton: { backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  modalSendText: { color: '#fff', fontWeight: '600' },
});
