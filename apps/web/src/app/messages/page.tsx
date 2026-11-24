'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, Avatar, Input, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useMessagingSocket } from '@/hooks/useMessagingSocket';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface Conversation {
  user: { id: string; username: string; displayName: string };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const socket = useMessagingSocket(!!user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get('/messages/conversations');
      setConversations(response.data.data);
    } catch (err) {
      logger.error('Failed to load conversations', err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchConversations();

    // Support deep-linking from a profile's "Message" button: /messages?to=<userId>
    const to = searchParams.get('to');
    if (to) setSelectedUserId(to);
  }, [user, fetchConversations, searchParams]);

  useEffect(() => {
    if (!selectedUserId) return;
    api
      .get(`/messages/conversations/${selectedUserId}`)
      .then((res) => setMessages([...res.data.data].reverse()))
      .catch((err) => logger.error('Failed to load messages', err));
  }, [selectedUserId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        const belongsHere =
          selectedUserId && (message.senderId === selectedUserId || message.receiverId === selectedUserId);
        if (!belongsHere || prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      fetchConversations();
    };

    socket.on('newMessage', handleNewMessage);
    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket, selectedUserId, fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectConversation = (userId: string) => {
    setSelectedUserId(userId);
    setConversations((prev) => prev.map((c) => (c.user.id === userId ? { ...c, unreadCount: 0 } : c)));
    socket?.emit('markRead', { conversationUserId: userId });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedUserId || !socket) return;

    socket.emit('sendMessage', { receiverId: selectedUserId, content: input });
    setInput('');
  };

  const selectedConversation = conversations.find((c) => c.user.id === selectedUserId);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Messages</h1>

          <Card className="overflow-hidden border-2">
            <div className="grid md:grid-cols-3 h-[600px]">
              <div className="border-r border-gray-200 overflow-y-auto">
                {isLoadingConversations ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8 px-4">
                    No conversations yet. Visit someone&apos;s profile to say hello!
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <button
                      key={conv.user.id}
                      onClick={() => selectConversation(conv.user.id)}
                      className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                        selectedUserId === conv.user.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <Avatar size="md" initials={initialsOf(conv.user.displayName)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900 text-sm truncate">{conv.user.displayName}</p>
                          {conv.unreadCount > 0 && (
                            <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="md:col-span-2 flex flex-col">
                {selectedUserId ? (
                  <>
                    <div className="flex items-center gap-3 p-4 border-b border-gray-200">
                      <Avatar
                        size="md"
                        initials={initialsOf(selectedConversation?.user.displayName ?? 'Chat')}
                      />
                      <p className="font-bold text-gray-900">
                        {selectedConversation?.user.displayName ?? 'New conversation'}
                      </p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                      {messages.map((msg) => {
                        const isOwn = msg.senderId === user.id;
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-xs px-4 py-2 rounded-lg ${
                                isOwn
                                  ? 'bg-indigo-600 text-white rounded-br-none'
                                  : 'bg-gray-200 text-gray-900 rounded-bl-none'
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p className="text-xs mt-1 opacity-70">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    <form onSubmit={handleSend} className="p-4 border-t border-gray-200 flex gap-3">
                      <Input
                        placeholder="Type a message..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        fullWidth
                      />
                      <Button type="submit" disabled={!input.trim() || !socket}>
                        Send
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    Select a conversation to start chatting
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
