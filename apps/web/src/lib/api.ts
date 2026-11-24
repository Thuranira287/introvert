import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

/**
 * Token storage: localStorage, for simplicity in this scaffold.
 *
 * Tradeoff worth knowing: localStorage is readable by any JS running on the
 * page, so it's vulnerable to XSS in a way httpOnly cookies aren't. For a
 * production deployment, consider moving refresh tokens (at minimum) to an
 * httpOnly, secure, sameSite cookie set by the API, with the access token
 * kept in memory only. That requires the backend to set/read cookies rather
 * than returning tokens in the response body — a backend change, not just
 * a frontend one.
 */
const TOKEN_KEY = 'ic_access_token';
const REFRESH_KEY = 'ic_refresh_token';

export const tokenStorage = {
  getAccessToken: () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null),
  getRefreshToken: () => (typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null),
  setTokens: (accessToken: string, refreshToken: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't attempt to refresh the refresh-token call itself, or login/register.
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // Queue the request until the in-flight refresh resolves.
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(api(originalRequest));
          } else {
            reject(error);
          }
        });
      });
    }

    isRefreshing = true;
    const refreshToken = tokenStorage.getRefreshToken();

    if (!refreshToken) {
      tokenStorage.clear();
      isRefreshing = false;
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(error);
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;
      tokenStorage.setTokens(accessToken, newRefreshToken);

      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      refreshQueue.forEach((cb) => cb(null));
      refreshQueue = [];
      tokenStorage.clear();
      if (typeof window !== 'undefined') window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
