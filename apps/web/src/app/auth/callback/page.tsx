'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { tokenStorage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

function CallbackInner() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    // Tokens arrive in the URL fragment (#...), not the query string, so
    // they never get logged by servers or proxies along the redirect path.
    // The fragment is only readable client-side via window.location.hash.
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (!accessToken || !refreshToken) {
      setError('Google sign-in did not complete. Please try again.');
      return;
    }

    tokenStorage.setTokens(accessToken, refreshToken);

    (async () => {
      await refreshUser();
      router.replace('/dashboard');
    })();
  }, [router, refreshUser]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1">
          <ArrowLeft size={16} />
          Back to Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Spinner size="lg" />
      <p className="text-gray-600">Signing you in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>}>
      <CallbackInner />
    </Suspense>
  );
}
