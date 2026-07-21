import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Twitch OAuth Token Response
 */
export interface TwitchTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string[];
}

/**
 * Twitch User Info (from Helix /users endpoint)
 */
export interface TwitchUserInfo {
  id: string;
  login: string;
  display_name: string;
  email?: string;
  profile_image_url?: string;
  type: string;
  broadcaster_type: string;
}

/**
 * Twitch Helix API response wrapper
 */
interface TwitchHelixResponse<T> {
  data: T[];
}

import { getBackendUrl } from '../../config/urls';

/**
 * Twitch OAuth Service
 *
 * Implements the OAuth 2.0 Authorization Code flow for Twitch.
 * Follows the same pattern as DiscordService: generateAuthUrl → authenticateUser → getUserInfo.
 *
 * Note: Twitch Helix API requires `Client-Id` header in addition to `Authorization`.
 */
export class TwitchOAuthService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor() {
    this.clientId = process.env.TWITCH_CLIENT_ID || '';
    this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
    this.redirectUri =
      process.env.TWITCH_REDIRECT_URI_BACKEND || `${getBackendUrl()}/api/v2/auth/twitch/callback`;
  }

  /**
   * Whether the service has required configuration.
   */
  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  /**
   * Generate the Twitch OAuth authorization URL.
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
      scope: 'user:read:email',
      state,
      force_verify: 'true',
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token.
   * @param code - Authorization code from Twitch
   * @param redirectUri - Optional override (must match the one used in authorization URL)
   */
  public async authenticateUser(code: string, redirectUri?: string): Promise<TwitchTokenResponse> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    const effectiveRedirectUri = redirectUri || this.redirectUri;
    logger.debug('Twitch OAuth token exchange starting', { redirectUri: effectiveRedirectUri });

    try {
      const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
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

        const errorDescription = errorData.message || errorData.error || tokenResponse.statusText;

        logger.error('Twitch authentication failed', {
          status: tokenResponse.status,
          error: errorData.error,
          errorDescription,
        });

        throw new Error(
          `Twitch authentication failed: ${tokenResponse.status} - ${errorDescription}`
        );
      }

      return (await tokenResponse.json()) as TwitchTokenResponse;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.startsWith('Twitch authentication failed')) {
        throw error;
      }
      logger.error('Twitch authentication error:', error);
      throw new Error(`Failed to authenticate user via Twitch: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Fetch user information from Twitch Helix API.
   * Twitch requires the `Client-Id` header alongside the Bearer token.
   *
   * @param accessToken - Twitch access token
   */
  public async getUserInfo(accessToken: string): Promise<TwitchUserInfo> {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': this.clientId,
        },
      });

      if (!userResponse.ok) {
        const errorData = (await userResponse.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          `Failed to fetch Twitch user info: ${userResponse.status} - ${
            errorData.message || userResponse.statusText
          }`
        );
      }

      const body = (await userResponse.json()) as TwitchHelixResponse<TwitchUserInfo>;
      if (!body.data || body.data.length === 0) {
        throw new Error('Twitch API returned empty user data');
      }

      return body.data[0];
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message.startsWith('Failed to fetch Twitch user info') ||
          error.message.startsWith('Twitch API returned empty'))
      ) {
        throw error;
      }
      logger.error('Failed to fetch Twitch user info:', error);
      throw new Error(`Failed to fetch Twitch user info: ${getErrorMessage(error)}`);
    }
  }
}

/** Singleton instance */
let twitchOAuthServiceInstance: TwitchOAuthService | null = null;

export function getTwitchOAuthService(): TwitchOAuthService {
  twitchOAuthServiceInstance ??= new TwitchOAuthService();
  return twitchOAuthServiceInstance;
}

export function isTwitchOAuthConfigured(): boolean {
  return getTwitchOAuthService().isConfigured();
}

