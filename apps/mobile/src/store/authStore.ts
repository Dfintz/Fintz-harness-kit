/**
 * Authentication Store for React Native
 *
 * Manages user authentication state with AsyncStorage persistence.
 * Uses Bearer token auth exclusively (no cookies/CSRF).
 */

import { queryClient } from '@/hooks/queries/queryClient';
import { apiClient, ApiClientError } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import { asyncStorage, removeStoredValue, setStoredValue } from '@/utils/storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatar?: string;
  activeOrgId?: string;
  organizationId?: string;
}

interface AuthError {
  message: string;
  code?: string;
  status?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  loading: boolean;
  error: AuthError | null;

  /** Set token and fetch user profile */
  login: (token: string, refreshToken?: string) => Promise<void>;
  /** Clear session and notify backend */
  logout: () => Promise<void>;
  /** Refresh the access token using the refresh token */
  refreshAuth: () => Promise<void>;
  /** Update user data in state */
  updateUser: (userData: Partial<User>) => void;
  /** Check if token is still valid */
  checkAuth: () => boolean;
  /** Clear error state */
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        expiresAt: null,
        loading: false,
        error: null,

        login: async (token: string, refreshToken?: string) => {
          set({ loading: true, error: null });

          try {
            // Set token provider for apiClient
            apiClient.setTokenProvider(() => token);

            // Store token for persistence across app restarts
            await setStoredValue('accessToken', token);
            if (refreshToken) {
              await setStoredValue('refreshToken', refreshToken);
            }

            // Fetch user profile
            const response = await apiClient.getData<User>('/api/v2/users/me');
            const user = response;

            // Normalize org ID
            if (user.activeOrgId && !user.organizationId) {
              user.organizationId = user.activeOrgId;
            }

            // Decode JWT expiry
            let expiresAt: number | null = null;
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              try {
                const payload = JSON.parse(atob(tokenParts[1]));
                expiresAt = payload.exp ? payload.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
              } catch {
                expiresAt = Date.now() + 24 * 60 * 60 * 1000;
              }
            } else {
              expiresAt = Date.now() + 24 * 60 * 60 * 1000;
            }

            set({
              user,
              token,
              refreshToken: refreshToken ?? get().refreshToken,
              isAuthenticated: true,
              expiresAt,
              loading: false,
              error: null,
            });
          } catch (error: unknown) {
            let errorMessage = 'Login failed';
            if (error instanceof ApiClientError) {
              errorMessage = error.message;
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }

            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              expiresAt: null,
              loading: false,
              error: { message: errorMessage },
            });

            // Clean up stored tokens on failure
            await removeStoredValue('accessToken');
            await removeStoredValue('refreshToken');

            throw error;
          }
        },

        logout: async () => {
          try {
            const token = get().token;
            if (token) {
              await apiClient.post('/api/v2/auth/logout', {}).catch(() => {
                // Non-fatal: server may be unreachable
              });
            }
          } catch (error) {
            logger.debug('Server logout failed (non-fatal):', error);
          } finally {
            // Clear token provider
            apiClient.setTokenProvider(() => null);

            // Clear state
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              expiresAt: null,
              error: null,
            });

            // Clear stored tokens
            await removeStoredValue('accessToken');
            await removeStoredValue('refreshToken');

            // Clear React Query cache to prevent data leakage between sessions
            try {
              queryClient.clear();
            } catch (cacheError) {
              logger.debug('Failed to clear React Query cache on logout:', cacheError);
            }
          }
        },

        refreshAuth: async () => {
          const { refreshToken } = get();

          if (!refreshToken) {
            await get().logout();
            return;
          }

          set({ loading: true });

          try {
            const response = await apiClient.postRaw<{
              token: string;
              refreshToken: string;
            }>('/api/v2/auth/refresh', { refreshToken });

            await get().login(response.token, response.refreshToken);
          } catch (error: unknown) {
            set({
              loading: false,
              error: {
                message: 'Session expired. Please login again.',
                code: 'REFRESH_FAILED',
              },
            });
            await get().logout();
            throw error;
          }
        },

        updateUser: (userData: Partial<User>) => {
          const { user } = get();
          if (user) {
            set({ user: { ...user, ...userData } });
          }
        },

        checkAuth: (): boolean => {
          const { isAuthenticated, expiresAt, token } = get();

          if (!isAuthenticated || !token) {
            return false;
          }

          // Check if token is expired
          if (expiresAt && Date.now() >= expiresAt) {
            get()
              .refreshAuth()
              .catch(() => {
                get().logout();
              });
            return false;
          }

          // Ensure apiClient has the token provider set
          apiClient.setTokenProvider(() => token);

          return true;
        },

        clearError: () => set({ error: null }),
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => asyncStorage),
        partialize: state => ({
          token: state.token,
          refreshToken: state.refreshToken,
          user: state.user,
          expiresAt: state.expiresAt,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'AuthStore', enabled: __DEV__ }
  )
);

// Standalone selectors
export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectToken = (state: AuthState) => state.token;
