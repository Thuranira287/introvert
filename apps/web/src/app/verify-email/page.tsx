'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button, Card, CardBody, Spinner } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

type Status = 'verifying' | 'success' | 'failed';

function VerifyEmail() {
  const token = useSearchParams().get('token');
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This verification link is missing or incomplete.');
  const hasRequested = useRef(false);

  useEffect(() => {
    // The token is single-use, so guard against React re-running this effect.
    if (!token || hasRequested.current) return;
    hasRequested.current = true;

    api
      .post('/auth/verify-email', { token })
      .then(async () => {
        if (user) await refreshUser();
        setStatus('success');
      })
      .catch((err) => {
        setMessage(getErrorMessage(err, 'This verification link is invalid or has expired.'));
        setStatus('failed');
      });
  }, [token, user, refreshUser]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image src="/icon.png" alt="Introvert Corner" width={48} height={48} className="rounded-xl" priority />
        </div>
        <Card>
          <CardBody className="p-8 text-center flex flex-col items-center gap-4">
            {status === 'verifying' && (
              <>
                <Spinner size="lg" />
                <p className="text-gray-600">Verifying your email...</p>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle2 size={40} className="text-green-600" />
                <h1 className="text-xl font-bold text-gray-900">Email verified</h1>
                <p className="text-gray-600">Thanks for confirming your address.</p>
                <Button asChild fullWidth>
                  <Link href="/dashboard">Continue</Link>
                </Button>
              </>
            )}
            {status === 'failed' && (
              <>
                <XCircle size={40} className="text-red-500" />
                <h1 className="text-xl font-bold text-gray-900">Verification failed</h1>
                <p className="text-gray-600">{message}</p>
                <p className="text-sm text-gray-500">Sign in and use the banner on your dashboard to get a new link.</p>
                <Button asChild variant="outline" fullWidth>
                  <Link href="/login">Sign in</Link>
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <VerifyEmail />
    </Suspense>
  );
}
