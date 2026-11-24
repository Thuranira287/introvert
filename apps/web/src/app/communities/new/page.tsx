'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button, Input, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import api from '@/lib/api';

export default function NewCommunityPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please give your community a name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/communities', { name, description: description || undefined, visibility });
      router.push(`/communities/${response.data.data.slug}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create community. Please try again.');
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
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Create a Community</h1>

          <Card>
            <CardBody className="p-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <Input
                  label="Community Name"
                  placeholder="e.g. Quiet Bookworms"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  fullWidth
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What's this community about?"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setVisibility('PUBLIC')}
                      className={`flex-1 px-4 py-3 rounded-lg border text-left transition-colors ${
                        visibility === 'PUBLIC' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900">Public</p>
                      <p className="text-xs text-gray-500">Anyone can find and join</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisibility('PRIVATE')}
                      className={`flex-1 px-4 py-3 rounded-lg border text-left transition-colors ${
                        visibility === 'PRIVATE' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                      }`}
                    >
                      <p className="font-medium text-gray-900">Private</p>
                      <p className="text-xs text-gray-500">Hidden from search</p>
                    </button>
                  </div>
                </div>

                <Button type="submit" fullWidth size="lg" isLoading={isSubmitting} disabled={isSubmitting}>
                  Create Community
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </main>
    </>
  );
}
