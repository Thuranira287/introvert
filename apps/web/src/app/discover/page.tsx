'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Avatar, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface DiscoverUser {
  id: string;
  username: string;
  displayName: string;
  profile?: { bio?: string; interests?: string[] };
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function DiscoverPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const response = query
        ? await api.get('/users/search', { params: { q: query } })
        : await api.get('/users/me/suggested', { params: { limit: 20 } });
      setUsers(response.data.data);
    } catch (err) {
      logger.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(timeout);
  }, [user, search, fetchUsers]);

  const toggleFollow = async (targetId: string) => {
    const isFollowing = followedIds.has(targetId);
    const next = new Set(followedIds);
    isFollowing ? next.delete(targetId) : next.add(targetId);
    setFollowedIds(next);

    try {
      isFollowing ? await api.delete(`/users/${targetId}/follow`) : await api.post(`/users/${targetId}/follow`);
    } catch (err) {
      logger.error('Follow toggle failed', err);
      setFollowedIds(followedIds); // revert
    }
  };

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
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Discover People</h1>
            <p className="text-gray-600 mb-6">Find and connect with like-minded introverts</p>

            <input
              type="search"
              placeholder="Search by name or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : users.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((u) => (
                <Card key={u.id} hoverable>
                  <CardBody>
                    <div className="text-center mb-4">
                      <Avatar size="lg" initials={initialsOf(u.displayName)} />
                    </div>
                    <Link href={`/profile/${u.username}`}>
                      <h3 className="text-lg font-bold text-gray-900 text-center hover:text-indigo-600">
                        {u.displayName}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-600 text-center mb-3">@{u.username}</p>
                    {u.profile?.bio && <p className="text-sm text-gray-600 text-center mb-4">{u.profile.bio}</p>}

                    <div className="flex gap-2">
                      <Button
                        variant={followedIds.has(u.id) ? 'secondary' : 'primary'}
                        fullWidth
                        onClick={() => toggleFollow(u.id)}
                      >
                        {followedIds.has(u.id) ? 'Following' : 'Follow'}
                      </Button>
                      <Button variant="outline" fullWidth asChild>
                        <Link href={`/profile/${u.username}`}>View</Link>
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-12 text-gray-600">
                {search ? 'No people found matching your search.' : 'No suggestions right now.'}
              </CardBody>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
