/**
 * Authentication Store
 *
 * Manages user authentication state and user profile.
 *
 * Sprint 2.2b (2026-05-16): Access and refresh tokens are no longer persisted to
 * `localStorage`. The backend issues both as HttpOnly+Secure+SameSite=Lax cookies
 * (`access_token`, `refresh_token`) on login, refresh, and OAuth callbacks; the
 * `apiClient` carries them automatically via `withCredentials: true`.
 *
 * The `token` field on the store now always holds the `COOKIE_AUTH_TOKEN` sentinel
 * (`'cookie-auth'`) for signed-in users, or `null` otherwise. Consumers that gate
 * on `!!token` ("am I signed in?") continue to work unchanged. The Bearer-header
 * path in `apiClient` is kept as a dead-but-safe fallback for one release; it will
 * be removed in a follow-up PR.
 *
 * See `docs/SECURITY.md` → *Frontend Token Storage*.
 */

import { API_URL } from '@/config/env';
import { queryClient } from '@/hooks/queries/queryClient';
import { apiClient, isApiClientError } from '@/services/apiClient';
import type { ApiError, AuthStore, User } from '@/types/store';
import { logger } from '@/utils/logger';
import axios, { AxiosHeaders } from 'axios';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

// Constants for cookie-based authentication
const COOKIE_AUTH_TOKEN = 'cookie-auth'; // Placeholder token for cookie-based auth
const COOKIE_AUTH_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours default client-side hint

// Configure axios defaults for any remaining legacy callers that still import
// `axios` directly. The `apiClient` is the preferred path and already handles
// `withCredentials` + CSRF on its own.
// Follow-up (tracked in TECH_DEBT, Sprint 2.2c): remove once all callers route through `apiClient`.
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

// Add CSRF token interceptor for any remaining global-axios callers (see above).
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function readCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = /(?:^|; )csrf_token=([^;]*)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

function setCsrfHeader(headers: AxiosHeaders | Record<string, unknown>, token: string): void {
  if (headers instanceof AxiosHeaders) {
    headers.set('X-CSRF-Token', token);
  } else {
    (headers as Record<string, string>)['X-CSRF-Token'] = token;
  }
}

axios.interceptors.request.use(
  config => {
    if (!config.headers) {
      config.headers = new AxiosHeaders();
    }
    const method = config.method?.toUpperCase();
    if (method && MUTATING_METHODS.has(method)) {
      const csrfToken = readCsrfTokenFromCookie();
      if (csrfToken) {
        setCsrfHeader(config.headers, csrfToken);
      }
    }
    return config;
  },
  error => Promise.reject(error)
);

