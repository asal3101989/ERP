// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/client';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      isInitialized: false,   // true once startup token-check is done
      error:        null,
      isDemoMode:   false,    // always false — demo mode removed

      // Called once on app startup to verify stored token.
      // Strategy: trust persisted user immediately (show app instantly),
      // then verify token with backend in the background.
      initialize: async () => {
        const { accessToken, user, logout } = get();

        // No token at all — go to login immediately
        if (!accessToken) {
          set({ isInitialized: true });
          return;
        }

        // Already have persisted user — unblock the UI right away
        if (user) {
          set({ isInitialized: true });
        }

        // Verify token in background (3s timeout)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 3000)
        );

        try {
          const { data } = await Promise.race([authAPI.me(), timeoutPromise]);
          set({ user: data, isInitialized: true });
        } catch {
          // Token invalid / expired / server down — force logout
          await logout();
          set({ isInitialized: true });
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authAPI.login({ email, password });
          localStorage.setItem('accessToken',  data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user:         data.user,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
            isLoading:    false,
            isDemoMode:   false,
            error:        null,
          });
          return { success: true };
        } catch (err) {
          const isNetwork = !err.response;
          const msg = isNetwork
            ? 'Cannot connect to server. Make sure the backend is running.'
            : (err.response?.data?.error || 'Invalid email or password.');
          set({ error: msg, isLoading: false });
          return { success: false, error: msg };
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try { await authAPI.logout({ refreshToken }); } catch (_) {}
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({
          user:         null,
          accessToken:  null,
          refreshToken: null,
          isDemoMode:   false,
          error:        null,
        });
      },

      fetchMe: async () => {
        try {
          const { data } = await authAPI.me();
          set({ user: data });
        } catch {
          await get().logout();
        }
      },

      clearError: () => set({ error: null }),

      // Role helpers
      isAdmin:        () => ['super_admin', 'admin'].includes(get().user?.role),
      isPM:           () => get().user?.role === 'project_manager',
      isSiteEngineer: () => get().user?.role === 'site_engineer',
      isQS:           () => get().user?.role === 'qs_engineer',
      isHSE:          () => get().user?.role === 'hse_officer',
      isAccountant:   () => get().user?.role === 'accountant',
      isIT:           () => get().user?.role === 'it_admin',
      hasRole:        (roles) => roles.includes(get().user?.role),
    }),
    {
      name: 'construct-erp-auth-v2',   // new key — clears old stale demo sessions
      partialize: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);

export default useAuthStore;
