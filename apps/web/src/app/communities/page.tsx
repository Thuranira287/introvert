'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface CommunitySummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  _count: { members: number; posts: number };
}

export default function CommunitiesPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCommunities = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.get('/communities', { params: { search: query || undefined } });
      setCommunities(response.data.data);
    } catch (err) {
      logger.error('Failed to load communities', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(() => fetchCommunities(search), 300);
    return () => clearTimeout(timeout);
  }, [user, search, fetchCommunities]);

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Communities</h1>
              <p className="text-gray-600">Find your people around shared interests</p>
            </div>
            <Button size="lg" asChild>
              <Link href="/communities/new">Create Community</Link>
            </Button>
          </div>

          <input
            type="search"
            placeholder="Search communities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
          />

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : communities.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {communities.map((c) => (
                <Link key={c.id} href={`/communities/${c.slug}`}>
                  <Card hoverable className="h-full">
                    <CardBody>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{c.name}</h3>
                        <Badge variant="info" size="sm">
                          {c.visibility}
                        </Badge>
                      </div>
                      {c.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                        <span>{c._count.members} members</span>
                        <span>{c._count.posts} posts</span>
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-gray-600 mb-4">
                  {search ? 'No communities found.' : 'No communities yet — start one!'}
                </p>
                <Button variant="outline" asChild>
                  <Link href="/communities/new">Create the first community</Link>
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
