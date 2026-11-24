'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdminNav } from '@/components/admin/AdminNav';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface AdminCommunityRow {
  id: string;
  name: string;
  slug: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  createdAt: string;
  owner: { username: string; displayName: string };
  _count: { members: number; posts: number };
}

export default function AdminCommunitiesPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireAdmin();
  const [communities, setCommunities] = useState<AdminCommunityRow[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchCommunities = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/communities', { params: { search: query || undefined, take: 50 } });
      setCommunities(response.data.data.data);
    } catch (err) {
      logger.error('Failed to load communities', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const timeout = setTimeout(() => fetchCommunities(search), 300);
    return () => clearTimeout(timeout);
  }, [isAuthorized, search, fetchCommunities]);

  const handleRemove = async (community: AdminCommunityRow) => {
    if (!confirm(`Remove "${community.name}"? This deletes all its posts and memberships permanently.`)) return;

    setActioningId(community.id);
    try {
      await api.delete(`/admin/communities/${community.id}`);
      setCommunities((prev) => prev.filter((c) => c.id !== community.id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex">
        <AdminNav />

        <main className="flex-1 bg-gray-50 min-h-[calc(100vh-64px)] p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Communities</h1>
            <input
              type="search"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Card>
            <CardBody className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : communities.length === 0 ? (
                <p className="text-center py-12 text-gray-500">No communities found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">Community</th>
                      <th className="px-6 py-3 font-medium">Owner</th>
                      <th className="px-6 py-3 font-medium">Visibility</th>
                      <th className="px-6 py-3 font-medium">Members</th>
                      <th className="px-6 py-3 font-medium">Posts</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {communities.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-500">/{c.slug}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {c.owner.displayName} (@{c.owner.username})
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={c.visibility === 'PUBLIC' ? 'info' : 'default'} size="sm">
                            {c.visibility}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{c._count.members}</td>
                        <td className="px-6 py-4 text-gray-600">{c._count.posts}</td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemove(c)}
                            isLoading={actioningId === c.id}
                            disabled={actioningId === c.id}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </main>
      </div>
    </>
  );
}
