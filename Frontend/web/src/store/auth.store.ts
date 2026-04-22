import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/types/auth';
import { api } from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setAuth: (user, accessToken) => {
        localStorage.setItem('access_token', accessToken);
        set({ user, accessToken, isAuthenticated: true });
        // Fire-and-forget cart merge: take any items the seeker added while
        // signed out and union them into their server-side cart. Import here
        // (not at top of file) to avoid a circular store dependency.
        import('./cart.store').then(({ useCartStore }) => {
          useCartStore.getState().mergeGuestCartIntoUser().catch(() => { /* silent */ });
        });
      },

      clearAuth: () => {
        localStorage.removeItem('access_token');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // swallow — clear locally regardless
        } finally {
          get().clearAuth();
        }
      },
    }),
    {
      name: 'sc-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state._hasHydrated = true;
            // Sync the access_token to localStorage for the API interceptor
            if (state.accessToken) {
              localStorage.setItem('access_token', state.accessToken);
            }
          }
        };
      },
    },
  ),
);
