'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdminNav } from '@/components/admin/AdminNav';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface AdminEventRow {
  id: string;
  title: string;
  startsAt: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  isOnline: boolean;
  organizer: { username: string; displayName: string };
  community?: { name: string; slug: string } | null;
  _count: { attendees: number };
}

const STATUS_VARIANT: Record<AdminEventRow['status'], 'info' | 'success' | 'default' | 'danger'> = {
  UPCOMING: 'info',
  ONGOING: 'success',
  COMPLETED: 'default',
  CANCELLED: 'danger',
};

export default function AdminEventsPage() {
  const { isAuthorized, isLoading: authLoading } = useRequireAdmin();
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [search, setSearch] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchEvents = useCallback(async (query: string, showPast: boolean) => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/events', {
        params: { search: query || undefined, includePast: showPast, take: 50 },
      });
      setEvents(response.data.data.data);
    } catch (err) {
      logger.error('Failed to load events', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const timeout = setTimeout(() => fetchEvents(search, includePast), 300);
    return () => clearTimeout(timeout);
  }, [isAuthorized, search, includePast, fetchEvents]);

  const handleCancel = async (event: AdminEventRow) => {
    const reason = window.prompt(`Reason for cancelling "${event.title}" (shown in the audit log):`);
    if (reason === null) return;

    setActioningId(event.id);
    try {
      await api.post(`/admin/events/${event.id}/cancel`, { reason: reason || undefined });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: 'CANCELLED' } : e)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  const handleRemove = async (event: AdminEventRow) => {
    if (!confirm(`Permanently remove "${event.title}"? This cannot be undone.`)) return;

    setActioningId(event.id);
    try {
      await api.delete(`/admin/events/${event.id}`);
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
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
            <h1 className="text-3xl font-bold text-gray-900">Events</h1>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} />
                Include past events
              </label>
              <input
                type="search"
                placeholder="Search by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <Card>
            <CardBody className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-center py-12 text-gray-500">No events found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">Event</th>
                      <th className="px-6 py-3 font-medium">Organizer</th>
                      <th className="px-6 py-3 font-medium">When</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Attendees</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{e.title}</p>
                          {e.community && <p className="text-xs text-gray-500">in {e.community.name}</p>}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {e.organizer.displayName} (@{e.organizer.username})
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(e.startsAt).toLocaleDateString()} · {e.isOnline ? 'Online' : 'In-person'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={STATUS_VARIANT[e.status]} size="sm">
                            {e.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{e._count.attendees}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {e.status !== 'CANCELLED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(e)}
                              isLoading={actioningId === e.id}
                              disabled={actioningId === e.id}
                            >
                              Cancel
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemove(e)}
                            isLoading={actioningId === e.id}
                            disabled={actioningId === e.id}
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
