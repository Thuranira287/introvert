'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, Badge, Button, Spinner } from '@/components/ui';
import { Header } from '@/components/Header';
import { AdminNav } from '@/components/admin/AdminNav';
import { VerificationBadge } from '@/components/VerificationBadge';
import { useRequireAdmin } from '@/hooks/useRequireAdmin';
import api from '@/lib/api';
import { logger } from '@/lib/logger';

interface AdminUserRow {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isVerified: boolean;
  verificationType: 'ADMIN_GRANTED' | 'PREMIUM' | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { blogs: number; followers: number };
}

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  USER: 'default',
  VERIFIED_USER: 'info',
  MODERATOR: 'warning',
  ADMIN: 'danger',
  SUPER_ADMIN: 'danger',
};

export default function AdminUsersPage() {
  const { user: currentUser, isAuthorized, isLoading: authLoading } = useRequireAdmin();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (query: string) => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/users', { params: { search: query || undefined, take: 50 } });
      setUsers(response.data.data.data);
    } catch (err) {
      logger.error('Failed to load users', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;
    const timeout = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(timeout);
  }, [isAuthorized, search, fetchUsers]);

  const toggleSuspend = async (targetUser: AdminUserRow) => {
    setActioningId(targetUser.id);
    try {
      const endpoint = targetUser.isActive ? 'suspend' : 'reactivate';
      await api.post(`/admin/users/${targetUser.id}/${endpoint}`);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: !u.isActive } : u)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  const toggleVerification = async (targetUser: AdminUserRow) => {
    setActioningId(targetUser.id);
    try {
      if (targetUser.isVerified) {
        await api.delete(`/admin/users/${targetUser.id}/verify`);
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, isVerified: false, verificationType: null } : u)),
        );
      } else {
        await api.post(`/admin/users/${targetUser.id}/verify`);
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, isVerified: true, verificationType: 'ADMIN_GRANTED' } : u)),
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Action failed');
    } finally {
      setActioningId(null);
    }
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex">
        <AdminNav />

        <main className="flex-1 bg-gray-50 min-h-[calc(100vh-64px)] p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Users</h1>
            <input
              type="search"
              placeholder="Search by name, username, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <Card>
            <CardBody className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner size="lg" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Role</th>
                      <th className="px-6 py-3 font-medium">Verification</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Joined</th>
                      <th className="px-6 py-3 font-medium">Blogs</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900 flex items-center gap-1">
                            {u.displayName}
                            <VerificationBadge verificationType={u.verificationType} size={14} />
                          </p>
                          <p className="text-xs text-gray-500">
                            @{u.username} · {u.email}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={ROLE_BADGE_VARIANT[u.role] ?? 'default'} size="sm">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {u.verificationType === 'PREMIUM' ? (
                            <span className="text-xs text-gray-500">Premium (self-serve)</span>
                          ) : (
                            <Button
                              variant={u.isVerified ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => toggleVerification(u)}
                              isLoading={actioningId === u.id}
                              disabled={actioningId === u.id}
                            >
                              {u.isVerified ? 'Revoke' : 'Grant Verified'}
                            </Button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={u.isActive ? 'success' : 'danger'} size="sm">
                            {u.isActive ? 'Active' : 'Suspended'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{u._count.blogs}</td>
                        <td className="px-6 py-4 text-right">
                          {['ADMIN', 'SUPER_ADMIN'].includes(u.role) ? (
                            <span className="text-xs text-gray-400">Protected</span>
                          ) : u.id === currentUser?.id ? (
                            <span className="text-xs text-gray-400">You</span>
                          ) : (
                            <Button
                              variant={u.isActive ? 'danger' : 'outline'}
                              size="sm"
                              onClick={() => toggleSuspend(u)}
                              isLoading={actioningId === u.id}
                              disabled={actioningId === u.id}
                            >
                              {u.isActive ? 'Suspend' : 'Reactivate'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </main>
      </div>
    </>
  );
}
