'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Card, CardBody, Button, Input } from '@/components/ui';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      // The endpoint always returns success regardless of whether the email
      // exists, to avoid leaking registered emails — so this only fires on
      // network/server errors.
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/icon.png" alt="Introvert Corner" width={48} height={48} className="rounded-xl" priority />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-600 mt-2">
            {sent
              ? "If that email is registered, we've sent a reset link. Check your inbox."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        <Card>
          <CardBody className="p-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm mb-5">
                {error}
              </div>
            )}

            {!sent && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  fullWidth
                  required
                />
                <Button type="submit" fullWidth size="lg" isLoading={isLoading} disabled={isLoading}>
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardBody>
        </Card>

        <p className="text-center mt-6 text-gray-600">
          <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
            <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
            Back to Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