export const useAuthStore = create<AuthStore>()(
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
        _logoutInProgress: false,

        // Actions
        login: async (_token?: string, _refreshToken?: string) => {
          // Sprint 2.2b: the backend issues `access_token` + `refresh_token` HttpOnly
          // cookies on every login/OAuth/refresh response. The optional token args
          // here are accepted for backwards compatibility with callsites that still
          // destructure them from the response body, but they are intentionally
          // ignored — we no longer persist tokens client-side and never attach a
          // Bearer header. The cookie is already set on `document` by the time this
          // action runs, so fetching the profile via `apiClient` (withCredentials)
          // is sufficient to confirm the session.
          set({ loading: true, error: null });

          try {
            // Ensure no stale Bearer header lingers on the global axios instance
            // (legacy callers may still import axios directly).
            delete axios.defaults.headers.common['Authorization'];

            const data = await apiClient.getRaw<
              { data?: User; user?: User } & Record<string, unknown>
            >('/api/v2/users/me');
            const user = data?.data || data?.user || (data as unknown as User | null) || null;

            if (!user) {
              throw new Error('Login failed: profile response did not include a user');
            }

            // Normalize: ensure organizationId mirrors activeOrgId for components
            // that reference user.organizationId (legacy pattern across 20+ files)
            if (user.activeOrgId && !user.organizationId) {
              user.organizationId = user.activeOrgId;
            }

            set({
              user,
              token: COOKIE_AUTH_TOKEN,
              refreshToken: null,
              isAuthenticated: true,
              expiresAt: Date.now() + COOKIE_AUTH_EXPIRY_MS,
              loading: false,
              error: null,
              _logoutInProgress: false,
            });
          } catch (error: unknown) {
            // Prefer ApiClientError fields (Sprint 2.2b uses apiClient.getRaw);
            // fall back to legacy axios response shape for callers wrapping
            // raw axios errors.
            const asApiClient = isApiClientError(error) ? error : null;
            const errorResponse =
              !asApiClient && error && typeof error === 'object' && 'response' in error
                ? (error as {
                    response?: { data?: { message?: string; code?: string }; status?: number };
                  })
                : null;

            const errorMessage =
              asApiClient?.message ||
              errorResponse?.response?.data?.message ||
              (error instanceof Error ? error.message : 'Login failed');
            const errorCode = asApiClient?.code || errorResponse?.response?.data?.code;
            const errorStatus = asApiClient?.statusCode || errorResponse?.response?.status;

            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              expiresAt: null,
              loading: false,
              error: {
                message: errorMessage,
                code: errorCode,
                status: errorStatus,
              },
            });
            throw error;
          }
        },

        logout: async () => {
          // Set logout guard FIRST to prevent tryAuthWithCookies from racing
          set({ _logoutInProgress: true });

          try {
            // Call logout endpoint on server to clear session/cookies.
            // The HttpOnly access_token cookie carries authentication; we only
            // attach the device fingerprint header for session-binding validation.
            if (get().isAuthenticated) {
              let fingerprintHeader: string | undefined;
              try {
                const { getFingerprintHeader } = await import('@/utils/deviceFingerprint');
                fingerprintHeader = await getFingerprintHeader();
              } catch {
                // Non-fatal: fingerprint may not be available
              }

              await axios
                .post(
                  '/api/v2/auth/logout',
                  {},
                  {
                    headers: {
                      ...(fingerprintHeader ? { 'X-Device-Fingerprint': fingerprintHeader } : {}),
                    },
                    withCredentials: true,
                  }
                )
                .catch(() => {
                  // Non-fatal: server may be unreachable
                });
            }
          } catch (error) {
            // Ignore errors during server-side logout
            logger.debug('Server logout failed (non-fatal):', error);
          } finally {
            // Always perform client-side logout
            // Clear axios header
            delete axios.defaults.headers.common['Authorization'];

            // Reset state (keep _logoutInProgress true to block tryAuthWithCookies)
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              expiresAt: null,
              error: null,
              _logoutInProgress: true,
            });

            // Clear localStorage
            localStorage.removeItem('auth-storage');

            // Clear React Query cache so user-scoped data (memberships, profiles, etc.)
            // from the previous session does not leak into the next user's session.
            try {
              queryClient.clear();
            } catch (cacheError) {
              logger.debug('Failed to clear React Query cache on logout:', cacheError);
            }

            // Clear any remaining cookies on the client side
            // NOSONAR: CWE-1004/CWE-614 — client-side clearing is a best-effort cleanup.
            // Server-side logout (authController) clears httpOnly cookies; these lines
            // clear the non-httpOnly csrf_token and serve as belt-and-suspenders for the rest.
            document.cookie =
              'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Lax';
            document.cookie =
              'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Lax';
            document.cookie =
              'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; Secure; SameSite=Lax';

            // Clear the logout guard after a short delay so subsequent logins work
            setTimeout(() => {
              set({ _logoutInProgress: false });
            }, 2000);
          }
        },

        refreshAuth: async () => {
          // Sprint 2.2b: refresh is driven entirely by the HttpOnly `refresh_token`
          // cookie. We send an empty POST; the backend reads/rotates the cookie and
          // sets a new `access_token` cookie on the response. We then re-validate
          // the session via `tryAuthWithCookies` to refresh the in-memory user.
          set({ loading: true });

          try {
            await axios.post('/api/v2/auth/refresh', {}, { withCredentials: true });
            const ok = await get().tryAuthWithCookies();
            if (!ok) {
              throw new Error('Session could not be re-established after refresh');
            }
          } catch (error: unknown) {
            set({
              loading: false,
              error: {
                message: 'Session expired. Please login again.',
                code: 'REFRESH_FAILED',
              },
            });
            get().logout();
            throw error;
          }
        },

        updateUser: (userData: Partial<User>) => {
          const { user } = get();
          if (user) {
            set({
              user: { ...user, ...userData },
            });
          }
        },

        checkAuth: (): boolean => {
          const { isAuthenticated, expiresAt, user } = get();

          if (!isAuthenticated || !user) {
            return false;
          }

          // `expiresAt` is now a soft, client-only hint (cookie expiry is
          // authoritative and lives on the server). If it has elapsed, kick off a
          // silent refresh; the real source of truth is the next 401, which the
          // axios response interceptor will handle.
          if (expiresAt && Date.now() >= expiresAt) {
            get()
              .refreshAuth()
              .catch(() => {
                get().logout();
              });
            return false;
          }

          // Cookie-based auth: never attach an Authorization header.
          delete axios.defaults.headers.common['Authorization'];
          return true;
        },

        /**
         * Try to authenticate using httpOnly cookies
         * This is used when landing on the app after OAuth redirect
         * @returns Promise<boolean> - true if authentication successful
         */
        tryAuthWithCookies: async (): Promise<boolean> => {
          // Block re-authentication if a logout is in progress or just completed
          if (get()._logoutInProgress) {
            set({ loading: false, isAuthenticated: false });
            return false;
          }

          // Always validate session with backend to ensure cookies are still valid
          // Even if state says authenticated, verify and refresh user data to keep tests and UI in sync
          set({ loading: true, error: null });

          try {
            // Try to fetch user data with credentials (httpOnly cookies)
            // apiClient automatically attaches CSRF token from cookie and includes credentials
            const data = await apiClient.getRaw<
              { data?: User; user?: User } & Record<string, unknown>
            >('/api/v2/auth/me');

            const user = data?.data || data?.user || (data as unknown as User | null) || null;

            if (!user) {
              set({ loading: false });
              return false;
            }

            // Normalize: ensure organizationId mirrors activeOrgId for components
            // that reference user.organizationId (legacy pattern across 20+ files)
            if (user.activeOrgId && !user.organizationId) {
              user.organizationId = user.activeOrgId;
            }

            // Successfully authenticated with cookies
            set({
              user,
              token: COOKIE_AUTH_TOKEN, // Placeholder token to indicate cookie-based auth
              isAuthenticated: true,
              expiresAt: Date.now() + COOKIE_AUTH_EXPIRY_MS,
              loading: false,
              error: null,
              _logoutInProgress: false,
            });

            // Ensure axios auth header is cleared for cookie-based sessions
            delete axios.defaults.headers.common['Authorization'];

            return true;
          } catch (error) {
            // Unauthenticated session (e.g. 401) is an expected outcome — not an error
            if (isApiClientError(error) && error.statusCode > 0 && error.statusCode < 500) {
              set({ loading: false, isAuthenticated: false });
              return false;
            }
            logger.error(
              'Cookie authentication failed:',
              error instanceof Error ? error : new Error(String(error))
            );
            set({
              loading: false,
              error: {
                message: error instanceof Error ? error.message : 'Cookie authentication failed',
                code: 'COOKIE_AUTH_FAILED',
              },
            });
            return false;
          }
        },

        clearError: () => {
          set({ error: null });
        },

        setLoading: (loading: boolean) => {
          set({ loading });
        },

        setError: (error: ApiError | null) => {
          set({ error });
        },

        reset: () => {
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            expiresAt: null,
            loading: false,
            error: null,
            _logoutInProgress: false,
          });
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        // Sprint 2.2b: we no longer persist access or refresh tokens to
        // localStorage — they live in HttpOnly cookies. Only the user profile and
        // the `isAuthenticated` flag are persisted to give the UI a fast first
        // paint; the session itself is re-validated against `/api/v2/auth/me` on
        // app boot (`tryAuthWithCookies`).
        partialize: state => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
        onRehydrateStorage: () => state => {
          logger.debug('[authStore] Rehydrating from storage', {
            hasUser: !!state?.user,
            isAuthenticated: !!state?.isAuthenticated,
          });
          // Cookie-based auth: never attach an Authorization header on rehydrate.
          delete axios.defaults.headers.common['Authorization'];
          // `token` is intentionally not persisted; populate the sentinel so that
          // existing `!!token` "signed-in?" gates continue to work until
          // `tryAuthWithCookies` re-validates the session on app boot.
          if (state?.isAuthenticated && state.user) {
            state.token = COOKIE_AUTH_TOKEN;
            state.expiresAt = Date.now() + COOKIE_AUTH_EXPIRY_MS;
          } else if (state) {
            state.token = null;
            state.expiresAt = null;
          }
          if (state) {
            state.refreshToken = null;
          }
        },
      }
    ),
    {
      name: 'AuthStore',
      enabled: import.meta.env.DEV,
    }
  )
);

