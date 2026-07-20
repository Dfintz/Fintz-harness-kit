import { useBackendHealth } from '@/hooks/useBackendHealth';
import { apiClient, isApiClientError } from '@/services/apiClient';
import { webAuthnService } from '@/services/webAuthnService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { getAuthErrorMessage } from '@/utils/errorHandling';
import { logger } from '@/utils/logger';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

/** Platform roles that grant admin portal access */
const ADMIN_ROLES = new Set(['admin', 'superadmin']);

/** Extract a friendly error message from an apiClient login failure */
function extractLoginErrorMessage(err: unknown): string {
  if (isApiClientError(err)) {
    const details = err.details as { message?: string; error?: { message?: string } } | undefined;
    return (
      details?.error?.message ||
      details?.message ||
      err.message ||
      `Admin authentication failed with status ${err.statusCode}`
    );
  }
  if (err instanceof Error) return err.message;
  return 'Authentication failed';
}

/**
 * Admin Login Page
 * Separate authentication page for admin access
 * Supports:
 * - Username/password authentication
 * - Passkey (WebAuthn/FIDO2) authentication
 */
export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, loading, error, setLoading, setError } = useAuthStore();
  const notification = useNotification();
  const { check: checkBackendHealth } = useBackendHealth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (isAuthenticated && user?.role && ADMIN_ROLES.has(user.role)) {
      navigate('/admin');
    }
  }, [isAuthenticated, user, navigate]);

  /**
   * Authenticate with a registered passkey (WebAuthn/FIDO2)
   */
  const handlePasskeyLogin = useCallback(async () => {
    if (!webAuthnService.isSupported()) {
      setError({ message: 'Passkeys are not supported on this browser or device.' });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const healthResult = await checkBackendHealth();
      if (!healthResult.isHealthy) {
        notification.error('Backend server is not available', 'Backend Server Not Available');
        setError({ message: 'Backend server is not available. Please start the backend server.' });
        return;
      }

      const result = await webAuthnService.authenticateWithPasskey();

      logger.debug('[Admin Passkey Login] Authentication successful', {
        hasUser: !!result.user,
        hasToken: !!result.token,
      });

      // The backend sets httpOnly cookies — establish session via cookie auth
      const authSuccess = await useAuthStore.getState().tryAuthWithCookies();

      if (!authSuccess) {
        throw new Error('Failed to establish session after passkey login');
      }

      // Verify admin role from the authenticated user in store
      const currentUser = useAuthStore.getState().user;
      logger.debug('[AdminLogin] Passkey user data from /auth/me:', {
        id: currentUser?.id,
        username: currentUser?.username,
        role: currentUser?.role,
        orgRole: currentUser?.orgRole,
      });
      if (!currentUser?.role || !ADMIN_ROLES.has(currentUser.role)) {
        throw new Error(
          `Admin access required. Your current role is "${currentUser?.role ?? 'undefined'}". ` +
            'Run: cd backend && npm run seed:admin (with PLATFORM_ADMIN_USERNAME matching your login username).'
        );
      }

      notification.success(
        `Welcome back, ${currentUser.username}!`,
        'Admin Passkey Login Successful'
      );
      navigate('/admin');
    } catch (err: unknown) {
      const message = webAuthnService.getErrorMessage(err);
      if (message !== 'Authentication cancelled or not allowed') {
        setTimeout(() => {
          setError({ message });
          notification.error(message, 'Passkey Login Failed');
        }, 0);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, notification, setError, setLoading, checkBackendHealth]);

  /**
   * Handle admin login with username/password
   */
  const handleAdminLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!username || !password) {
        notification.error('Please enter both username and password', 'Login Error');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Admin login endpoint is CSRF-exempt (username/password auth doesn't need CSRF protection)
        let loginData: { data?: { user?: unknown }; user?: unknown };
        try {
          loginData = await apiClient.postRaw<{ data?: { user?: unknown }; user?: unknown }>(
            '/api/v2/auth/login',
            { username, password }
          );
        } catch (err) {
          throw new Error(extractLoginErrorMessage(err));
        }

        const loginUser = (loginData?.data?.user ?? loginData?.user) as
          | { role?: string; username?: string }
          | undefined;
        logger.debug('[AdminLogin] Login response user:', loginUser);

        // Check admin role from login response first (most reliable — directly from login)
        if (!loginUser?.role || !ADMIN_ROLES.has(loginUser.role)) {
          throw new Error(
            `Admin access required. Login response role is "${loginUser?.role ?? 'undefined'}". ` +
              'Ensure your account has the admin role in the database.'
          );
        }

        // Backend sets httpOnly cookies on successful login.
        // Use tryAuthWithCookies to validate the session and populate the store.
        const authenticated = await useAuthStore.getState().tryAuthWithCookies();

        if (!authenticated) {
          throw new Error('Authentication failed. Could not establish session.');
        }

        // Verify admin role from the authenticated user in store
        const currentUser = useAuthStore.getState().user;
        logger.debug('[AdminLogin] User data from /auth/me:', {
          id: currentUser?.id,
          username: currentUser?.username,
          role: currentUser?.role,
          loginResponseRole: loginUser?.role,
        });

        // Use the /auth/me role for final check (fresh from DB)
        if (!currentUser?.role || !ADMIN_ROLES.has(currentUser.role)) {
          throw new Error(
            `Admin access required. Login says role="${loginUser?.role}" but /auth/me says role="${currentUser?.role ?? 'undefined'}". ` +
              'This may be a caching issue — try clearing cookies and logging in again.'
          );
        }

        notification.success('Admin login successful!', `Welcome, ${currentUser?.username}!`);
        navigate('/admin');
      } catch (err: unknown) {
        const errorMessage = getAuthErrorMessage(err, 'Admin');
        // Defer state update to avoid React error #185
        setTimeout(() => {
          setError({ message: errorMessage });
          notification.error(errorMessage, 'Authentication Error');
        }, 0);
      } finally {
        setLoading(false);
      }
    },
    [username, password, navigate, notification, setError, setLoading]
  );

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-emblem">
          <div className="login-logo-container">
            {!logoLoadError && (
              <img
                src="/fringecore.png"
                alt="Fringe Core Logo"
                className="login-logo-image"
                onError={() => setLogoLoadError(true)}
              />
            )}
            {logoLoadError && <div className="login-logo-core" />}
            <div className="login-logo-lattice" />
            <div className="login-logo-arc">
              <div className="arc"></div>
              <div className="arc"></div>
              <div className="arc"></div>
            </div>
          </div>
          <h1 className="login-title">Admin Portal</h1>
          <p className="login-tagline">Secure Administrative Access</p>
        </div>

        <p className="login-subtitle">
          This portal is restricted to authorized administrators only. Please authenticate with your
          admin credentials.
        </p>

        {error && <div className="login-error">{error.message}</div>}

        <form onSubmit={handleAdminLogin} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter admin username"
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="login-discord-button"
          >
            {loading ? 'Authenticating...' : 'Login as Admin'}
          </button>
        </form>

        <div className="login-passkey-divider">
          <span className="login-passkey-divider-line" />
          <span className="login-passkey-divider-text">or</span>
          <span className="login-passkey-divider-line" />
        </div>

        <button
          id="admin-passkey-login"
          onClick={handlePasskeyLogin}
          disabled={loading}
          className="login-passkey-button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="10" cy="7" r="4" fill="currentColor" />
            <path
              d="M5 19c0-3.31 2.69-5 5-5s5 1.69 5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="18.5" cy="14.5" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path
              d="M20.5 17l1.5 1.5M22 18.5v3M22 20h-1.5M22 21.5h-1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {loading ? 'Authenticating...' : 'Sign in with Passkey'}
        </button>

        <div className="login-navigation">
          <button onClick={() => navigate('/')} className="login-nav-button">
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
