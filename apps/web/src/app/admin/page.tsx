'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdminNav } from '@/components/admin/AdminNav';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface Stats {
  users: { total: number; active: number; new30d: number; new7d: number };
  blogs: { total: number; published: number };
  communities: { total: number };
  events: { total: number; upcoming: number };
  reports: { pending: number };
  engagement: { messages: number; aiConversations: number };
}

function StatCard({ label, value, sublabel }: { label: string; value: number | string; sublabel?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-gray-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
      </CardBody>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthorized) return;
    api
      .get('/admin/stats')
      .then((res) => setStats(res.data.data))
      .catch((err) => logger.error('Failed to load admin stats', err))
      .finally(() => setIsLoading(false));
  }, [isAuthorized]);

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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Platform Overview</h1>

          {isLoading || !stats ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-8 max-w-5xl">
              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Users</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Users" value={stats.users.total} />
                  <StatCard label="Active" value={stats.users.active} />
                  <StatCard label="New (30d)" value={stats.users.new30d} />
                  <StatCard label="New (7d)" value={stats.users.new7d} />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Content</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Total Blogs" value={stats.blogs.total} />
                  <StatCard label="Published" value={stats.blogs.published} />
                  <StatCard label="Communities" value={stats.communities.total} />
                  <StatCard
                    label="Events"
                    value={stats.events.total}
                    sublabel={`${stats.events.upcoming} upcoming`}
                  />
                </div>
              </section>

              <section>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Engagement & Safety</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Messages Sent" value={stats.engagement.messages} />
                  <StatCard label="AI Conversations" value={stats.engagement.aiConversations} />
                  <StatCard
                    label="Pending Reports"
                    value={stats.reports.pending}
                    sublabel={stats.reports.pending > 0 ? 'Needs review' : 'All clear'}
                  />
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