// Axios interceptor for automatic token refresh
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Never retry auth endpoints — especially logout, refresh, and login
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/logout') || url.includes('/auth/refresh') || url.includes('/auth/login');

    // If 401 and we haven't tried to refresh yet (skip auth endpoints)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        await useAuthStore.getState().refreshAuth();
        // Cookie-based auth: the rotated `access_token` cookie is attached
        // automatically on retry. No header rewrite needed.
        if (useAuthStore.getState().isAuthenticated) {
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed - logout and redirect to login
        useAuthStore.getState().logout();

        // Only redirect if not already on login or logout page
        if (
          globalThis.window !== undefined &&
          !globalThis.window.location.pathname.includes('/login') &&
          !globalThis.window.location.pathname.includes('/logout')
        ) {
          // Store current path for redirect after login
          const currentPath =
            globalThis.window.location.pathname + globalThis.window.location.search;
          sessionStorage.setItem('redirectAfterLogin', currentPath);
          globalThis.window.location.href = '/login?reason=session-expired';
        }

        return Promise.reject(refreshError); // NOSONAR: S7746 — must use Promise.reject in axios interceptor chain (throw doesn't propagate correctly in interceptor callbacks)
      }
    }

    return Promise.reject(error); // NOSONAR: S7746 — must use Promise.reject in axios interceptor chain
  }
);

// Export selectors for convenience
export const selectUser = (state: AuthStore) => state.user;
export const selectIsAuthenticated = (state: AuthStore) => state.isAuthenticated;
export const selectToken = (state: AuthStore) => state.token;
export const selectAuthLoading = (state: AuthStore) => state.loading;
export const selectAuthError = (state: AuthStore) => state.error;

// Helper hook for permissions
export const useHasPermission = (permission: string): boolean => {
  const user = useAuthStore(selectUser);
  return user?.permissions?.includes(permission as any) || false;
};

// Helper hook for role checking
export const useHasRole = (role: string | string[]): boolean => {
  const user = useAuthStore(selectUser);
  if (!user) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
};

import { meetsMinOrgRole } from '@/utils/roleUtils';

/**
 * Hook that checks if the current user's org role meets or exceeds the minimum required.
 * Platform admins always pass. Returns false if no orgRole set.
 */
export const useHasMinOrgRole = (minRole: string): boolean => {
  const user = useAuthStore(selectUser);
  if (!user) return false;
  // Platform admins bypass org role checks
  if (user.role === 'admin') return true;
  return meetsMinOrgRole(user.orgRole, minRole);
};
