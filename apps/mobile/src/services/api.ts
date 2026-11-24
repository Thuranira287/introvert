import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from '../store/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('userToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
          (originalRequest as any)._retry = true;
          try {
            // Try to refresh token using the stored refresh token (not the expired access token)
            const storedRefreshToken = await SecureStore.getItemAsync('refreshToken');
            if (!storedRefreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
              refreshToken: storedRefreshToken,
            });

            const { accessToken, refreshToken: newRefreshToken } = response.data.data;
            await SecureStore.setItemAsync('userToken', accessToken);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);

            originalRequest.headers!.Authorization = `Bearer ${accessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, sign out user
            const authStore = useAuthStore.getState();
            await authStore.signOut();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  get http() {
    return this.client;
  }
}

export const apiClient = new APIClient();

export default apiClient.http;
