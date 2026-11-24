'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

/**
 * Redirects to /login if the user isn't authenticated once the initial
 * auth check has finished. Use at the top of any page that requires a
 * signed-in user: `const { user } = useRequireAuth();` then render null
 * (or a spinner) while `user` is null and loading hasn't settled yet.
 */
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  return { user, isLoading };
}
