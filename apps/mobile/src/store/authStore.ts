import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { logger } from '../utils/logger';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified?: boolean;
  verificationType?: 'ADMIN_GRANTED' | 'PREMIUM' | null;
}

interface AuthState {
  userToken: string | null;
  user: User | null;
  isLoading: boolean;
  isSignout: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signUp: (data: { email: string; username: string; password: string; displayName: string }) => Promise<void>;
  signOut: () => Promise<void>;
  restoreToken: () => Promise<void>;
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const useAuthStore = create<AuthState>((set) => ({
  userToken: null,
  user: null,
  isLoading: true,
  isSignout: false,

  restoreToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const userStr = await SecureStore.getItemAsync('user');

      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ userToken: token, user });
      }
    } catch (e) {
      logger.error('Failed to restore token', e);
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      const { user, accessToken, refreshToken } = response.data.data;
      const token = accessToken;

      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({ userToken: token, user, isSignout: false });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async (idToken: string) => {
    try {
      set({ isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/auth/google/mobile`, { idToken });

      const { user, accessToken, refreshToken } = response.data.data;
      const token = accessToken;

      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({ userToken: token, user, isSignout: false });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Google sign-in failed');
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (data) => {
    try {
      set({ isLoading: true });

      const response = await axios.post(`${API_BASE_URL}/auth/register`, data);

      const { user, accessToken, refreshToken } = response.data.data;
      const token = accessToken;

      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('refreshToken', refreshToken);
      await SecureStore.setItemAsync('user', JSON.stringify(user));

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({ userToken: token, user, isSignout: false });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });

      // Call logout endpoint (revokes the refresh token server-side)
      const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
      if (storedRefreshToken) {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken: storedRefreshToken });
      }

      await SecureStore.deleteItemAsync('userToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');

      delete axios.defaults.headers.common['Authorization'];

      set({ userToken: null, user: null, isSignout: true });
    } catch (error: any) {
      logger.error('Logout error:', error);
      // Still clear local state even if API call fails
      set({ userToken: null, user: null, isSignout: true });
    } finally {
      set({ isLoading: false });
    }
  },
}));

useAuthStore.getState().restoreToken();
