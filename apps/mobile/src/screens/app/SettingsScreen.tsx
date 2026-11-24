import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const [allowAnonymousMessages, setAllowAnonymousMessages] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, boolean>) => api.patch('/users/me/profile', data),
  });

  const toggleAnonymous = (value: boolean) => {
    setAllowAnonymousMessages(value);
    updateMutation.mutate({ allowAnonymousMessages: value });
  };

  const togglePublic = (value: boolean) => {
    setIsPublic(value);
    updateMutation.mutate({ isPublic: value });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Privacy</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Public Profile</Text>
            <Text style={styles.rowSubtitle}>Let anyone view your profile and blogs</Text>
          </View>
          <Switch value={isPublic} onValueChange={togglePublic} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Allow Anonymous Messages</Text>
            <Text style={styles.rowSubtitle}>Others can message you without revealing who they are</Text>
          </View>
          <Switch value={allowAnonymousMessages} onValueChange={toggleAnonymous} />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  signOutButton: { paddingVertical: 14 },
  signOutText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
