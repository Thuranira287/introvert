'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/**
 * Like useRequireAuth, but also redirects non-admins to the dashboard.
 * The real enforcement is server-side (RolesGuard on the /admin/* API
 * routes) — this hook only prevents a logged-in-but-unauthorized user from
 * briefly seeing the admin UI shell before their API calls fail.
 */
export function useRequireAdmin() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/login');
    } else if (!ADMIN_ROLES.includes(user.role)) {
      router.push('/dashboard');
    }
  }, [isLoading, user, router]);

  return { user, isLoading, isAuthorized: !!user && ADMIN_ROLES.includes(user.role) };
}
