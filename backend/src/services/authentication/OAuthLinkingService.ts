/**
 * OAuth Linking Service
 *
 * Handles the business logic for OAuth account resolution:
 * - Linking a provider to an authenticated user's session
 * - Auto-linking by email match
 * - Creating new users from OAuth provider data
 * - Detecting duplicate provider links
 *
 * Returns result objects instead of sending HTTP responses directly,
 * keeping business logic free from Express request/response concerns.
 */

import crypto from 'node:crypto';

import { User } from '../../models/User';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { UserService } from '../user/UserService';

import { AuthenticationService } from './AuthenticationService';

/**
 * Input options for resolving or creating an OAuth user.
 */
export interface OAuthUserResolutionOpts {
  /** User ID embedded in OAuth state for account linking (survives cross-site redirect) */
  linkUserId?: string;
  /** Access token from cookies/headers for session-based linking fallback */
  accessToken?: string;
  /** OAuth provider name (e.g. 'Discord', 'Google', 'Twitch') */
  providerName: string;
  /** Provider-specific user ID */
  providerId: string;
  /** Entity field name for the provider ID (e.g. 'discordId', 'googleId', 'twitchId') */
  providerIdField: string;
  /** Email from the provider (may be undefined) */
  email: string | undefined;
  /** Username from the provider */
  username: string;
  /** Display name from the provider */
  displayName: string;
  /** Avatar URL from the provider */
  avatar?: string;
  /** IP address of the request */
  ipAddress?: string;
  /** Function to look up an existing user by this provider's ID */
  lookupByProviderId: () => Promise<User | null>;
}

/**
 * Discriminated union result for OAuth user resolution.
 * The controller maps each tag to the appropriate HTTP response.
 */
export type OAuthLinkResult =
  | { tag: 'linked'; user: User }
  | { tag: 'created'; user: User }
  | { tag: 'duplicate_provider'; providerId: string; targetUserId: string };

/**
 * Service that handles OAuth account linking and user creation logic.
 * Pure business logic — no Express req/res dependency.
 */
export class OAuthLinkingService {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthenticationService
  ) {}

  /**
   * Attempt to resolve an authenticated user for account linking.
   *
   * Priority:
   * 1. State-embedded userId (survives cross-site redirect)
   * 2. Cookie/header-based access token (may be stripped by browser)
   *
   * @returns The resolved User or null if no valid session exists
   */
  async resolveExistingSessionUser(
    linkUserId?: string,
    accessToken?: string
  ): Promise<User | null> {
    if (linkUserId) {
      const user = await this.userService.getUserById(linkUserId);
      if (user) {
        logger.debug('Resolved linking user from OAuth state', { linkUserId });
        return user;
      }
    }

    if (accessToken) {
      try {
        const decoded = await this.authService.validateAccessToken(accessToken);
        if (decoded?.id) {
          return await this.userService.getUserById(decoded.id);
        }
      } catch {
        // Token invalid/expired — not authenticated
      }
    }

    return null;
  }

  /**
   * Resolve or create an OAuth user.
   *
   * Handles four scenarios:
   * 1. **Session linking** — authenticated user links this provider to their account
   * 2. **Duplicate provider** — provider ID is already linked to a different user (reject)
   * 3. **Email auto-link** — email matches an existing user, link provider to them
   * 4. **New user** — create a new account from the provider data
   *
   * @returns OAuthLinkResult — the controller maps each tag to HTTP response
   */
  async resolveOrCreateOAuthUser(opts: OAuthUserResolutionOpts): Promise<OAuthLinkResult> {
    const existingSessionUser = await this.resolveExistingSessionUser(
      opts.linkUserId,
      opts.accessToken
    );

    if (existingSessionUser) {
      // Check if this provider ID is already linked to a different user
      const existingByProvider = await opts.lookupByProviderId();
      if (existingByProvider && existingByProvider.id !== existingSessionUser.id) {
        logger.warn(`${opts.providerName} account already linked to another user`, {
          providerId: opts.providerId,
          targetUser: existingSessionUser.id,
        });
        return {
          tag: 'duplicate_provider',
          providerId: opts.providerId,
          targetUserId: existingSessionUser.id,
        };
      }

      // Link provider to existing user
      await this.userService.updateUser(existingSessionUser.id, {
        [opts.providerIdField]: opts.providerId,
        lastLoginAt: new Date(),
        lastLoginIp: opts.ipAddress,
      });
      logger.info(
        `Linked ${opts.providerName} account to authenticated user: ${existingSessionUser.id}`
      );
      logAuditEvent({
        eventType: AuditEventType.AUTH_SUCCESS,
        userId: existingSessionUser.id,
        resource: 'auth.oauth',
        action: 'link_provider',
        message: `${opts.providerName} account linked to user ${existingSessionUser.id}`,
        metadata: { provider: opts.providerName, providerId: opts.providerId },
      });
      return { tag: 'linked', user: existingSessionUser };
    }

    // Not authenticated — check email match for auto-linking
    const existingByEmail = opts.email ? await this.userService.getUserByEmail(opts.email) : null;

    if (existingByEmail) {
      await this.userService.updateUser(existingByEmail.id, {
        [opts.providerIdField]: opts.providerId,
        lastLoginAt: new Date(),
        lastLoginIp: opts.ipAddress,
      });
      logger.info(
        `Linked ${opts.providerName} account to existing user by email: ${existingByEmail.id}`
      );
      return { tag: 'linked', user: existingByEmail };
    }

    // Create new user
    const user = await this.userService.createUser({
      id: crypto.randomUUID(),
      discordId: `${opts.providerName.toLowerCase()}:${opts.providerId}`,
      [opts.providerIdField]: opts.providerId,
      username: opts.username,
      email: opts.email ?? `${opts.providerId}@noemail.${opts.providerName.toLowerCase()}.local`,
      displayName: opts.displayName,
      avatar: opts.avatar,
      role: 'user',
      lastLoginAt: new Date(),
    });
    logger.info(`New user created via ${opts.providerName} OAuth: ${user.id}`);
    logAuditEvent({
      eventType: AuditEventType.AUTH_SUCCESS,
      userId: user.id,
      resource: 'auth.oauth',
      action: 'create_user',
      message: `New user ${user.id} created via ${opts.providerName} OAuth`,
      metadata: { provider: opts.providerName, providerId: opts.providerId },
    });
    return { tag: 'created', user };
  }
}
