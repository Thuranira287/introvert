'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface EventSummary {
  id: string;
  title: string;
  startsAt: string;
  isOnline: boolean;
  location?: string;
  organizer: { username: string; displayName: string };
  community?: { name: string; slug: string } | null;
  _count: { attendees: number };
}

export default function EventsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .get('/events')
      .then((res) => setEvents(res.data.data))
      .catch((err) => logger.error('Failed to load events', err))
      .finally(() => setIsLoading(false));
  }, [user]);

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
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Events</h1>
              <p className="text-gray-600">Upcoming get-togethers, online and in-person</p>
            </div>
            <Button size="lg" asChild>
              <Link href="/events/new">Create Event</Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => {
                const date = new Date(event.startsAt);
                return (
                  <Link key={event.id} href={`/events/${event.id}`}>
                    <Card hoverable>
                      <CardBody>
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 w-16 text-center bg-indigo-50 rounded-lg py-2">
                            <p className="text-xs font-medium text-indigo-600">
                              {date.toLocaleDateString(undefined, { month: 'short' })}
                            </p>
                            <p className="text-xl font-bold text-indigo-700">{date.getDate()}</p>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">{event.title}</h3>
                            <p className="text-sm text-gray-500 mb-2">
                              {date.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}
                              {event.community && <> · in {event.community.name}</>}
                            </p>
                            <div className="flex items-center gap-3">
                              <Badge variant={event.isOnline ? 'info' : 'default'} size="sm">
                                {event.isOnline ? 'Online' : event.location || 'In-person'}
                              </Badge>
                              <span className="text-xs text-gray-500">{event._count.attendees} going</span>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-gray-600 mb-4">No upcoming events yet.</p>
                <Button variant="outline" asChild>
                  <Link href="/events/new">Create the first one</Link>
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
