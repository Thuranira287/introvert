import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

interface EventDetail {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  isOnline: boolean;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  organizer: { id: string; username: string; displayName: string };
  community?: { name: string } | null;
}

interface Attendee {
  status: 'GOING' | 'INTERESTED' | 'NOT_GOING';
  user: { id: string; username: string; displayName: string };
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export default function EventDetailScreen({ route }: any) {
  const { eventId } = route.params;
  const queryClient = useQueryClient();
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync('user').then((u) => {
      if (u) setMyUserId(JSON.parse(u).id);
    });
  }, []);

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', eventId],
    queryFn: async () => (await api.get(`/events/${eventId}`)).data.data,
  });

  const { data: attendees } = useQuery<Attendee[]>({
    queryKey: ['event', eventId, 'attendees'],
    queryFn: async () => (await api.get(`/events/${eventId}/attendees`)).data.data,
  });

  const rsvpMutation = useMutation({
    mutationFn: async (status: Attendee['status']) => api.post(`/events/${eventId}/rsvp`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId, 'attendees'] });
    },
  });

  if (isLoading || !event) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const myStatus = attendees?.find((a) => a.user.id === myUserId)?.status ?? null;
  const goingAttendees = (attendees ?? []).filter((a) => a.status === 'GOING');
  const startDate = new Date(event.startsAt);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{event.isOnline ? 'Online' : 'In-person'}</Text>
          </View>
          {event.status === 'CANCELLED' && (
            <View style={[styles.badge, styles.cancelledBadge]}>
              <Text style={[styles.badgeText, styles.cancelledBadgeText]}>Cancelled</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.dateText}>
          {startDate.toLocaleString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
        {event.location ? (
          <View style={styles.metaRow}>
            <Icon name="location-outline" size={14} color="#4b5563" />
            <Text style={styles.metaText}> {event.location}</Text>
          </View>
        ) : null}
        {event.meetingUrl && event.isOnline ? (
          <TouchableOpacity style={styles.metaRow} onPress={() => Linking.openURL(event.meetingUrl!)}>
            <Icon name="link-outline" size={14} color="#4f46e5" />
            <Text style={styles.linkText}> Join meeting link</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.organizerText}>
          Organized by {event.organizer.displayName}
          {event.community ? ` · in ${event.community.name}` : ''}
        </Text>

        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

        {event.status !== 'CANCELLED' && (
          <View style={styles.rsvpRow}>
            <TouchableOpacity
              style={[styles.rsvpButton, myStatus === 'GOING' && styles.rsvpButtonActive]}
              onPress={() => rsvpMutation.mutate('GOING')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, myStatus === 'GOING' && styles.rsvpButtonTextActive]}>Going</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rsvpButton, myStatus === 'INTERESTED' && styles.rsvpButtonActive]}
              onPress={() => rsvpMutation.mutate('INTERESTED')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={[styles.rsvpButtonText, myStatus === 'INTERESTED' && styles.rsvpButtonTextActive]}>
                Interested
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rsvpButton}
              onPress={() => rsvpMutation.mutate('NOT_GOING')}
              disabled={rsvpMutation.isPending}
            >
              <Text style={styles.rsvpButtonText}>Can&apos;t go</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.attendeesSection}>
          <Text style={styles.attendeesTitle}>
            {goingAttendees.length} going{event.capacity ? ` (capacity: ${event.capacity})` : ''}
          </Text>
          {goingAttendees.length === 0 ? (
            <Text style={styles.emptyText}>No one has RSVP&apos;d yet — be the first!</Text>
          ) : (
            <View style={styles.attendeeList}>
              {goingAttendees.map((a) => (
                <View key={a.user.id} style={styles.attendeeChip}>
                  <View style={styles.attendeeAvatar}>
                    <Text style={styles.attendeeAvatarText}>{initials(a.user.displayName)}</Text>
                  </View>
                  <Text style={styles.attendeeName}>{a.user.displayName}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: {
    backgroundColor: '#e0e7ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#4338ca' },
  cancelledBadge: { backgroundColor: '#fee2e2' },
  cancelledBadgeText: { color: '#b91c1c' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  dateText: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  metaText: { fontSize: 14, color: '#4b5563', marginBottom: 4 },
  linkText: { fontSize: 14, color: '#4f46e5', fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  organizerText: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  description: { fontSize: 14, color: '#374151', marginTop: 16, lineHeight: 20 },
  rsvpRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  rsvpButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rsvpButtonActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  rsvpButtonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  rsvpButtonTextActive: { color: '#fff' },
  attendeesSection: { marginTop: 28 },
  attendeesTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  emptyText: { fontSize: 13, color: '#9ca3af' },
  attendeeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attendeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingRight: 10,
    paddingVertical: 4,
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeAvatarText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  attendeeName: { fontSize: 12, color: '#374151' },
});
