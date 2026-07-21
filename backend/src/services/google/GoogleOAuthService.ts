import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Google OAuth Token Response
 */
export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

/**
 * Google User Info (from /oauth2/v2/userinfo)
 */
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

import { getBackendUrl } from '../../config/urls';

/**
 * Google OAuth Service
 *
 * Implements the OAuth 2.0 Authorization Code flow for Google.
 * Follows the same pattern as DiscordService: generateAuthUrl → authenticateUser → getUserInfo.
 */
export class GoogleOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || '';
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.GOOGLE_REDIRECT_URI_BACKEND || `${getBackendUrl()}/api/v2/auth/google/callback`;
  }

  /**
   * Whether the service has required configuration.
   */
  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Generate the Google OAuth authorization URL.
   * @param state - HMAC-signed CSRF state token
   */
  public generateAuthUrl(state: string): string {
    if (!state) {
      throw new Error('State parameter is required for CSRF protection');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   * @param code - Authorization code from Google
   * @param redirectUri - Optional override (must match the one used in authorization URL)
   */
  public async authenticateUser(code: string, redirectUri?: string): Promise<GoogleTokenResponse> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const effectiveRedirectUri = redirectUri || this.redirectUri;
    logger.debug('Google OAuth token exchange starting', { redirectUri: effectiveRedirectUri });

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: effectiveRedirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const raw = await tokenResponse.text();
        let errorData: Record<string, unknown> = {};
        try {
          errorData = raw ? JSON.parse(raw) : {};
        } catch {
          errorData = { rawError: raw };
        }

        const errorDescription =
          errorData.error_description || errorData.error || tokenResponse.statusText;

        logger.error('Google authentication failed', {
          status: tokenResponse.status,
          error: errorData.error,
          errorDescription,
        });

        throw new Error(
          `Google authentication failed: ${tokenResponse.status} - ${errorDescription}`
        );
      }

      return (await tokenResponse.json()) as GoogleTokenResponse;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Google authentication failed')) {
        throw error;
      }
      logger.error('Google authentication error:', error);
      throw new Error(`Failed to authenticate user via Google: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Fetch user information from Google's userinfo endpoint.
   * @param accessToken - Google access token
   */
  public async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userResponse.ok) {
        const errorData = (await userResponse.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          `Failed to fetch Google user info: ${userResponse.status} - ${
            errorData.message || userResponse.statusText
          }`
        );
      }

      return (await userResponse.json()) as GoogleUserInfo;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Failed to fetch Google user info')) {
        throw error;
      }
      logger.error('Failed to fetch Google user info:', error);
      throw new Error(`Failed to fetch Google user info: ${getErrorMessage(error)}`);
    }
  }
}

/** Singleton instance */
let googleOAuthServiceInstance: GoogleOAuthService | null = null;

export function getGoogleOAuthService(): GoogleOAuthService {
  googleOAuthServiceInstance ??= new GoogleOAuthService();
  return googleOAuthServiceInstance;
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthService().isConfigured();
}

