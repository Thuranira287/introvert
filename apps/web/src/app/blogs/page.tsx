'use client';

import Link from 'next/link';
import { Fragment, useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Avatar, Button, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdUnit } from '@/components/ads/AdUnit';
import { AD_SLOTS } from '@/components/ads/ad-slots';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { Heart, Eye, MessageSquare } from 'lucide-react';
import { logger } from '@/lib/logger';

interface BlogSummary {
  id: string;
  title: string;
  excerpt?: string;
  slug: string;
  readingTime: number;
  views: number;
  createdAt: string;
  author: { username: string; displayName: string };
  category?: { name: string } | null;
  _count: { likes: number; comments: number };
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase();
}

function daysAgo(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000));
}

export default function BlogsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const [blogs, setBlogs] = useState<BlogSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');

  const fetchBlogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/blogs', { params: { search: searchTerm || undefined, sortBy, take: 30 } });
      setBlogs(response.data.data.data);
    } catch (err) {
      logger.error('Failed to load blogs', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, sortBy]);

  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(fetchBlogs, 300); // debounce search
    return () => clearTimeout(timeout);
  }, [user, fetchBlogs]);

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
          <div className="mb-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Blogs</h1>
                <p className="text-gray-600">Discover stories from our community</p>
              </div>
              <Button size="lg" asChild>
                <Link href="/blogs/new">Write Blog</Link>
              </Button>
            </div>

            <div className="space-y-4">
              <Input
                type="search"
                placeholder="Search blogs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                fullWidth
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="recent">Latest</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : blogs.length > 0 ? (
            <div className="grid gap-6">
              {blogs.map((blog, index) => (
                <Fragment key={blog.id}>
                  <Card hoverable>
                    <CardBody>
                      <div className="flex gap-4">
                        <Avatar size="lg" initials={initialsOf(blog.author.displayName)} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <Link href={`/blogs/${blog.slug}`}>
                              <h3 className="text-xl font-bold text-gray-900 hover:text-indigo-600">
                                {blog.title}
                              </h3>
                            </Link>
                            {blog.category && (
                              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                                {blog.category.name}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{blog.excerpt}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                            <Link href={`/profile/${blog.author.username}`} className="hover:text-indigo-600 font-medium">
                              {blog.author.displayName}
                            </Link>
                            <span>•</span>
                            <span>{blog.readingTime} min read</span>
                            <span>•</span>
                            <span>{daysAgo(blog.createdAt)}d ago</span>
                          </div>
                          <div className="flex gap-6 pt-4 border-t border-gray-200">
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
                              <Heart size={16} /> {blog._count.likes}
                            </span>
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
                              <Eye size={16} /> {blog.views}
                            </span>
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-600 ml-auto">
                              <MessageSquare size={16} /> {blog._count.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {(index + 1) % 4 === 0 && (
                    <div className="py-1">
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Advertisement</p>
                      <AdUnit slot={AD_SLOTS.blogsFeed} format="in-feed" style={{ minHeight: 120 }} />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody className="text-center py-12">
                <p className="text-gray-600 mb-4">No blogs found.</p>
                <Button variant="outline" asChild>
                  <Link href="/blogs/new">Write the first one</Link>
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
