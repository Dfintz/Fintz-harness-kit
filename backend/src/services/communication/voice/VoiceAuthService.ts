/**
 * VoiceAuthService — Generates and validates voice authentication tokens.
 *
 * Allows platform users to authenticate with the Mumble server using
 * short-lived HMAC-SHA256 tokens instead of passwords.
 *
 * Flow:
 * 1. User clicks "Join Server" on the web UI
 * 2. Frontend calls POST /api/v2/voice-server/auth/token
 * 3. Backend generates a 24h voice token (HMAC of userId + timestamp)
 * 4. Token included in mumble:// URL as password parameter
 * 5. Mumble ICE authenticator calls POST /api/v2/voice-server/auth/validate
 * 6. Backend validates token → returns user info + org groups for ACL
 */

import crypto from 'crypto';

import { AppDataSource } from '../../../data-source';
import { Organization } from '../../../models/Organization';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { ValidationError } from '../../../utils/apiErrors';
import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';

const TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const TOKEN_CACHE_PREFIX = 'voice:auth:';

/**
 * Default server scope used when callers do not specify one. Preserves
 * backwards compatibility with the legacy single-server (platform Mumble)
 * deployment. Per-server callers (org or federation owned servers) should
 * pass an explicit scope like `org:<orgId>` or `fed:<federationId>` so that
 * tokens can be enumerated and revoked per server.
 */
const DEFAULT_SERVER_SCOPE = 'platform';

interface VoiceAuthToken {
  token: string;
  expiresAt: string;
  connectUrl: string;
  username: string;
}

interface VoiceAuthValidation {
  valid: boolean;
  userId?: string;
  username?: string;
  organizationId?: string;
  organizationName?: string;
  role?: string;
  groups?: string[]; // Mumble ACL groups
}

export class VoiceAuthService {
  private static instance: VoiceAuthService;

  private readonly membershipRepo = AppDataSource.getRepository(OrganizationMembership);
  private readonly orgRepo = AppDataSource.getRepository(Organization);

  private constructor() {
    logger.info('VoiceAuthService initialized');
  }

  public static getInstance(): VoiceAuthService {
    if (!VoiceAuthService.instance) {
      VoiceAuthService.instance = new VoiceAuthService();
    }
    return VoiceAuthService.instance;
  }

  /**
   * Generate a voice authentication token for a user.
   * The token is stored in Redis and included in the mumble:// URL.
   *
   * @param serverScope Identifies the voice server this token authorises
   *   (e.g. `org:<orgId>`, `fed:<fedId>`, or `platform` for the legacy
   *   single-server path). Stored in the token payload so per-server
   *   revocation is possible without scanning every token.
   */
  async generateToken(
    userId: string,
    username: string,
    connectUrl: string,
    serverScope: string = DEFAULT_SERVER_SCOPE
  ): Promise<VoiceAuthToken> {
    const secret = this.getTokenSecret();
    const timestamp = Date.now();
    const payload = `${userId}:${timestamp}:${serverScope}`;
    const token = crypto.createHmac('sha256', secret).update(payload).digest('hex'); // Full 64-char hex (256-bit security)

    const expiresAt = new Date(timestamp + TOKEN_TTL_SECONDS * 1000).toISOString();

    // Store in Redis for validation
    await cache.set(
      `${TOKEN_CACHE_PREFIX}${token}`,
      { userId, username, timestamp, serverScope },
      TOKEN_TTL_SECONDS
    );

    // Build connect URL with token as password
    const url = new URL(connectUrl);
    // mumble://user:password@host:port/
    const authenticatedUrl = `mumble://${encodeURIComponent(username)}:${token}@${url.hostname}:${url.port || '64738'}/`;

    return {
      token,
      expiresAt,
      connectUrl: authenticatedUrl,
      username,
    };
  }

