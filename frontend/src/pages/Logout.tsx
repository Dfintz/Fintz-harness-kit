/**
 * Logout Page
 *
 * Handles user logout by clearing authentication state and redirecting to login.
 * Can be triggered by:
 * - User clicking logout button
 * - Session timeout
 * - Connection error
 */

import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { useTheme } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type LogoutReason = 'user-initiated' | 'session-timeout' | 'connection-error' | 'unauthorized';

export const Logout: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout } = useAuthStore();

  const reason = (searchParams.get('reason') as LogoutReason) || 'user-initiated';
  const redirectDelay = 1500; // milliseconds

  useEffect(() => {
    const performLogout = async () => {
      try {
        // Clear authentication state
        await logout();
      } catch (error) {
        logger.error(
          'Error during logout:',
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Redirect to login after a brief delay
      const timer = setTimeout(() => {
        // CWE-601: Validate redirect URL to prevent open redirect attacks
        const requestedRedirect = searchParams.get('redirect');
        let redirectUrl = '/login';

        // Only allow internal paths (must start with /)
        if (requestedRedirect) {
          try {
            // Parse the redirect to ensure it's a relative path
            const url = new URL(requestedRedirect, window.location.origin);

            // Only allow same-origin redirects
            if (url.origin === window.location.origin && url.pathname.startsWith('/')) {
              redirectUrl = url.pathname + url.search + url.hash;
            } else {
              logger.warn('Attempted redirect to external URL blocked:', requestedRedirect);
            }
          } catch {
            // Invalid URL, use default
            logger.warn('Invalid redirect URL, using default:', requestedRedirect);
          }
        }

        navigate(redirectUrl, { replace: true });
      }, redirectDelay);

      return () => clearTimeout(timer);
    };

    performLogout();
  }, [logout, navigate, searchParams]);

  // Show appropriate message based on logout reason
  const getLogoutMessage = () => {
    switch (reason) {
      case 'session-timeout':
        return 'Your session has expired due to inactivity. Please log in again.';
      case 'connection-error':
        return 'Connection lost. Please log in again.';
      case 'unauthorized':
        return 'Your session is no longer valid. Please log in again.';
      case 'user-initiated':
      default:
        return 'Logging you out...';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: theme.palette.background.default,
        color: theme.palette.common.white,
        gap: '2rem',
      }}
    >
      <LoadingSpinner />
      <div style={{ textAlign: 'center', fontSize: '1.1rem' }}>
        <p>{getLogoutMessage()}</p>
        <p style={{ fontSize: '0.9rem', color: 'inherit', opacity: 0.7 }}>
          Redirecting to login...
        </p>
      </div>
    </div>
  );
};
