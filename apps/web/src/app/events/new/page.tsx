'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardBody, Button, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface MyCommunity {
  id: string;
  name: string;
}

function NewEventPageInner() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [myCommunities, setMyCommunities] = useState<MyCommunity[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api
      .get('/communities/me')
      .then((res) => setMyCommunities(res.data.data))
      .catch((err) => logger.error('Failed to load your communities', err));

    const preselected = searchParams.get('communityId');
    if (preselected) setCommunityId(preselected);
  }, [user, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !startsAt) {
      setError('Please fill in the title and start time.');
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
        startsAt: new Date(startsAt).toISOString(),
        capacity: capacity ? Number(capacity) : undefined,
        communityId: communityId || undefined,
      });
      router.push(`/events/${response.data.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create event. Please try again.');
    } finally {
      setIsSubmitting(false);
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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Create an Event</h1>

          <Card>
            <CardBody className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <Input
                  label="Event Title"
                  placeholder="e.g. Quiet Coffee Meetup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isSubmitting}
                  fullWidth
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What should attendees know?"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>

                <Input
                  label="Starts At"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  disabled={isSubmitting}
                  fullWidth
                  required
                />

                {myCommunities.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Attach to a community (optional)</label>
                    <select
                      value={communityId}
                      onChange={(e) => setCommunityId(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Personal event (no community)</option>
                      {myCommunities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Members of that community will be notified when you publish.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsOnline(true)}
                      className={`flex-1 px-4 py-3 rounded-lg border text-left transition-colors ${
                        isOnline ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900">Online</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOnline(false)}
                      className={`flex-1 px-4 py-3 rounded-lg border text-left transition-colors ${
                        !isOnline ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900">In-person</p>
                    </button>
                  </div>
                </div>

                {isOnline ? (
                  <Input
                    label="Meeting Link"
                    placeholder="https://..."
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    disabled={isSubmitting}
                    fullWidth
                  />
                ) : (
                  <Input
                    label="Location"
                    placeholder="Address or venue name"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    disabled={isSubmitting}
                    fullWidth
                  />
                )}

                <Input
                  label="Capacity (optional)"
                  type="number"
                  min={1}
                  placeholder="Leave blank for unlimited"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={isSubmitting}
                  fullWidth
                />

                <Button type="submit" fullWidth size="lg" isLoading={isSubmitting} disabled={isSubmitting}>
                  Create Event
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <NewEventPageInner />
    </Suspense>
  );
}