  /**
   * Validate a voice auth token (called by ICE authenticator on Mumble VM).
   * Returns user info + Mumble ACL groups based on org role.
   */
  async validateToken(token: string, mumbleUsername: string): Promise<VoiceAuthValidation> {
    const cached = await cache.get<{
      userId: string;
      username: string;
      timestamp: number;
    }>(`${TOKEN_CACHE_PREFIX}${token}`);

    if (!cached) {
      return { valid: false };
    }

    // Verify username matches
    if (cached.username !== mumbleUsername) {
      logger.warn('Voice auth token username mismatch', {
        expected: cached.username,
        got: mumbleUsername,
      });
      return { valid: false };
    }

    // Get user's org membership for ACL groups
    const membership = await this.membershipRepo.findOne({
      where: { userId: cached.userId, isActive: true },
      relations: ['role'],
    });

    if (!membership) {
      return {
        valid: true,
        userId: cached.userId,
        username: cached.username,
        groups: ['authenticated'],
      };
    }

    const org = await this.orgRepo.findOne({
      where: { id: membership.organizationId },
      select: ['id', 'name'],
    });

    // Map org role to Mumble ACL groups
    const groups = this.mapRoleToGroups(membership.role?.name ?? 'member');

    return {
      valid: true,
      userId: cached.userId,
      username: cached.username,
      organizationId: membership.organizationId,
      organizationName: org?.name,
      role: membership.role?.name,
      groups,
    };
  }

  /**
   * Revoke a voice auth token (e.g., on logout or moderation action).
   */
  async revokeToken(token: string): Promise<void> {
    await cache.del(`${TOKEN_CACHE_PREFIX}${token}`);
  }

  /**
   * Revoke all voice tokens for a user (e.g., on membership removal or ban).
   * Scans Redis for tokens belonging to the user and deletes them.
   *
   * When `serverScope` is provided, only tokens issued for that voice server
   * are revoked (e.g. removing a user from one org should not invalidate
   * tokens they hold for unrelated servers).
   */
  async revokeUserTokens(userId: string, serverScope?: string): Promise<number> {
    const keys = await cache.keys(`${TOKEN_CACHE_PREFIX}*`);
    let revoked = 0;
    for (const key of keys) {
      const data = await cache.get<{ userId: string; serverScope?: string }>(key);
      if (data?.userId !== userId) {
        continue;
      }
      if (serverScope && (data.serverScope ?? DEFAULT_SERVER_SCOPE) !== serverScope) {
        continue;
      }
      await cache.del(key);
      revoked++;
    }
    if (revoked > 0) {
      logger.info('Revoked voice auth tokens for user', { userId, serverScope, count: revoked });
    }
    return revoked;
  }

  /**
   * Revoke every voice token issued for a specific voice server (e.g. on
   * server config deletion or rotation of server secrets).
   */
  async revokeServerTokens(serverScope: string): Promise<number> {
    const keys = await cache.keys(`${TOKEN_CACHE_PREFIX}*`);
    let revoked = 0;
    for (const key of keys) {
      const data = await cache.get<{ serverScope?: string }>(key);
      if ((data?.serverScope ?? DEFAULT_SERVER_SCOPE) !== serverScope) {
        continue;
      }
      await cache.del(key);
      revoked++;
    }
    if (revoked > 0) {
      logger.info('Revoked voice auth tokens for server', { serverScope, count: revoked });
    }
    return revoked;
  }

  /**
   * Map an org role name to Mumble ACL groups.
   * These groups control channel permissions on the Mumble server.
   */
  private mapRoleToGroups(roleName: string): string[] {
    const groups = ['authenticated'];

    switch (roleName.toLowerCase()) {
      case 'owner':
      case 'founder':
        groups.push('admin', 'officer', 'member');
        break;
      case 'admin':
        groups.push('admin', 'officer', 'member');
        break;
      case 'officer':
      case 'fleet_commander':
        groups.push('officer', 'member');
        break;
      case 'member':
      default:
        groups.push('member');
        break;
    }

    return groups;
  }

  private getTokenSecret(): string {
    const secret = process.env.VOICE_AUTH_TOKEN_SECRET;
    if (!secret) {
      throw new ValidationError(
        'VOICE_AUTH_TOKEN_SECRET must be configured. Generate with: openssl rand -hex 32'
      );
    }
    return secret;
  }
}

