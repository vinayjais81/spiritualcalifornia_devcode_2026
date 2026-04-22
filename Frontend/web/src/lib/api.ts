import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // send httpOnly refresh_token cookie
  headers: { 'Content-Type': 'application/json' },
});

// Lazily mint a stable guest-cart session id on first cart interaction.
// Stored in localStorage so it survives tab/window close on the same device.
const CART_SESSION_KEY = 'sc-cart-session';
export function getOrCreateCartSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(CART_SESSION_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CART_SESSION_KEY, id);
  }
  return id;
}
export function clearCartSessionId() {
  if (typeof window !== 'undefined') localStorage.removeItem(CART_SESSION_KEY);
}

// Attach access token + guest cart session id to every request.
// The backend ignores x-session-id on non-cart endpoints, so it's harmless to
// always send and cheap to set here in one place.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['x-session-id'] = getOrCreateCartSessionId();
  }
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        const newToken = data.accessToken;
        localStorage.setItem('access_token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        // Redirect to sign-in with return URL preserved
        const isOnboarding = window.location.pathname.startsWith('/onboarding');
        window.location.href = isOnboarding
          ? '/signin?redirect=/onboarding/guide'
          : '/signin';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
