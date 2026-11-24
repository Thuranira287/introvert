import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io, Socket } from 'socket.io-client';

import api from '../../services/api';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export default function ChatScreen({ route }: any) {
  const { userId: otherUserId, displayName } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const { data: history } = useQuery({
    queryKey: ['messages', otherUserId],
    queryFn: async () => {
      const response = await api.get(`/messages/conversations/${otherUserId}`);
      return response.data.data as Message[];
    },
  });

  useEffect(() => {
    if (history) {
      // API returns newest-first; reverse for a chronological chat view.
      setMessages([...history].reverse());
    }
  }, [history]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await SecureStore.getItemAsync('userToken');
      const userStr = await SecureStore.getItemAsync('user');
      if (!token || !mounted) return;

      if (userStr) setMyUserId(JSON.parse(userStr).id);

      const socket = io(`${SOCKET_URL}/messaging`, {
        auth: { token },
        transports: ['websocket'],
      });

      socket.on('newMessage', (message: Message) => {
        setMessages((prev) => {
          // Only append messages belonging to this conversation thread
          const belongsHere = message.senderId === otherUserId || message.receiverId === otherUserId;
          if (!belongsHere) return prev;
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      });

      socketRef.current = socket;
    })();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
    };
  }, [otherUserId, queryClient]);

  const handleSend = useCallback(() => {
    if (!input.trim() || !socketRef.current) return;

    socketRef.current.emit('sendMessage', { receiverId: otherUserId, content: input }, () => {
      // ack received — server already broadcast 'newMessage' to both parties
    });

    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, otherUserId]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isOwn = item.senderId === myUserId;
            return (
              <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther}>{item.content}</Text>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={`Message ${displayName ?? ''}`}
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  listContent: { padding: 16 },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 12, marginBottom: 10 },
  bubbleOwn: { backgroundColor: '#4f46e5', alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  bubbleOther: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  bubbleTextOwn: { color: '#fff', fontSize: 14 },
  bubbleTextOther: { color: '#1f2937', fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendButton: { backgroundColor: '#4f46e5', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
