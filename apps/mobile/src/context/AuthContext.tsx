import React, { createContext, useContext, ReactNode } from 'react';

import { useAuthStore } from '../store/authStore';

interface AuthContextType {
  isLoading: boolean;
  isSignout: boolean;
  userToken: string | null;
  user: any;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  const value = {
    isLoading: store.isLoading,
    isSignout: store.isSignout,
    userToken: store.userToken,
    user: store.user,
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
