/**
 * Proactive access-token refresh.
 *
 * The backend access token is short-lived (30 minutes). If we wait for the
 * token to actually 401 before refreshing, every 30 minutes the user's next
 * action blocks on a round-trip to `/auth/refresh`, parallel requests race,
 * and the odd transient network failure logs them out.
 *
 * This module decodes the JWT's `exp` claim and schedules a silent refresh
 * 2 minutes before expiry. Called:
 *   - on sign-in / register (via auth.store `setAuth`)
 *   - on app boot (via auth.store `onRehydrateStorage`)
 *   - after every successful refresh (from the axios interceptor) to keep
 *     the chain rolling for as long as the user is active.
 *
 * Network or 5xx errors during the proactive refresh are swallowed — the
 * reactive 401 interceptor is still the safety net for those cases.
 */
import axios from 'axios';

const REFRESH_LEAD_MS = 2 * 60 * 1000; // Refresh 2 minutes before expiry
const MIN_DELAY_MS = 5_000; // Never fire faster than 5s after scheduling

let timerId: ReturnType<typeof setTimeout> | null = null;
let onRefreshed: ((newAccessToken: string) => void) | null = null;

/**
 * Set the callback invoked after a successful proactive refresh. The auth
 * store registers itself here so the new token lands in localStorage and
 * the Zustand state without this module needing to import the store (which
 * would create a circular dependency with axios setup).
 */
export function registerRefreshCallback(
  cb: (newAccessToken: string) => void,
): void {
  onRefreshed = cb;
}

interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

function decodeExpMs(accessToken: string): number | null {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return null;
    // base64url decode — browsers only speak base64, so convert first.
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload);
    const claims = JSON.parse(json) as JwtPayload;
    if (!claims.exp || typeof claims.exp !== 'number') return null;
    return claims.exp * 1000; // seconds → ms
  } catch {
    return null;
  }
}

export function cancelProactiveRefresh(): void {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function scheduleProactiveRefresh(accessToken: string | null): void {
  cancelProactiveRefresh();
  if (!accessToken || typeof window === 'undefined') return;

  const expMs = decodeExpMs(accessToken);
  if (!expMs) return;

  const msUntilRefresh = Math.max(expMs - Date.now() - REFRESH_LEAD_MS, MIN_DELAY_MS);

  // Token already expired (or nearly so) — let the reactive 401 interceptor
  // handle it on the next API call rather than firing a refresh immediately
  // at app boot.
  if (expMs - Date.now() < MIN_DELAY_MS) return;

  timerId = setTimeout(async () => {
    timerId = null;
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        {},
        { withCredentials: true, timeout: 10_000 },
      );
      const newToken = res.data?.accessToken as string | undefined;
      if (newToken && onRefreshed) {
        onRefreshed(newToken);
      }
    } catch {
      // Swallow — the 401 interceptor is still the safety net. If the
      // refresh endpoint is genuinely broken, the user will be prompted
      // to sign in on their next real API call.
    }
  }, msUntilRefresh);
}
