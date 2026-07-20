import { PrivacyPolicy } from '@/components/legal/PrivacyPolicy';
import { TermsOfService } from '@/components/legal/TermsOfService';
import { Modal } from '@/components/ui/Modal';
import { getBackendUrl } from '@/config/env';
import { useBackendHealth } from '@/hooks/useBackendHealth';
import { apiClient, isApiClientError } from '@/services/apiClient';
import { webAuthnService } from '@/services/webAuthnService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { GOOGLE_BLUE, GOOGLE_GREEN, GOOGLE_RED, GOOGLE_YELLOW } from '@/utils/brandColors';
import { getAuthErrorMessage } from '@/utils/errorHandling';
import { logger } from '@/utils/logger';
import { sanitizeInternalPath } from '@/utils/urlSafety';
import {
  MilitaryTech as MilitaryTechIcon,
  Person as PersonIcon,
  RocketLaunch as RocketLaunchIcon,
  Shield as ShieldIcon,
  Star as StarIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Button } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Login.css';

// Augment React types for the 'inert' HTML attribute (not yet in @types/react@18)
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    inert?: string;
  }
}

const BACKEND_URL = getBackendUrl();

// Instructions for starting the backend server
const BACKEND_STARTUP_INSTRUCTIONS = `
1. Open a terminal
2. Navigate to backend directory: cd backend
3. Start the server: npm start
`;

/**
 * Dev login personas — different roles for testing.
 * Each maps to a seeded user (by username) or creates a fresh user.
 */
interface DevPersona {
  label: string;
  description: string;
  username: string;
  role: 'admin' | 'user' | 'moderator';
  icon: React.ReactNode;
}

