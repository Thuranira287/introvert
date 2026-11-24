import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

interface MyCommunity {
  id: string;
  name: string;
}

export default function NewEventScreen({ navigation, route }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [startsAt, setStartsAt] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [communityId, setCommunityId] = useState<string | null>(route.params?.communityId ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: myCommunities } = useQuery<MyCommunity[]>({
    queryKey: ['communities', 'me'],
    queryFn: async () => (await api.get('/communities/me')).data.data,
  });

  useEffect(() => {
    if (route.params?.communityId) setCommunityId(route.params.communityId);
  }, [route.params?.communityId]);

  const handleSubmit = async () => {
    setError('');
    if (!title.trim()) {
      setError('Please give your event a title.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/events', {
        title,
        description: description || undefined,
        isOnline,
        location: location || undefined,
        meetingUrl: meetingUrl || undefined,
        startsAt: startsAt.toISOString(),
        capacity: capacity ? Number(capacity) : undefined,
        communityId: communityId || undefined,
      });
      navigation.replace('EventDetail', { eventId: response.data.data.id });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Event Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Quiet Coffee Meetup"
          value={title}
          onChangeText={setTitle}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What should attendees know?"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Starts At</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateButtonText}>
            {startsAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={startsAt}
            mode="datetime"
            minimumDate={new Date()}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_event, date) => {
              setShowPicker(Platform.OS === 'ios');
              if (date) setStartsAt(date);
            }}
          />
        )}

        <Text style={styles.label}>Format</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatCard, isOnline && styles.formatCardActive]}
            onPress={() => setIsOnline(true)}
          >
            <Text style={styles.formatTitle}>Online</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formatCard, !isOnline && styles.formatCardActive]}
            onPress={() => setIsOnline(false)}
          >
            <Text style={styles.formatTitle}>In-person</Text>
          </TouchableOpacity>
        </View>

        {isOnline ? (
          <>
            <Text style={styles.label}>Meeting Link</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              value={meetingUrl}
              onChangeText={setMeetingUrl}
              editable={!isSubmitting}
              autoCapitalize="none"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Address or venue name"
              value={location}
              onChangeText={setLocation}
              editable={!isSubmitting}
            />
          </>
        )}

        <Text style={styles.label}>Capacity (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Leave blank for unlimited"
          value={capacity}
          onChangeText={setCapacity}
          keyboardType="number-pad"
          editable={!isSubmitting}
        />

        {myCommunities && myCommunities.length > 0 && (
          <>
            <Text style={styles.label}>Attach to a community (optional)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.communityRow}>
              <TouchableOpacity
                style={[styles.communityChip, !communityId && styles.communityChipActive]}
                onPress={() => setCommunityId(null)}
              >
                <Text style={[styles.communityChipText, !communityId && styles.communityChipTextActive]}>
                  Personal event
                </Text>
              </TouchableOpacity>
              {myCommunities.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.communityChip, communityId === c.id && styles.communityChipActive]}
                  onPress={() => setCommunityId(c.id)}
                >
                  <Text style={[styles.communityChipText, communityId === c.id && styles.communityChipTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#b91c1c', fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  dateButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: { fontSize: 15, color: '#111827' },
  formatRow: { flexDirection: 'row', gap: 12 },
  formatCard: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, alignItems: 'center' },
  formatCardActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  formatTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  communityRow: { marginTop: 4 },
  communityChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  communityChipActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  communityChipText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  communityChipTextActive: { color: '#4338ca', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
