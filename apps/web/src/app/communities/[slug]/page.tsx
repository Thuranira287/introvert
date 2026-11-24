'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardBody, Avatar, Badge, Button, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface CommunityDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  owner: { id: string; username: string; displayName: string };
  _count: { members: number; posts: number };
}

interface CommunityPost {
  id: string;
  content: string;
  createdAt: string;
  author: { username: string; displayName: string };
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function CommunityDetailPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const params = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [postText, setPostText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const fetchCommunity = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/communities/${params.slug}`);
      setCommunity(response.data.data);
    } catch (err) {
      logger.error('Failed to load community', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    if (!user || !params.slug) return;
    fetchCommunity();
  }, [user, params.slug, fetchCommunity]);

  useEffect(() => {
    if (!community) return;

    api
      .get(`/communities/${community.id}/members`)
      .then((res) => {
        setIsMember(res.data.data.some((m: any) => m.user.id === user?.id));
      })
      .catch((err) => logger.error('Failed to load members', err));

    api
      .get(`/communities/${community.id}/posts`)
      .then((res) => setPosts(res.data.data))
      .catch((err) => logger.error('Failed to load posts', err));
  }, [community, user?.id]);

  const toggleMembership = async () => {
    if (!community) return;
    setIsJoining(true);
    try {
      if (isMember) {
        await api.post(`/communities/${community.id}/leave`);
        setIsMember(false);
        setCommunity({ ...community, _count: { ...community._count, members: community._count.members - 1 } });
      } else {
        await api.post(`/communities/${community.id}/join`);
        setIsMember(true);
        setCommunity({ ...community, _count: { ...community._count, members: community._count.members + 1 } });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!community || !postText.trim()) return;

    setIsPosting(true);
    try {
      const response = await api.post(`/communities/${community.id}/posts`, { content: postText });
      setPosts((prev) => [response.data.data, ...prev]);
      setPostText('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Only members can post. Join the community first.');
    } finally {
      setIsPosting(false);
    }
  };

  if (authLoading || !user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!community) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto py-16 px-4 text-center text-gray-600">Community not found.</main>
      </>
    );
  }

  const isOwner = community.owner.id === user.id;

  return (
    <>
      <Header />

      <main className="bg-gray-50 min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/communities" className="text-indigo-600 hover:text-indigo-700 font-medium text-sm mb-6 inline-block">
            <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
            Back to Communities
          </Link>

          <Card className="mb-6">
            <CardBody className="p-8">
              <div className="flex items-start justify-between mb-3">
                <h1 className="text-2xl font-bold text-gray-900">{community.name}</h1>
                <Badge variant="info">{community.visibility}</Badge>
              </div>
              {community.description && <p className="text-gray-700 mb-4">{community.description}</p>}

              <div className="flex items-center justify-between">
                <div className="flex gap-6 text-sm text-gray-500">
                  <span>{community._count.members} members</span>
                  <span>{community._count.posts} posts</span>
                  <span>
                    Owned by{' '}
                    <Link href={`/profile/${community.owner.username}`} className="text-indigo-600 hover:text-indigo-700">
                      {community.owner.displayName}
                    </Link>
                  </span>
                </div>

                {!isOwner && (
                  <Button
                    variant={isMember ? 'secondary' : 'primary'}
                    onClick={toggleMembership}
                    isLoading={isJoining}
                    disabled={isJoining}
                  >
                    {isMember ? 'Leave' : 'Join'}
                  </Button>
                )}
              </div>

              {(isMember || isOwner) && (
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href={`/events/new?communityId=${community.id}`}>+ Plan an event for this community</Link>
                </Button>
              )}
            </CardBody>
          </Card>

          {isMember || isOwner ? (
            <Card className="mb-6">
              <CardBody>
                <form onSubmit={handlePost} className="flex gap-3">
                  <Avatar size="md" initials={initialsOf(user.displayName)} />
                  <div className="flex-1 flex gap-3">
                    <Input
                      placeholder="Share something with the community..."
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      disabled={isPosting}
                      fullWidth
                    />
                    <Button type="submit" disabled={!postText.trim() || isPosting} isLoading={isPosting}>
                      Post
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : (
            <Card className="mb-6">
              <CardBody className="text-center text-sm text-gray-500 py-4">
                Join this community to post and see member-only content.
              </CardBody>
            </Card>
          )}

          <div className="space-y-4">
            {posts.length === 0 ? (
              <Card>
                <CardBody className="text-center py-8 text-gray-500">No posts yet. Be the first!</CardBody>
              </Card>
            ) : (
              posts.map((post) => (
                <Card key={post.id}>
                  <CardBody>
                    <div className="flex gap-3">
                      <Avatar size="md" initials={initialsOf(post.author.displayName)} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/profile/${post.author.username}`}
                            className="font-medium text-gray-900 hover:text-indigo-600"
                          >
                            {post.author.displayName}
                          </Link>
                          <span className="text-xs text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-line">{post.content}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