const DEV_PERSONAS: DevPersona[] = [
  {
    label: 'New User',
    description: 'Fresh account — no org, no ships, no history',
    username: 'dev-newuser',
    role: 'user',
    icon: <PersonIcon />,
  },
  {
    label: 'Org Member',
    description: 'Star Cadet — member of Stardust Fleet, Deep Core & Crimson Syndicate',
    username: 'star_cadet',
    role: 'user',
    icon: <RocketLaunchIcon />,
  },
  {
    label: 'Multi-Org Officer',
    description: 'Stellarpath — officer in Stardust Fleet & Ghost Division',
    username: 'stellarpath',
    role: 'user',
    icon: <MilitaryTechIcon />,
  },
  {
    label: 'Org Owner / Fed Founder',
    description: 'Admiral Chen — owner of Stardust Fleet, founder of Stanton Corridor Alliance',
    username: 'admiral_chen',
    role: 'user',
    icon: <StarIcon />,
  },
  {
    label: 'Multi-Role Operator',
    description: 'Ghost Runner — Crimson Syndicate owner, Quantum Trade officer, Ironwolf member',
    username: 'ghost_runner',
    role: 'user',
    icon: <VisibilityIcon />,
  },
  {
    label: 'Platform Admin',
    description: 'Cmdr Nova — platform admin, Stardust admin + Ironwolf officer',
    username: 'cmdr_nova',
    role: 'admin',
    icon: <ShieldIcon />,
  },
];

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { login, isAuthenticated, loading, error, setLoading, setError } = useAuthStore();
  const notification = useNotification();
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const { check: checkBackendHealth, isChecking: isCheckingHealth } = useBackendHealth();
  const _isE2ERun = import.meta.env.MODE === 'e2e' || import.meta.env.VITE_E2E === 'true';
  // Only show dev login in development mode — production builds via Vite set MODE to 'production'
  const showDemoLogin = import.meta.env.DEV;
  const showSandboxLogin = import.meta.env.VITE_ENABLE_SANDBOX_LOGIN === 'true';

  // Handle session expiration and timeout messages
  useEffect(() => {
    const reason = searchParams.get('reason');

    if (reason === 'session-expired') {
      notification.error('Your session has expired. Please log in again.', 'Session Expired');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    } else if (reason === 'timeout') {
      notification.error('Your request timed out. Please log in again.', 'Request Timeout');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, notification]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Check if there's a redirect path stored
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && redirectPath !== '/login') {
        sessionStorage.removeItem('redirectAfterLogin');
        // CWE-601 mitigation: sanitizeInternalPath rejects external URLs, protocol
        // schemes (javascript:, data:, http(s)://), protocol-relative "//" paths,
        // and backslash traversal.  Only same-origin, slash-prefixed paths pass.
        const safePath = sanitizeInternalPath(redirectPath, '/dashboard');

        // Double-check: the path MUST start with exactly one "/" and no "//".
        // This inline guard lets static analysers verify the open-redirect is closed.
        if (safePath.startsWith('/') && !safePath.startsWith('//')) {
          navigate(safePath);
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, navigate]);

  // Handle OAuth callback from backend redirect
  const oauthHandled = React.useRef(false);
  useEffect(() => {
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');

    // Handle successful authentication (guard against re-entry)
    if (successParam === 'true' && !oauthHandled.current) {
      oauthHandled.current = true;
      setLoading(true);

      // Clean up URL immediately to prevent re-trigger
      setSearchParams({});

      // Use tryAuthWithCookies to validate the session
      useAuthStore
        .getState()
        .tryAuthWithCookies()
        .then(authSuccess => {
          if (!authSuccess) {
            throw new Error('Failed to establish session after authentication');
          }
          notification.success('Login successful!', 'Welcome, Commander!');
          navigate('/dashboard');
        })
        .catch(err => {
          const errorMessage = getAuthErrorMessage(err, 'Discord');
          setTimeout(() => {
            setError({ message: errorMessage });
            notification.error(errorMessage, 'Authentication Error');
          }, 0);
        })
        .finally(() => {
          setLoading(false);
          oauthHandled.current = false;
        });

      return;
    }

    // Handle authentication errors
    if (errorParam) {
      let errorMessage = 'Authentication failed';

      switch (errorParam) {
        case 'discord_not_configured':
          errorMessage = 'Discord OAuth is not configured on the server';
          break;
        case 'google_not_configured':
          errorMessage = 'Google OAuth is not configured on the server';
          break;
        case 'twitch_not_configured':
          errorMessage = 'Twitch OAuth is not configured on the server';
          break;
        case 'invalid_state':
          errorMessage = 'Invalid OAuth state - possible CSRF attack';
          break;
        case 'no_code':
          errorMessage = 'No authorization code received';
          break;
        case 'auth_failed':
          errorMessage = 'Authentication failed';
          break;
        case 'server_config':
          errorMessage = 'Server configuration error';
          break;
        default:
          errorMessage = `Authentication failed: ${errorParam}`;
      }

      // Defer state update to avoid React error #185
      setTimeout(() => {
        setError({ message: errorMessage });
        notification.error(errorMessage, 'Authentication Error');
      }, 0);

      // Clean up URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, navigate, notification, setError, setLoading, login]);

  /**
   * Initiate Discord OAuth flow - redirect to backend which handles OAuth
   * First checks if backend is available before redirecting
   */
  const handleDiscordLogin = async () => {
    // Check backend health before initiating OAuth
    const healthResult = await checkBackendHealth();

    if (!healthResult.isHealthy) {
      const errorMessage = healthResult.error || 'Backend server is not available';
      const detailedMessage =
        `Cannot connect to backend server at ${healthResult.backendUrl}. ` +
        `Please ensure the backend is running:${BACKEND_STARTUP_INSTRUCTIONS}` +
        `Error: ${errorMessage}`;

      notification.error(detailedMessage, 'Backend Server Not Available');

      setError({ message: 'Backend server is not available. Please start the backend server.' });
      return;
    }

    // Backend is healthy, proceed with OAuth flow
    // Simply redirect to the backend OAuth endpoint
    // Backend will handle state generation, Discord redirect, callback, and redirect back to frontend
    globalThis.location.href = `${BACKEND_URL}/api/v2/auth/discord`;
  };

  /**
   * Initiate Google OAuth flow
   */
  const handleGoogleLogin = async () => {
    const healthResult = await checkBackendHealth();
    if (!healthResult.isHealthy) {
      notification.error('Backend server is not available', 'Backend Server Not Available');
      setError({ message: 'Backend server is not available. Please start the backend server.' });
      return;
    }
    globalThis.location.href = `${BACKEND_URL}/api/v2/auth/google`;
  };

  /**
   * Initiate Twitch OAuth flow
   */
  const handleTwitchLogin = async () => {
    const healthResult = await checkBackendHealth();
    if (!healthResult.isHealthy) {
      notification.error('Backend server is not available', 'Backend Server Not Available');
      setError({ message: 'Backend server is not available. Please start the backend server.' });
      return;
    }
    globalThis.location.href = `${BACKEND_URL}/api/v2/auth/twitch`;
  };

  /**
   * Authenticate with a registered passkey (WebAuthn/FIDO2)
   */
  const handlePasskeyLogin = async () => {
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

      logger.debug('[Passkey Login] Authentication successful', {
        hasUser: !!result.user,
        hasToken: !!result.token,
      });

      // The backend sets httpOnly cookies — establish session via cookie auth
      const authSuccess = await useAuthStore.getState().tryAuthWithCookies();

      if (!authSuccess) {
        throw new Error('Failed to establish session after passkey login');
      }

      notification.success(`Welcome back, ${result.user.username}!`, 'Passkey Login Successful');
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = webAuthnService.getErrorMessage(err);
      if (message !== 'Authentication cancelled or not allowed') {
        setError({ message });
        notification.error(message, 'Passkey Login Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle production-safe sandbox login.
   */
  const handleSandboxLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const healthResult = await checkBackendHealth();

      if (!healthResult.isHealthy) {
        notification.error('Backend server is not available', 'Backend Server Not Available');
        setError({ message: 'Backend server is not available. Please start the backend server.' });
        return;
      }

      await apiClient.postRaw<Record<string, unknown>>('/api/v2/auth/sandbox', {});

      const authSuccess = await useAuthStore.getState().tryAuthWithCookies();
      if (!authSuccess) {
        throw new Error('Failed to establish session after sandbox login');
      }

      notification.success('Sandbox session started', 'Welcome to the trial environment');
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        isApiClientError(err) &&
        (err.statusCode === 403 || err.statusCode === 404 || err.statusCode === 405)
          ? 'Sandbox login is currently unavailable.'
          : err instanceof Error
            ? err.message
            : 'Sandbox login failed';
      setError({ message });
      notification.error(message, 'Login Error');
    } finally {
      setLoading(false);
    }
  };

  /** Translate a demo-endpoint failure into an Error and indicate whether to try the next URL. */
  const interpretDemoError = (err: unknown): { error: Error; tryNext: boolean } => {
    if (isApiClientError(err)) {
      const details = err.details as { message?: string; error?: string } | undefined;
      const error = new Error(
        details?.message ||
          details?.error ||
          err.message ||
          `Demo login failed with status ${err.statusCode}`
      );
      // Only fall back to the next endpoint on 404/405 (route missing)
      return { error, tryNext: err.statusCode === 404 || err.statusCode === 405 };
    }
    return {
      error: err instanceof Error ? err : new Error(String(err)),
      tryNext: true,
    };
  };

  /** Try multiple demo login endpoints with fallback. Returns parsed response body. */
  const tryDemoEndpoints = async (persona: DevPersona): Promise<Record<string, unknown>> => {
    const demoEndpoints = ['/api/v2/auth/demo', '/api/auth/demo'];
    let lastError: Error | null = null;

    for (const demoUrl of demoEndpoints) {
      logger.debug('[Demo Login] Calling demo endpoint', {
        url: demoUrl,
        persona: persona.label,
      });
      try {
        const data = await apiClient.postRaw<Record<string, unknown>>(demoUrl, {
          username: persona.username,
          role: persona.role,
        });
        return data ?? {};
      } catch (err) {
        const { error, tryNext } = interpretDemoError(err);
        lastError = error;
        if (!tryNext) break;
      }
    }

    throw lastError || new Error('Demo login failed');
  };

  /**
   * Handle demo/development login with a specific persona
   * Backend controls access via ALLOW_DEV_LOGIN environment variable
   */
  const handleDemoLogin = async (persona: DevPersona) => {
    setLoading(true);
    setError(null);
    setShowPersonaSelector(false);
    try {
      // Check backend health before making request
      const healthResult = await checkBackendHealth();

      if (!healthResult.isHealthy) {
        const errorMessage = healthResult.error || 'Backend server is not available';
        const detailedMessage =
          `Cannot connect to backend server at ${healthResult.backendUrl}. ` +
          `Please ensure the backend is running:${BACKEND_STARTUP_INSTRUCTIONS}` +
          `Error: ${errorMessage}`;

        notification.error(detailedMessage, 'Backend Server Not Available');
        setError({ message: 'Backend server is not available. Please start the backend server.' });
        setLoading(false);
        return;
      }

      const data = await tryDemoEndpoints(persona);
      logger.debug('[Demo Login] Received authentication data', {
        hasUser: !!data.user,
        hasToken: !!data.token,
      });

      // The backend sets httpOnly cookies for authentication
      // Use tryAuthWithCookies to validate with cookies already set
      logger.debug('[Demo Login] Attempting to establish session with cookies');
      const authSuccess = await useAuthStore.getState().tryAuthWithCookies();

      logger.debug('[Demo Login] Session establishment result', { success: authSuccess });

      if (!authSuccess) {
        throw new Error('Failed to establish session after demo login');
      }

      notification.success(`Logged in as ${persona.label}`, `Welcome, ${persona.username}!`);
      navigate(persona.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      let errorMessage = 'Demo login failed';
      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('405')) {
        errorMessage =
          'Dev login endpoint not found. Backend may not have ALLOW_DEV_LOGIN enabled.';
      } else if (message.includes('403')) {
        errorMessage =
          'Dev login is disabled. Enable it by setting ALLOW_DEV_LOGIN=true in backend environment.';
      } else {
        errorMessage = message || 'Demo login failed';
      }

      setError({ message: errorMessage });
      notification.error(errorMessage, 'Login Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div
        className={`login-card ${showTermsModal || showPrivacyModal ? 'login-card--inert' : ''}`}
        inert={showTermsModal || showPrivacyModal ? 'true' : undefined}
      >
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
          <h1 className="login-title">Fringe Core</h1>
          <p className="login-tagline">One Core, Infinite Possibilities</p>
        </div>

        <p className="login-subtitle">
          Command nucleus for organizations pushing boundaries at the frontier of the verse. One
          core. Infinite frontiers.
        </p>

        {error && (
          <div className="login-error" role="alert" aria-live="assertive">
            {error.message}
          </div>
        )}

        <button
          id="discord-login"
          onClick={handleDiscordLogin}
          disabled={loading || isCheckingHealth}
          className="login-discord-button"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 71 55"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1099 30.1693C30.1099 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.7018 30.1693C53.7018 34.1136 50.9 37.3253 47.3178 37.3253Z"
              fill="white"
            />
          </svg>
          {loading || isCheckingHealth ? 'Authenticating...' : 'Continue with Discord'}
        </button>

        <button
          id="google-login"
          onClick={handleGoogleLogin}
          disabled={loading || isCheckingHealth}
          className="login-google-button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill={GOOGLE_BLUE}
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill={GOOGLE_GREEN}
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill={GOOGLE_YELLOW}
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill={GOOGLE_RED}
            />
          </svg>
          {loading || isCheckingHealth ? 'Authenticating...' : 'Continue with Google'}
        </button>

        <button
          id="twitch-login"
          onClick={handleTwitchLogin}
          disabled={loading || isCheckingHealth}
          className="login-twitch-button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"
              fill="white"
            />
          </svg>
          {loading || isCheckingHealth ? 'Authenticating...' : 'Continue with Twitch'}
        </button>

        <div className="login-passkey-divider">
          <span className="login-passkey-divider-line" />
          <span className="login-passkey-divider-text">or</span>
          <span className="login-passkey-divider-line" />
        </div>

        <button
          id="passkey-login"
          onClick={handlePasskeyLogin}
          disabled={loading || isCheckingHealth}
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
          {loading || isCheckingHealth ? 'Authenticating...' : 'Sign in with Passkey'}
        </button>

        {showSandboxLogin && (
          <button
            id="sandbox-login"
            onClick={handleSandboxLogin}
            disabled={loading || isCheckingHealth}
            className="login-sandbox-button"
          >
            {loading || isCheckingHealth ? 'Starting Sandbox...' : 'Try Sandbox Mode'}
          </button>
        )}

        {showDemoLogin && (
          <div className="login-dev-divider">
            <p className="login-dev-label">Development Mode</p>
            {showPersonaSelector ? (
              <div className="login-persona-grid">
                {DEV_PERSONAS.map(persona => (
                  <button
                    key={`${persona.username}-${persona.role}`}
                    onClick={() => handleDemoLogin(persona)}
                    disabled={loading}
                    className="login-persona-button"
                    title={persona.description}
                  >
                    <span className="login-persona-icon">{persona.icon}</span>
                    <span className="login-persona-label">{persona.label}</span>
                    <span className="login-persona-desc">{persona.description}</span>
                  </button>
                ))}
                <button
                  onClick={() => setShowPersonaSelector(false)}
                  className="login-persona-cancel"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                id="demo-login"
                onClick={() => setShowPersonaSelector(true)}
                disabled={loading}
                className="login-demo-button"
              >
                Dev Login — Select Persona
              </button>
            )}
          </div>
        )}

        <div className="login-navigation">
          <p className="login-navigation-label">Not ready to sign in?</p>
          <div className="login-navigation-buttons">
            <button onClick={() => navigate('/')} className="login-nav-button">
              Back to Home
            </button>
          </div>
        </div>

        <p className="login-terms">
          By logging in, you agree to our{' '}
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              setShowTermsModal(true);
            }}
            className="login-terms-link"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              setShowPrivacyModal(true);
            }}
            className="login-terms-link"
          >
            Privacy Policy
          </a>
        </p>

        {/* Terms of Service Modal */}
        <Modal
          isOpen={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          size="lg"
          footer={
            <Button variant="contained" onClick={() => setShowTermsModal(false)}>
              Close
            </Button>
          }
        >
          <TermsOfService />
        </Modal>

        {/* Privacy Policy Modal */}
        <Modal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
          size="lg"
          footer={
            <Button variant="contained" onClick={() => setShowPrivacyModal(false)}>
              Close
            </Button>
          }
        >
          <PrivacyPolicy />
        </Modal>
      </div>
    </div>
  );
};
