'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader, Avatar, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { EmailVerificationBanner } from '@/components/EmailVerificationBanner';
import { AdUnit } from '@/components/ads/AdUnit';
import { AD_SLOTS } from '@/components/ads/ad-slots';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { Bot, Heart, MessageSquare, ArrowRight } from 'lucide-react';
import { logger } from '@/lib/logger';

interface BlogSummary {
  id: string;
  title: string;
  excerpt?: string;
  slug: string;
  readingTime: number;
  createdAt: string;
  author: { id: string; username: string; displayName: string };
  _count: { likes: number; comments: number };
}

interface SuggestedUser {
  id: string;
  username: string;
  displayName: string;
  profile?: { bio?: string };
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [blogs, setBlogs] = useState<BlogSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedUser[]>([]);
  const [stats, setStats] = useState<{ followers: number; following: number; blogs: number } | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const [blogsRes, suggestedRes, statsRes] = await Promise.all([
          api.get('/blogs/trending'),
          api.get('/users/me/suggested'),
          api.get('/users/me/stats'),
        ]);
        setBlogs(blogsRes.data.data);
        setSuggested(suggestedRes.data.data);
        setStats(statsRes.data.data);
      } catch (err) {
        logger.error('Failed to load dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const toggleLike = async (blogId: string) => {
    const newLiked = new Set(liked);
    newLiked.has(blogId) ? newLiked.delete(blogId) : newLiked.add(blogId);
    setLiked(newLiked);
    try {
      await api.post(`/blogs/${blogId}/like`);
    } catch {
      setLiked(liked);
    }
  };

  const followUser = async (userId: string) => {
    try {
      await api.post(`/users/${userId}/follow`);
      setSuggested((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      logger.error('Follow failed', err);
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
          {user.isEmailVerified === false && <EmailVerificationBanner />}

          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome back, {user.displayName}!
            </h1>
            <p className="text-gray-600">Discover new connections and conversations in your community</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card hoverable className="bg-gradient-to-r from-indigo-50 to-indigo-100 border-indigo-200">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Chat with AI Assistant</h3>
                      <p className="text-gray-600 text-sm">Get personalized advice from our AI companion</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                      <Bot size={24} className="text-indigo-600" strokeWidth={1.75} />
                    </div>
                  </div>
                  <Button variant="primary" className="mt-4" asChild>
                    <Link href="/ai-chat">Start Conversation</Link>
                  </Button>
                </CardBody>
              </Card>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Trending Blogs</h2>
                  <Link href="/blogs" className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    View All <ArrowRight size={16} />
                  </Link>
                </div>

                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Spinner />
                  </div>
                ) : blogs.length === 0 ? (
                  <Card>
                    <CardBody className="text-center py-8 text-gray-500">
                      No blogs yet. Be the first to write one!
                    </CardBody>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {blogs.map((blog) => (
                      <Card key={blog.id} hoverable>
                        <CardBody>
                          <div className="flex gap-4">
                            <Avatar size="lg" initials={initialsOf(blog.author.displayName)} />
                            <div className="flex-1">
                              <Link href={`/blogs/${blog.slug}`}>
                                <h3 className="text-lg font-bold text-gray-900 hover:text-indigo-600 mb-2">
                                  {blog.title}
                                </h3>
                              </Link>
                              <p className="text-gray-600 text-sm mb-3">{blog.excerpt}</p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <Link href={`/profile/${blog.author.username}`} className="hover:text-indigo-600">
                                  {blog.author.displayName}
                                </Link>
                                <span>{blog.readingTime} min read</span>
                              </div>
                              <div className="flex gap-4 mt-4">
                                <button
                                  onClick={() => toggleLike(blog.id)}
                                  className={`flex items-center gap-2 text-sm font-medium ${
                                    liked.has(blog.id) ? 'text-red-600' : 'text-gray-600 hover:text-red-600'
                                  }`}
                                >
                                  <Heart size={16} fill={liked.has(blog.id) ? 'currentColor' : 'none'} />
                                  {blog._count.likes + (liked.has(blog.id) ? 1 : 0)}
                                </button>
                                <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
                                  <MessageSquare size={16} /> {blog._count.comments}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <h3 className="font-bold text-gray-900">Your Story</h3>
                </CardHeader>
                <CardBody>
                  <div className="flex gap-4 mb-4">
                    <Avatar size="lg" initials={initialsOf(user.displayName)} src={user.profile?.avatarUrl} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.displayName}</p>
                      <p className="text-sm text-gray-600">@{user.username}</p>
                    </div>
                  </div>
                  <Button variant="outline" fullWidth asChild>
                    <Link href={`/profile/${user.username}`}>View Profile</Link>
                  </Button>
                  <Button variant="outline" fullWidth className="mt-2" asChild>
                    <Link href="/blogs/new">Write Blog</Link>
                  </Button>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h3 className="font-bold text-gray-900">People to Follow</h3>
                </CardHeader>
                <CardBody>
                  {suggested.length === 0 ? (
                    <p className="text-sm text-gray-500">No suggestions right now — check back later.</p>
                  ) : (
                    <div className="space-y-4">
                      {suggested.map((s) => (
                        <div key={s.id} className="flex items-center gap-3">
                          <Avatar size="md" initials={initialsOf(s.displayName)} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{s.displayName}</p>
                            <p className="text-xs text-gray-600 truncate">{s.profile?.bio}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => followUser(s.id)}>
                            Follow
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" fullWidth className="mt-4" asChild>
                    <Link href="/discover">Discover More</Link>
                  </Button>
                </CardBody>
              </Card>

              {stats && (
                <Card>
                  <CardHeader>
                    <h3 className="font-bold text-gray-900">Your Stats</h3>
                  </CardHeader>
                  <CardBody>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Followers</span>
                        <span className="font-bold text-gray-900">{stats.followers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Following</span>
                        <span className="font-bold text-gray-900">{stats.following}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your Blogs</span>
                        <span className="font-bold text-gray-900">{stats.blogs}</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              <Card bordered={false} className="p-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 px-1">Advertisement</p>
                <AdUnit slot={AD_SLOTS.dashboardSidebar} style={{ minHeight: 250 }} />
              </Card>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
