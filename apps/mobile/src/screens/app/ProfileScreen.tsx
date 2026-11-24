import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import { VerificationBadge } from '../../components/VerificationBadge';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen({ navigation }: any) {
  const signOut = useAuthStore((s) => s.signOut);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const response = await api.get('/users/me/profile');
      return response.data.data;
    },
  });

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  const initials = profile.displayName
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
          <Text style={styles.name}>{profile.displayName}</Text>
          <VerificationBadge verificationType={profile.verificationType} size={18} />
        </View>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.profile?.bio ? <Text style={styles.bio}>{profile.profile.bio}</Text> : null}

        {!profile.verificationType && (
          <TouchableOpacity style={styles.premiumBanner} onPress={() => navigation.navigate('Premium')}>
            <Icon name="sparkles" size={18} color="#4f46e5" />
            <Text style={styles.premiumBannerText}>Get Verified</Text>
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.stats?.followers ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.stats?.following ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.stats?.blogs ?? 0}</Text>
            <Text style={styles.statLabel}>Blogs</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Achievements')}>
          <Icon name="trophy-outline" size={18} color="#374151" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Achievements</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('MyProgress')}>
          <Icon name="stats-chart-outline" size={18} color="#374151" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>My Progress</Text>
        </TouchableOpacity>
        {profile.verificationType && (
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Earnings')}>
            <Icon name="cash-outline" size={18} color="#374151" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Earnings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('EditProfile')}>
          <Icon name="create-outline" size={18} color="#374151" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('AnonymousInbox')}>
          <Icon name="mail-unread-outline" size={18} color="#374151" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Anonymous Messages</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
          <Icon name="settings-outline" size={18} color="#374151" style={styles.menuIcon} />
          <Text style={styles.menuItemText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 14,
  },
  premiumBannerText: { color: '#4338ca', fontWeight: '600', fontSize: 13 },
  statsRow: { flexDirection: 'row', marginTop: 20, gap: 32 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  menuItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginTop: 8,
  },
  menuIcon: { marginRight: 10 },
  menuItemText: { fontSize: 15, color: '#111827', fontWeight: '500' },
  signOutButton: { marginTop: 32, paddingVertical: 12, paddingHorizontal: 24 },
  signOutText: { color: '#ef4444', fontWeight: '600', fontSize: 15 },
});
