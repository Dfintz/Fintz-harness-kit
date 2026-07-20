/**
 * Authentication Service for React Native
 *
 * Handles credential-based, SSO (Discord/Google/Twitch), and passkey authentication.
 * Returns tokens that are then passed to the authStore.
 */

import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from './apiClient';
import { BaseService } from './baseService';

interface LoginResponse {
  token: string;
  refreshToken: string;
}

interface RegisterResponse {
  token: string;
  refreshToken: string;
}

interface OAuthCallbackResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    role?: string;
  };
  message: string;
}

type SsoProvider = 'discord' | 'google' | 'twitch';

class AuthService extends BaseService {
  protected basePath = '/api/v2/auth';

  private get apiBaseUrl(): string {
    return Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
  }

  /**
   * Login with username/email and password.
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      this.log('login', { username });
      const response = await apiClient.postRaw<LoginResponse>(`${this.basePath}/login`, {
        username,
        password,
      });
      return response;
    } catch (error) {
      this.handleError(error, 'AuthService.login');
    }
  }

  /**
   * Register a new account.
   */
  async register(username: string, email: string, password: string): Promise<RegisterResponse> {
    try {
      this.log('register', { username, email });
      const response = await apiClient.postRaw<RegisterResponse>(`${this.basePath}/register`, {
        username,
        email,
        password,
      });
      return response;
    } catch (error) {
      this.handleError(error, 'AuthService.register');
    }
  }

  /**
   * Start SSO login flow via in-app browser.
   * Opens the OAuth provider page; the backend redirects back to the mobile app
   * via the custom scheme (scfleetmanager://auth/callback?token=...).
   */
  async loginWithSso(provider: SsoProvider): Promise<OAuthCallbackResponse | null> {
    try {
      this.log('loginWithSso', { provider });

      const redirectUri = Linking.createURL('auth/callback');
      const authUrl = `${this.apiBaseUrl}${this.basePath}/${provider}?mobile_redirect=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== 'success' || !result.url) {
        return null;
      }

      // Parse tokens from the callback URL
      const url = new URL(result.url);
      const token = url.searchParams.get('token');
      const refreshToken = url.searchParams.get('refreshToken');

      if (!token || !refreshToken) {
        const errorMsg = url.searchParams.get('error') || 'SSO authentication failed';
        throw new Error(errorMsg);
      }

      return {
        token,
        refreshToken,
        user: { id: '', username: '' }, // Will be fetched by authStore.login()
        message: `${provider} authentication successful`,
      };
    } catch (error) {
      this.handleError(error, `AuthService.loginWithSso(${provider})`);
    }
  }

  /**
   * Authenticate using a passkey (WebAuthn).
   * Step 1: Get authentication options (challenge) from the server
   * Step 2: Open a web-based passkey ceremony via the browser
   * Step 3: The backend verifies the assertion and returns tokens
   */
  async loginWithPasskey(): Promise<LoginResponse | null> {
    try {
      this.log('loginWithPasskey');

      const redirectUri = Linking.createURL('auth/callback');
      const passkeyUrl = `${this.apiBaseUrl}/api/v2/webauthn/mobile-authenticate?redirect_uri=${encodeURIComponent(redirectUri)}`;

      const result = await WebBrowser.openAuthSessionAsync(passkeyUrl, redirectUri);

      if (result.type !== 'success' || !result.url) {
        return null;
      }

      const url = new URL(result.url);
      const token = url.searchParams.get('token');
      const refreshToken = url.searchParams.get('refreshToken');

      if (!token || !refreshToken) {
        const errorMsg = url.searchParams.get('error') || 'Passkey authentication failed';
        throw new Error(errorMsg);
      }

      return { token, refreshToken };
    } catch (error) {
      this.handleError(error, 'AuthService.loginWithPasskey');
    }
  }
}

export const authService = new AuthService();
