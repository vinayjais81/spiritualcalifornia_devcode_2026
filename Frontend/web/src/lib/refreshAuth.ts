import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Role } from '@/types/auth';

/**
 * Decode the roles claim from a JWT access token without verifying its
 * signature (the server already verified it; we just need to surface its
 * contents to the client-side auth store).
 */
function decodeRolesFromJwt(token: string): Role[] {
  try {
    const payload = token.split('.')[1];
    if (!payload) return [];
    // atob handles standard base64; JWTs use base64url — normalise first.
    const normalised = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(normalised));
    return Array.isArray(json?.roles) ? (json.roles as Role[]) : [];
  } catch {
    return [];
  }
}

/**
 * Called after any server-side action that changes the authenticated user's
 * roles (e.g. guide onboarding assigns the GUIDE role). Forces a JWT rotation
 * via the httpOnly refresh-token cookie and updates the Zustand auth store
 * with the freshly-issued token's role claim, so subsequent API calls pass
 * @Roles guards immediately — no sign-out/sign-in required.
 */
export async function refreshAuthWithLatestRoles(): Promise<void> {
  try {
    const { data } = await api.post('/auth/refresh');
    const freshToken: string | undefined = data?.accessToken;
    if (!freshToken) return;

    const currentUser = useAuthStore.getState().user;
    const latestRoles = decodeRolesFromJwt(freshToken);
    if (currentUser) {
      useAuthStore.getState().setAuth(
        { ...currentUser, roles: latestRoles.length > 0 ? latestRoles : currentUser.roles },
        freshToken,
      );
    }
  } catch {
    // Non-fatal — user can still continue. If the role guard bites later they
    // can sign out/in to recover. Silent so onboarding UX isn't disrupted.
  }
}
