import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';

export default function NewCommunityScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Please give your community a name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/communities', {
        name,
        description: description || undefined,
        visibility,
      });
      navigation.replace('CommunityDetail', { slug: response.data.data.slug });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create community.');
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

        <Text style={styles.label}>Community Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Quiet Bookworms"
          value={name}
          onChangeText={setName}
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What's this community about?"
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!isSubmitting}
        />

        <Text style={styles.label}>Visibility</Text>
        <View style={styles.visibilityRow}>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'PUBLIC' && styles.visibilityCardActive]}
            onPress={() => setVisibility('PUBLIC')}
          >
            <Text style={styles.visibilityTitle}>Public</Text>
            <Text style={styles.visibilitySubtitle}>Anyone can find and join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.visibilityCard, visibility === 'PRIVATE' && styles.visibilityCardActive]}
            onPress={() => setVisibility('PRIVATE')}
          >
            <Text style={styles.visibilityTitle}>Private</Text>
            <Text style={styles.visibilitySubtitle}>Hidden from search</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Create Community</Text>
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
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  visibilityRow: { flexDirection: 'row', gap: 12 },
  visibilityCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
  },
  visibilityCardActive: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  visibilityTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  visibilitySubtitle: { fontSize: 11, color: '#6b7280', marginTop: 2 },
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
