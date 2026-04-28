import axios from 'axios';
import { scheduleProactiveRefresh } from '@/lib/authRefresh';

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

/**
 * Attempt to refresh the access token. Returns the new token on success,
 * or throws with `isUnauthorized: true` if the refresh endpoint explicitly
 * says the refresh token is invalid (meaning we really are logged out).
 *
 * Critically: network / 5xx failures DO NOT throw `isUnauthorized`. Those
 * are transient and must not kick the user out of the app. The caller can
 * propagate the original 401 error to the page, but the user stays logged
 * in so their next retry can succeed.
 */
async function attemptRefresh(): Promise<string> {
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 10_000 },
    );
    return data.accessToken as string;
  } catch (err: any) {
    const status = err?.response?.status;
    const isReallyLoggedOut = status === 401 || status === 403;
    const error: any = new Error(
      isReallyLoggedOut
        ? 'Refresh token is invalid or expired'
        : 'Refresh temporarily failed (network / server)',
    );
    error.isUnauthorized = isReallyLoggedOut;
    error.originalStatus = status;
    throw error;
  }
}

// Auth endpoints that ARE the auth — a 401 from them means "credentials
// rejected", not "session expired". Trying to refresh and chaining a
// /signin redirect on these would clobber the form's error state, so we
// always let those 401s propagate untouched to the caller's catch block.
//
// Match by URL substring so it works regardless of `baseURL` shape.
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
];
function isAuthEndpoint(config: { url?: string } | undefined): boolean {
  const url = config?.url ?? '';
  return AUTH_ENDPOINTS.some((p) => url.includes(p));
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Don't try to refresh on 401s from auth endpoints — those are
    // credential failures (e.g. wrong password, EMAIL_NOT_VERIFIED). Let
    // the page handle the error message.
    if (isAuthEndpoint(original)) {
      return Promise.reject(error);
    }

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
        const newToken = await attemptRefresh();
        localStorage.setItem('access_token', newToken);
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        // Re-arm the proactive-refresh timer off the fresh token.
        scheduleProactiveRefresh(newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError: any) {
        processQueue(refreshError, null);

        // Only sign the user out on a REAL auth failure from the refresh
        // endpoint (401/403). Network errors, timeouts, 502s during a deploy,
        // CORS hiccups — none of those should dump the user onto /signin.
        if (refreshError?.isUnauthorized) {
          localStorage.removeItem('access_token');
          const isOnboarding = window.location.pathname.startsWith('/onboarding');
          window.location.href = isOnboarding
            ? '/signin?redirect=/onboarding/guide'
            : '/signin';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
