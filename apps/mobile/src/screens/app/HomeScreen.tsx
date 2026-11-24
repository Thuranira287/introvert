import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import api from '../../services/api';

export default function HomeScreen({ navigation }: any) {
  const {
    data: blogs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['blogs', 'trending'],
    queryFn: async () => {
      const response = await api.get('/blogs/trending');
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Error loading content</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.subtitle}>Discover connections for introverts</Text>
        </View>

        <TouchableOpacity style={styles.aiCard} onPress={() => navigation.navigate('AIAssistant')}>
          <Icon name="chatbubble-ellipses-outline" size={28} color="#6366f1" style={styles.aiCardEmoji} />
          <View style={styles.aiCardContent}>
            <Text style={styles.aiCardTitle}>Chat with AI Assistant</Text>
            <Text style={styles.aiCardSubtitle}>Get personalized advice</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trending Now</Text>
          {blogs && blogs.length > 0 ? (
            blogs.slice(0, 5).map((blog: any) => (
              <TouchableOpacity
                key={blog.id}
                style={styles.blogCard}
                onPress={() => navigation.navigate('BlogDetail', { blogId: blog.id })}
              >
                <View>
                  <Text style={styles.blogTitle} numberOfLines={2}>
                    {blog.title}
                  </Text>
                  <Text style={styles.blogExcerpt} numberOfLines={2}>
                    {blog.excerpt}
                  </Text>
                  <View style={styles.blogMeta}>
                    <Text style={styles.author}>{blog.author.username}</Text>
                    <Text style={styles.readTime}>{blog.readingTime} min read</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No blogs yet</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ExploreTab')}>
              <Icon name="compass-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Discover</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('BlogsTab')}>
              <Icon name="document-text-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Blogs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('ExploreTab', { screen: 'Communities' })}
            >
              <Icon name="people-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Communities</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('ExploreTab', { screen: 'Events' })}
            >
              <Icon name="calendar-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('MessagesTab')}>
              <Icon name="chatbubbles-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ProfileTab')}>
              <Icon name="person-outline" size={24} color="#4f46e5" style={styles.actionEmoji} />
              <Text style={styles.actionLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  aiCard: {
    flexDirection: 'row',
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    margin: 20,
    marginVertical: 10,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1',
  },
  aiCardEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  aiCardContent: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  aiCardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  blogCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  blogTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  blogExcerpt: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  blogMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  author: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  readTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '31%',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
});
