'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';
import { Lightbulb } from 'lucide-react';

export default function NewBlogPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [error, setError] = useState('');

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const submit = async (publish: boolean) => {
    setError('');

    if (!title.trim() || !content.trim()) {
      setError('Please add a title and some content.');
      return;
    }
    if (content.trim().length < 50) {
      setError('Content must be at least 50 characters.');
      return;
    }

    publish ? setIsPublishing(true) : setIsDraftSaving(true);
    try {
      const response = await api.post('/blogs', { title, content, publish });
      if (publish) {
        router.push(`/blogs/${response.data.data.slug}`);
      } else {
        router.push('/blogs');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save. Please try again.');
    } finally {
      setIsPublishing(false);
      setIsDraftSaving(false);
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
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Write a Blog</h1>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => submit(false)}
                isLoading={isDraftSaving}
                disabled={isDraftSaving || isPublishing}
              >
                Save Draft
              </Button>
              <Button onClick={() => submit(true)} isLoading={isPublishing} disabled={isDraftSaving || isPublishing}>
                Publish
              </Button>
            </div>
          </div>

          <Card>
            <CardBody className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
              )}

              <Input
                type="text"
                placeholder="Your blog title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-2xl font-bold border-0 border-b-2 rounded-none px-0 focus:ring-0"
                fullWidth
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your thoughts, experiences, or advice with the community..."
                  rows={16}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
                <p className="text-sm text-gray-500 mt-2">
                  {wordCount} words · ~{readingTime} min read
                </p>
              </div>
            </CardBody>
          </Card>

          <p className="text-sm text-gray-500 mt-4 text-center flex items-center justify-center gap-1.5">
            <Lightbulb size={14} />
            Tip: Authentic, specific stories tend to resonate most with the Introvert Corner community.
          </p>
        </div>
      </main>
    </>
  );
}
