'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card, CardBody, Button, Input, Spinner } from '@/components/ui';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

const MIN_PASSWORD_LENGTH = 8;

function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/icon.png" alt="Introvert Corner" width={48} height={48} className="rounded-xl" priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{subtitle}</p>
        </div>
        {children}
        <p className="text-center mt-6 text-gray-600">
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1">
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <PageShell title="Link not valid" subtitle="This password reset link is missing or incomplete.">
        <Card>
          <CardBody className="p-8 text-center">
            <Button asChild fullWidth>
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </CardBody>
        </Card>
      </PageShell>
    );
  }

  if (isDone) {
    return (
      <PageShell title="Password updated" subtitle="You can now sign in with your new password.">
        <Card>
          <CardBody className="p-8 text-center">
            <Button asChild fullWidth size="lg">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardBody>
        </Card>
      </PageShell>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setIsDone(true);
    } catch (err) {
      setError(getErrorMessage(err, 'This reset link is invalid or has expired. Please request a new one.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell title="Choose a new password" subtitle="Pick something you haven't used elsewhere.">
      <Card>
        <CardBody className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
              disabled={isSubmitting}
              fullWidth
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              fullWidth
              required
            />

            <Button type="submit" fullWidth size="lg" isLoading={isSubmitting} disabled={isSubmitting}>
              Update password
            </Button>
          </form>
        </CardBody>
      </Card>
    </PageShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
