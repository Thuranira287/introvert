'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { tokenStorage } from '../lib/api';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  verificationType?: 'ADMIN_GRANTED' | 'PREMIUM' | null;
  profile?: { avatarUrl?: string; bio?: string; adsEnabled?: boolean };
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (tokenStorage.getAccessToken()) {
        await fetchMe();
      }
      setIsLoading(false);
    })();
  }, [fetchMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post('/auth/login', { email, password });
      const { user: loggedInUser, accessToken, refreshToken } = response.data.data;
      tokenStorage.setTokens(accessToken, refreshToken);
      setUser(loggedInUser);
      router.push('/dashboard');
    },
    [router],
  );

  const register = useCallback(
    async (data: { email: string; username: string; password: string; displayName: string }) => {
      const response = await api.post('/auth/register', data);
      const { user: newUser, accessToken, refreshToken } = response.data.data;
      tokenStorage.setTokens(accessToken, refreshToken);
      setUser(newUser);
      router.push('/dashboard');
    },
    [router],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      // Best-effort server-side revoke — clear local state regardless.
    }
    tokenStorage.clear();
    setUser(null);
    router.push('/');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
