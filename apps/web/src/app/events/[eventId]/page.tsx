'use client';

import Link from 'next/link';
import { ArrowLeft, MapPin, Link as LinkIcon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardBody, Avatar, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface EventDetail {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  isOnline: boolean;
  location?: string;
  meetingUrl?: string;
  capacity?: number;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  organizer: { id: string; username: string; displayName: string };
  community?: { name: string; slug: string } | null;
  _count: { attendees: number };
}

interface Attendee {
  status: 'GOING' | 'INTERESTED' | 'NOT_GOING';
  user: { id: string; username: string; displayName: string };
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function EventDetailPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const params = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [myStatus, setMyStatus] = useState<Attendee['status'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRsvping, setIsRsvping] = useState(false);

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventRes, attendeesRes] = await Promise.all([
        api.get(`/events/${params.eventId}`),
        api.get(`/events/${params.eventId}/attendees`),
      ]);
      setEvent(eventRes.data.data);
      setAttendees(attendeesRes.data.data);
      const mine = attendeesRes.data.data.find((a: Attendee) => a.user.id === user?.id);
      setMyStatus(mine?.status ?? null);
    } catch (err) {
      logger.error('Failed to load event', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.eventId, user?.id]);

  useEffect(() => {
    if (!user || !params.eventId) return;
    fetchEvent();
  }, [user, params.eventId, fetchEvent]);

  const rsvp = async (status: Attendee['status']) => {
    setIsRsvping(true);
    try {
      await api.post(`/events/${params.eventId}/rsvp`, { status });
      await fetchEvent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'RSVP failed');
    } finally {
      setIsRsvping(false);
    }
  };

  if (authLoading || !user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!event) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-600">Event not found.</main>
      </>
    );
  }

  const startDate = new Date(event.startsAt);
  const goingAttendees = attendees.filter((a) => a.status === 'GOING');

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/events" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm mb-6 inline-block">
            <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
            Back to Events
          </Link>

          <Card className="mb-6">
            <CardBody className="p-8">
              <div className="flex items-start justify-between mb-3">
                <Badge variant={event.isOnline ? 'info' : 'default'}>{event.isOnline ? 'Online' : 'In-person'}</Badge>
                {event.status === 'CANCELLED' && <Badge variant="danger">Cancelled</Badge>}
              </div>

              <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
              <p className="text-gray-600 mb-1">
                {startDate.toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              {event.location && (
                <p className="text-gray-600 mb-1 flex items-center gap-1">
                  <MapPin size={16} /> {event.location}
                </p>
              )}
              {event.meetingUrl && event.isOnline && (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline flex items-center gap-1 w-fit"
                >
                  <LinkIcon size={16} />
                  Join meeting link
                </a>
              )}

              <p className="text-sm text-gray-500 mt-3">
                Organized by{' '}
                <Link href={`/profile/${event.organizer.username}`} className="text-indigo-600 hover:text-indigo-700">
                  {event.organizer.displayName}
                </Link>
                {event.community && (
                  <>
                    {' '}
                    · in{' '}
                    <Link href={`/communities/${event.community.slug}`} className="text-indigo-600 hover:text-indigo-700">
                      {event.community.name}
                    </Link>
                  </>
                )}
              </p>

              {event.description && <p className="text-gray-700 mt-4">{event.description}</p>}

              {event.status !== 'CANCELLED' && (
                <div className="flex gap-2 mt-6 pt-6 border-t border-gray-200">
                  <Button
                    variant={myStatus === 'GOING' ? 'primary' : 'outline'}
                    onClick={() => rsvp('GOING')}
                    disabled={isRsvping}
                  >
                    Going
                  </Button>
                  <Button
                    variant={myStatus === 'INTERESTED' ? 'primary' : 'outline'}
                    onClick={() => rsvp('INTERESTED')}
                    disabled={isRsvping}
                  >
                    Interested
                  </Button>
                  <Button
                    variant={myStatus === 'NOT_GOING' ? 'secondary' : 'ghost'}
                    onClick={() => rsvp('NOT_GOING')}
                    disabled={isRsvping}
                  >
                    Can&apos;t go
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {goingAttendees.length} going{event.capacity ? ` (capacity: ${event.capacity})` : ''}
              </h2>
              {goingAttendees.length === 0 ? (
                <p className="text-sm text-gray-500">No one has RSVP&apos;d yet — be the first!</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {goingAttendees.map((a) => (
                    <Link
                      key={a.user.id}
                      href={`/profile/${a.user.username}`}
                      className="flex items-center gap-2 bg-gray-50 rounded-full pr-3 hover:bg-gray-100"
                    >
                      <Avatar size="sm" initials={initialsOf(a.user.displayName)} />
                      <span className="text-sm text-gray-700">{a.user.displayName}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}
