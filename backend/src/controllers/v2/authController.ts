/**
 * Auth Controller V2
 * Handles authentication endpoints with standardized v2 responses
 *
 * All methods are direct V2 implementations using shared services. No V1 delegation remains.
 */

import crypto from 'node:crypto';

import { Request, Response } from 'express';
import { Repository } from 'typeorm';

import {
  clearCookieOptions,
  clearCsrfCookieOptions,
  clearRefreshCookieOptions,
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  pkceCookieOptions,
  refreshTokenCookieOptions,
} from '../../config/cookies';
import { AppDataSource } from '../../config/database';
import { getFrontendUrl } from '../../config/urls';
import { AuthRequest } from '../../middleware/auth';
import { createSessionBinding } from '../../middleware/sessionBinding';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { AuthenticationService } from '../../services/authentication';
import { OAuthLinkingService } from '../../services/authentication/OAuthLinkingService';
import { TwoFactorService } from '../../services/authentication/TwoFactorService';
import {
  getDiscordService,
  isDiscordServiceInitialized,
} from '../../services/discord/DiscordService';
import {
  getGoogleOAuthService,
  isGoogleOAuthConfigured,
} from '../../services/google/GoogleOAuthService';
import { AccountSecurityService } from '../../services/security';
import { AccountAccessLogService } from '../../services/security/access/AccountAccessLogService';
import { getRoleService } from '../../services/security/core/RoleService';
import {
  getTwitchOAuthService,
  isTwitchOAuthConfigured,
} from '../../services/twitch/TwitchOAuthService';
import { UserAuthenticationService } from '../../services/user/UserAuthenticationService';
import { UserService } from '../../services/user/UserService';
import { ApiErrorCode } from '../../types/api';
import { ForbiddenError } from '../../utils/apiErrors';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { generateOAuthState, validateOAuthState } from '../../utils/oauthState';
import { generatePkcePair } from '../../utils/pkce';

/**
 * Azure AD OAuth response types
 */
interface AzureADTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface MicrosoftGraphCollectionResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

interface MicrosoftGraphDirectoryObject {
  id?: string;
}

interface MicrosoftGraphUser {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

const ALLOWED_AZURE_ADMIN_ROLES = new Set(['admin', 'superadmin', 'super_admin']);
const AZURE_GRAPH_MEMBER_OF_ENDPOINT =
  'https://graph.microsoft.com/v1.0/me/memberOf?$select=id&$top=999';
const AZURE_GRAPH_ALLOWED_ORIGIN = 'https://graph.microsoft.com';
const MAX_AZURE_GRAPH_GROUP_PAGES = 10;

function parseCommaSeparatedEnv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map(entry => entry.trim())
    .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadSegment = segments[1].replaceAll('-', '+').replaceAll('_', '/');
    const padded = payloadSegment.padEnd(
      payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4),
      '='
    );
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function resolveSafeGraphNextLink(rawNextLink: string | undefined): string | null {
  if (typeof rawNextLink !== 'string' || rawNextLink.trim().length === 0) {
    return null;
  }

  try {
    const parsed = new URL(rawNextLink);
    if (parsed.origin !== AZURE_GRAPH_ALLOWED_ORIGIN) {
      logger.warn('Ignoring Microsoft Graph nextLink with unexpected origin', {
        origin: parsed.origin,
      });
      return null;
    }

    if (!parsed.pathname.startsWith('/v1.0/me/memberOf')) {
      logger.warn('Ignoring Microsoft Graph nextLink with unexpected path', {
        pathname: parsed.pathname,
      });
      return null;
    }

    return parsed.toString();
  } catch {
    logger.warn('Ignoring malformed Microsoft Graph nextLink');
    return null;
  }
}

/**
 * Standard OAuth 2.0 error codes (RFC 6749 §4.1.2.1) plus common OIDC extensions.
 * Used to validate user-controlled error query parameters against XSS injection.
 */
const OAUTH_ERROR_ALLOWLIST = [
  'access_denied',
  'invalid_request',
  'unauthorized_client',
  'unsupported_response_type',
  'invalid_scope',
  'server_error',
  'temporarily_unavailable',
  'interaction_required',
  'login_required',
  'consent_required',
] as const;

/**
 * Allowlist of OAuth provider authorization endpoint origins.
 * Used by {@link safeOAuthRedirect} to defend against open-redirect
 * vulnerabilities by guaranteeing only known-safe destinations.
 */
const OAUTH_PROVIDER_ORIGINS = new Set<string>([
  'https://discord.com',
  'https://accounts.google.com',
  'https://id.twitch.tv',
]);

/**
 * Safely redirect to a provider-built OAuth authorization URL.
 * Validates the URL's origin against {@link OAUTH_PROVIDER_ORIGINS} before
 * issuing the redirect; on mismatch (or parse failure) sends the user back
 * to the local login page with an error code instead.
 */
function safeOAuthRedirect(res: Response, authUrl: string, errorCode: string): void {
  try {
    const parsed = new URL(authUrl);
    if (OAUTH_PROVIDER_ORIGINS.has(parsed.origin)) {
      res.redirect(parsed.toString());
      return;
    }
    logger.error('Refused OAuth redirect to non-allowlisted origin', { origin: parsed.origin });
  } catch (err: unknown) {
    logger.error('Refused OAuth redirect to malformed URL', { err: getErrorMessage(err) });
  }
  res.redirect(`${getFrontendUrl()}/login?error=${encodeURIComponent(errorCode)}`);
}

/**
 * Auth Controller V2
 *
 * All methods use direct service calls with V2 response format.
 */
export class AuthControllerV2 {
  private readonly authService: AuthenticationService;
  private readonly oauthLinkingService: OAuthLinkingService;
  private readonly twoFactorService: TwoFactorService;
  private readonly userService: UserService;
  private readonly userAuthService: UserAuthenticationService;
  private readonly securityService: AccountSecurityService;
  private readonly accessLogService: AccountAccessLogService;

  constructor() {
    this.authService = new AuthenticationService();
    this.twoFactorService = new TwoFactorService();
    this.userService = new UserService();
    this.userAuthService = new UserAuthenticationService();
    this.securityService = AccountSecurityService.getInstance();
    this.accessLogService = new AccountAccessLogService();
    this.oauthLinkingService = new OAuthLinkingService(this.userService, this.authService);
  }

  /**
   * Resolve and validate the Azure AD admin login configuration.
   * Returns a structured error (to be surfaced to the caller) or the validated
   * configuration. Extracted to keep azureADCallback's complexity manageable.
   */
  private resolveAzureAdminConfig():
    | { ok: false; message: string }
    | {
        ok: true;
        tenantId: string;
        clientId: string;
        clientSecret: string;
        configuredAdminGroups: string[];
      } {
    const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const configuredAdminGroups = parseCommaSeparatedEnv(process.env.AZURE_AD_ADMIN_GROUP_IDS);

    if (!clientId || !clientSecret) {
      return { ok: false, message: 'Azure AD not configured' };
    }

    if (tenantId === 'common') {
      return { ok: false, message: 'Azure AD tenant restriction is not configured' };
    }

    if (configuredAdminGroups.length === 0) {
      return { ok: false, message: 'Azure AD admin group restriction is not configured' };
    }

    return { ok: true, tenantId, clientId, clientSecret, configuredAdminGroups };
  }

  private async fetchAzureAdminGroupIds(accessToken: string): Promise<Set<string>> {
    const groupIds = new Set<string>();
    let nextPageUrl: string | null = AZURE_GRAPH_MEMBER_OF_ENDPOINT;
    let pageCount = 0;

    while (nextPageUrl && pageCount < MAX_AZURE_GRAPH_GROUP_PAGES) {
      const response = await fetch(nextPageUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Azure AD group membership');
      }

      const payload =
        (await response.json()) as MicrosoftGraphCollectionResponse<MicrosoftGraphDirectoryObject>;
      for (const entry of payload.value ?? []) {
        if (typeof entry?.id === 'string' && entry.id.length > 0) {
          groupIds.add(entry.id);
        }
      }

      pageCount += 1;
      nextPageUrl = resolveSafeGraphNextLink(payload['@odata.nextLink']);
    }

    if (nextPageUrl) {
      logger.warn('Truncated Microsoft Graph group membership pagination', {
        maxPages: MAX_AZURE_GRAPH_GROUP_PAGES,
      });
    }

    return groupIds;
  }

  private async resolveAzureUserGroupIds(
    accessToken: string,
    tokenClaims: Record<string, unknown> | null
  ): Promise<Set<string>> {
    const groupIds = new Set<string>();
    const claimGroups = tokenClaims?.groups;

    if (Array.isArray(claimGroups)) {
      for (const groupId of claimGroups) {
        if (typeof groupId === 'string' && groupId.length > 0) {
          groupIds.add(groupId);
        }
      }
    }

    if (groupIds.size > 0) {
      return groupIds;
    }

    return this.fetchAzureAdminGroupIds(accessToken);
  }

  private isAdminRole(role: string | undefined): boolean {
    return typeof role === 'string' && ALLOWED_AZURE_ADMIN_ROLES.has(role);
  }

  // ── Dev persona seeding data ─────────────────────────────────────
  // Protected by NODE_ENV !== 'production' hard block in demoLogin()
  private static readonly DEV_PERSONA_ORGS: Record<
    string,
    Array<{ orgId: string; orgName: string; role: string; isPrimary?: boolean }>
  > = {
    star_cadet: [
      {
        orgId: '00000000-0000-4000-a000-000000000001',
        orgName: 'Stardust Expeditionary Fleet',
        role: 'Member',
        isPrimary: true,
      },
      {
        orgId: '00000000-0000-4000-a000-000000000002',
        orgName: 'Deep Core Mining Consortium',
        role: 'Member',
      },
    ],
    admiral_chen: [
      {
        orgId: '00000000-0000-4000-a000-000000000001',
        orgName: 'Stardust Expeditionary Fleet',
        role: 'Owner',
        isPrimary: true,
      },
    ],
    sysop_nexus: [
      {
        orgId: '00000000-0000-4000-a000-000000000003',
        orgName: 'Ironwolf Mercenary Company',
        role: 'Admin',
        isPrimary: true,
      },
    ],
    'dev-user': [
      {
        orgId: '00000000-0000-4000-a000-000000000001',
        orgName: 'Stardust Expeditionary Fleet',
        role: 'Owner',
        isPrimary: true,
      },
    ],
  };

  /**
   * POST /api/v2/auth/2fa/enable
   * Enable two-factor authentication for user
   */
  async enable2FA(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user?.id) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      // Check if 2FA is already enabled
      const userRecord = await this.userService.getUserById(user.id);
      if (!userRecord) {
        return res.error(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', undefined, 404);
      }

      if (userRecord.twoFactorEnabled) {
        return res.error(
          ApiErrorCode.RESOURCE_CONFLICT,
          '2FA is already enabled. Disable it first to re-enable.',
          undefined,
          409
        );
      }

      // Generate 2FA secret and QR code
      const setup = await this.twoFactorService.generateSecret(
        user.username || userRecord.email,
        'SC Fleet Manager'
      );

      // Hash backup codes before storing
      const hashedBackupCodes = this.twoFactorService.hashBackupCodes(setup.backupCodes);

      // Store the secret temporarily (not enabled yet until verified)
      await this.userService.updateUser(user.id, {
        twoFactorSecret: setup.secret,
        backupCodes: hashedBackupCodes,
      });

      logger.info('2FA setup initiated', { userId: user.id });

      res.success({
        secret: setup.secret,
        qrCodeUrl: setup.qrCodeUrl,
        backupCodes: setup.backupCodes, // Return plaintext codes for user to save
        message: 'Scan QR code with authenticator app and verify to complete setup',
      });
    } catch (error: unknown) {
      logger.error('Failed to enable 2FA', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to enable 2FA'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/2fa/verify
   * Verify 2FA code during setup or login
   */
  async verify2FA(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const { code, isBackupCode = false } = req.body;

      if (!user?.id) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      // Normalize code: trim and convert to uppercase for consistency
      const normalizedCode =
        typeof code === 'string'
          ? code.trim().toUpperCase()
          : String(code ?? '')
              .trim()
              .toUpperCase();

      if (!normalizedCode || (normalizedCode.length !== 6 && normalizedCode.length !== 8)) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Invalid code format. Expected 6-digit code or 8-character backup code',
          undefined,
          400
        );
      }

      // Check if user is locked out
      const lockoutStatus = await this.twoFactorService.checkLockout(user.id);
      if (lockoutStatus.isLocked) {
        return res.error(
          ApiErrorCode.RATE_LIMIT_EXCEEDED,
          `Account temporarily locked due to multiple failed attempts. Try again after ${lockoutStatus.lockedUntil?.toISOString()}`,
          { lockedUntil: lockoutStatus.lockedUntil, remainingAttempts: 0 },
          429
        );
      }

      // Get user record
      const userRecord = await this.userService.getUserById(user.id);
      if (!userRecord?.twoFactorSecret) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          '2FA is not set up for this user',
          undefined,
          400
        );
      }

      let verified = false;

      if (isBackupCode) {
        // Verify backup code
        verified = this.twoFactorService.verifyBackupCode(
          normalizedCode,
          userRecord.backupCodes || []
        );

        if (verified) {
          // Remove used backup code
          const updatedBackupCodes = this.twoFactorService.removeBackupCode(
            normalizedCode,
            userRecord.backupCodes || []
          );
          await this.userService.updateUser(user.id, {
            backupCodes: updatedBackupCodes,
          });
          logger.info('Backup code used successfully', { userId: user.id });
        }
      } else {
        // Verify TOTP code
        verified = this.twoFactorService.verifyToken(userRecord.twoFactorSecret, normalizedCode);
      }

      if (verified) {
        // Reset failed attempts on successful verification
        await this.twoFactorService.resetFailedAttempts(user.id);

        // Enable 2FA if this is the setup verification (not already enabled)
        if (!userRecord.twoFactorEnabled) {
          await this.userService.updateUser(user.id, {
            twoFactorEnabled: true,
          });
          logger.info('2FA enabled successfully', { userId: user.id });
        }

        res.success({
          verified: true,
          message: '2FA verified successfully',
        });
      } else {
        // Track failed attempt
        await this.twoFactorService.trackFailedAttempt(user.id);

        // Get updated lockout status
        const updatedLockout = await this.twoFactorService.checkLockout(user.id);

        logger.warn('Failed 2FA verification attempt', {
          userId: user.id,
          remainingAttempts: updatedLockout.remainingAttempts,
        });

        res.error(
          ApiErrorCode.INVALID_CREDENTIALS,
          'Invalid verification code',
          {
            remainingAttempts: updatedLockout.remainingAttempts,
            attemptCount: updatedLockout.attemptCount,
          },
          401
        );
      }
    } catch (error: unknown) {
      logger.error('Failed to verify 2FA', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to verify 2FA'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/2fa/disable
   * Disable two-factor authentication (requires password confirmation)
   */
  async disable2FA(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const { password, code } = req.body;

      if (!user?.id) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      if (!password || !code) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Password and current 2FA code required to disable 2FA',
          undefined,
          400
        );
      }

      // Get user record with password field (excluded by default)
      const userRecord = await this.userAuthService.getUserWithPassword(user.id);

      if (!userRecord) {
        return res.error(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', undefined, 404);
      }

      if (!userRecord.twoFactorEnabled) {
        return res.error(ApiErrorCode.INVALID_INPUT, '2FA is not enabled', undefined, 400);
      }

      // Verify password for additional security
      if (!userRecord.password) {
        logger.warn('Cannot disable 2FA - user has no password set', { userId: user.id });
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Cannot disable 2FA - password is required',
          undefined,
          400
        );
      }

      const passwordValid = await this.userAuthService.verifyPassword(
        password,
        userRecord.password
      );
      if (!passwordValid) {
        logger.warn('Failed 2FA disable attempt - invalid password', { userId: user.id });
        return res.error(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid password', undefined, 401);
      }

      // Verify 2FA code as additional security
      const normalizedCode =
        typeof code === 'string'
          ? code.trim().toUpperCase()
          : String(code ?? '')
              .trim()
              .toUpperCase();
      const verified = this.twoFactorService.verifyToken(
        userRecord.twoFactorSecret || '',
        normalizedCode
      );

      if (!verified) {
        logger.warn('Failed 2FA disable attempt - invalid code', { userId: user.id });
        return res.error(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid 2FA code', undefined, 401);
      }

      // Disable 2FA
      await this.userService.updateUser(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: undefined,
        backupCodes: [],
        failedTwoFactorAttempts: 0,
        twoFactorLockedUntil: undefined,
      });

      logger.info('2FA disabled successfully', { userId: user.id });

      res.success({
        message: '2FA disabled successfully',
      });
    } catch (error: unknown) {
      logger.error('Failed to disable 2FA', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to disable 2FA'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/login
   * User login with email/password
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Username and password are required',
          undefined,
          400
        );
      }

      const user = await this.userService.validateCredentials(username, password);
      if (!user) {
        // Record failed attempt if user exists (to enable lockout)
        const existingUser = await this.userService.getUserByUsername(username);
        if (existingUser) {
          const lockoutResult = await this.securityService.recordFailedAttempt(existingUser.id);

          if (lockoutResult.isLocked && lockoutResult.lockedUntil) {
            const lockoutMinutes = Math.ceil(
              (lockoutResult.lockedUntil.getTime() - Date.now()) / 60000
            );
            return res.error(
              ApiErrorCode.FORBIDDEN,
              `Account locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`,
              undefined,
              403
            );
          }

          if (lockoutResult.attemptsRemaining <= 2) {
            return res.error(
              ApiErrorCode.INVALID_CREDENTIALS,
              `Invalid credentials. ${lockoutResult.attemptsRemaining} attempts remaining before lockout.`,
              { attemptsRemaining: lockoutResult.attemptsRemaining },
              401
            );
          }
        }

        return res.error(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid credentials', undefined, 401);
      }

      // Check if account is locked
      if (this.securityService.isAccountLocked(user)) {
        const status = await this.securityService.getLockoutStatus(user.id);
        const lockoutMinutes = status.lockoutExpiresIn
          ? Math.ceil(status.lockoutExpiresIn / 60000)
          : 0;
        return res.error(
          ApiErrorCode.FORBIDDEN,
          `Account is locked. Try again in ${lockoutMinutes} minutes.`,
          undefined,
          403
        );
      }

      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const tokens = await this.authService.generateTokens(user, {
        ipAddress,
        userAgent,
        sessionBinding: createSessionBinding(req),
      });

      await this.securityService.resetFailedAttempts(user.id);

      void this.accessLogService.logAccess(
        user.id,
        user.id,
        user.activeOrgId ?? undefined,
        'login:password',
        ipAddress,
        userAgent
      );

      // Set httpOnly cookies (CWE-1004)
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      );
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

      logger.info('Password login successful', {
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      res.success({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, username: user.username, role: user.role },
        message: 'Login successful. Tokens also set in httpOnly cookies for enhanced security.',
      });
    } catch (error: unknown) {
      logger.error('Login failed', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Login failed'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/demo
   * Development/demo login without SSO — creates or reuses a local user with persona seeding
   */
  async demoLogin(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenError('Development login is disabled in production environments');
      }
      if (process.env.ALLOW_DEV_LOGIN !== 'true') {
        throw new ForbiddenError(
          'Development login is disabled. Set ALLOW_DEV_LOGIN=true to enable.'
        );
      }

      const username =
        (typeof req.body?.username === 'string' ? req.body.username.trim() : '') || 'dev-user';
      const email =
        (typeof req.body?.email === 'string' ? req.body.email.trim() : '') ||
        `${username}@dev.local`;
      const VALID_DEV_ROLES = ['admin', 'user', 'moderator'];
      const rawRole =
        (typeof req.body?.role === 'string' ? req.body.role.trim() : '') ||
        process.env.DEV_LOGIN_ROLE ||
        'admin';
      const role = VALID_DEV_ROLES.includes(rawRole) ? rawRole : 'admin';

      const metadata = {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      };

      let user =
        (await this.userService.getUserByUsername(username)) ??
        (await this.userService.getUserByEmail(email));

      // Dev users created before UUID enforcement may have non-UUID IDs — recreate
      const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
      if (user && !uuidPattern.test(user.id)) {
        logger.info(`Dev persona: replacing non-UUID user "${user.id}" with UUID`);
        try {
          await AppDataSource.query(`DELETE FROM organization_memberships WHERE "userId" = $1`, [
            user.id,
          ]);
          await AppDataSource.query(`DELETE FROM users WHERE id = $1`, [user.id]);
        } catch (delErr: unknown) {
          logger.warn('Dev persona: could not delete non-UUID user (non-fatal)', {
            userId: user.id,
            error: delErr instanceof Error ? delErr.message : String(delErr),
          });
        }
        user = null;
      }

      if (user) {
        user = await this.userService.updateUser(user.id, {
          email,
          role,
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
          loginCount: (user.loginCount ?? 0) + 1,
          discordId: user.discordId ?? `dev-${username}`,
        });
      } else {
        const devDiscordPrefix = process.env.DEV_DISCORD_ID_PREFIX ?? 'dev';
        user = await this.userService.createUser({
          id: crypto.randomUUID(),
          username,
          email,
          role,
          discordId: `${devDiscordPrefix}-${username}`,
          displayName: 'Developer',
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
        });
      }

      await this.securityService.resetFailedAttempts(user.id);
      await this.seedDevPersonaOrgs(user.id, username);

      const tokens = await this.authService.generateTokens(user, metadata);
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      );
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

      logger.info('Development login issued', { userId: user.id, role: user.role });

      res.success({
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, username: user.username, role: user.role },
        message: 'Development login successful. Tokens set in httpOnly cookies for this session.',
      });
    } catch (error: unknown) {
      res.error(
        ApiErrorCode.FORBIDDEN,
        getErrorMessage(error, 'Development login failed'),
        undefined,
        403
      );
    }
  }

  /**
   * POST /api/v2/auth/sandbox
   * Production-safe sandbox login - creates an isolated trial user with no privileged role.
   */
  async sandboxLogin(req: Request, res: Response): Promise<void> {
    try {
      if (process.env.ENABLE_SANDBOX_LOGIN !== 'true') {
        throw new ForbiddenError(
          'Sandbox login is disabled. Set ENABLE_SANDBOX_LOGIN=true to enable trial sessions.'
        );
      }

      const metadata = {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      };

      const user = await this.userService.createSandboxUser({
        usernamePrefix: process.env.SANDBOX_LOGIN_PREFIX,
        emailDomain: process.env.SANDBOX_EMAIL_DOMAIN,
        ipAddress: metadata.ipAddress,
      });

      await this.securityService.resetFailedAttempts(user.id);

      const tokens = await this.authService.generateTokens(user, metadata);
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      );
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

      logger.info('Sandbox login issued', { userId: user.id });

      res.success({
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, username: user.username, role: user.role },
        sandbox: true,
        message: 'Sandbox session started. You are signed in with an isolated trial account.',
      });
    } catch (error: unknown) {
      if (error instanceof ForbiddenError) {
        res.error(ApiErrorCode.FORBIDDEN, error.message, undefined, 403);
        return;
      }
      logger.error('Sandbox login internal error', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        'Sandbox login failed due to an internal error',
        undefined,
        500
      );
    }
  }

  // ── Dev persona seeding helpers ──────────────────────────────────

  private async seedDevPersonaOrgs(userId: string, username: string): Promise<void> {
    const personaOrgs = AuthControllerV2.DEV_PERSONA_ORGS[username];
    if (!personaOrgs || personaOrgs.length === 0) {
      return;
    }

    const orgRepo = AppDataSource.getRepository(Organization);
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const userRepo = AppDataSource.getRepository(User);

    let primaryOrgId: string | undefined;
    for (const config of personaOrgs) {
      await this.ensureDevOrg(orgRepo, config, userId);
      await this.ensureDevMembership(membershipRepo, orgRepo, config, userId, username);
      if (config.isPrimary) {
        primaryOrgId = config.orgId;
      }
    }

    if (primaryOrgId) {
      const currentUser = await userRepo.findOne({ where: { id: userId } });
      if (currentUser && !currentUser.activeOrgId) {
        await userRepo.update(userId, { activeOrgId: primaryOrgId });
        logger.info(`Dev persona: set activeOrgId for "${username}" to ${primaryOrgId}`);
      }
    }
  }

  private async ensureDevOrg(
    orgRepo: Repository<Organization>,
    config: (typeof AuthControllerV2.DEV_PERSONA_ORGS)[string][number],
    userId: string
  ): Promise<void> {
    const existing = await orgRepo.findOne({ where: { id: config.orgId } });
    if (existing) {
      return;
    }

    const org = orgRepo.create({
      id: config.orgId,
      name: config.orgName,
      description: `Demo organization for development - ${config.orgName}`,
      members: [],
      totalMembers: 0,
      directMembers: 0,
      childCount: 0,
      level: 0,
      path: config.orgId,
      ownerId: config.role === 'owner' || config.role === 'founder' ? userId : undefined,
    });
    await orgRepo.save(org);
    logger.info(`Dev persona: created demo org "${config.orgName}" (${config.orgId})`);

    try {
      const { getOrgDefaultsService } =
        await import('../../services/organization/OrgDefaultsService');
      await getOrgDefaultsService().seedDefaults(config.orgId);
    } catch (seedError: unknown) {
      logger.warn('Dev persona: failed to seed org defaults (non-fatal)', {
        orgId: config.orgId,
        error: seedError instanceof Error ? seedError.message : String(seedError),
      });
    }
  }

  private async ensureDevMembership(
    membershipRepo: Repository<OrganizationMembership>,
    orgRepo: Repository<Organization>,
    config: (typeof AuthControllerV2.DEV_PERSONA_ORGS)[string][number],
    userId: string,
    username: string
  ): Promise<void> {
    const existing = await membershipRepo.findOne({
      where: { userId, organizationId: config.orgId },
    });
    if (existing) {
      return;
    }

    const roleId = await getRoleService().getRoleIdByName(config.role, config.orgId);
    if (!roleId) {
      logger.warn(`Dev persona: role '${config.role}' not found for org ${config.orgId}`);
      return;
    }

    const membership = membershipRepo.create({
      userId,
      organizationId: config.orgId,
      roleId,
      isActive: true,
      joinedAt: new Date(),
    });
    await membershipRepo.save(membership);
    await orgRepo.increment({ id: config.orgId }, 'totalMembers', 1);
    await orgRepo.increment({ id: config.orgId }, 'directMembers', 1);
    logger.info(
      `Dev persona: added membership for "${username}" in "${config.orgName}" as ${config.role}`
    );
  }

  /**
   * POST /api/v2/auth/logout
   * Logout and revoke refresh token
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;

      if (refreshToken) {
        await this.authService.revokeRefreshToken(refreshToken).catch(() => {
          logger.debug('Refresh token revocation skipped (already revoked or expired)');
        });
      }

      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions);
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearRefreshCookieOptions);
      res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, clearCsrfCookieOptions);

      const userId = (req as AuthRequest).user?.id ?? 'unknown';
      logger.info(`User ${userId} logged out`);

      res.success({ message: 'Logged out successfully' });
    } catch (error: unknown) {
      logger.error('Logout failed', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Logout failed'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/logout-all
   * Logout all sessions
   */
  async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthRequest).user;
      if (!user?.id) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      const count = await this.authService.revokeAllUserTokens(user.id);

      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions);
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearRefreshCookieOptions);
      res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, clearCsrfCookieOptions);

      logger.info(`All tokens revoked for user ${user.id} (${count} tokens)`);

      res.success({
        message: 'Logged out from all devices successfully',
        tokensRevoked: count,
      });
    } catch (error: unknown) {
      logger.error('Logout all failed', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Logout all failed'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;

      if (!refreshToken) {
        return res.error(ApiErrorCode.INVALID_INPUT, 'Refresh token is required', undefined, 400);
      }

      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const tokens = await this.authService.refreshTokens(refreshToken, {
        ipAddress,
        userAgent,
        sessionBinding: createSessionBinding(req),
      });

      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      );
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

      logger.info('Tokens refreshed successfully');

      res.success({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error: unknown) {
      logger.warn('Token refresh failed', { error: getErrorMessage(error) });
      res.error(ApiErrorCode.TOKEN_EXPIRED, 'Invalid or expired refresh token', undefined, 401);
    }
  }

  /**
   * GET /api/v2/auth/sessions
   * Get active sessions for current user
   */
  async getActiveSessions(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthRequest).user;
      if (!user?.id) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      const tokens = await this.authService.getUserRefreshTokens(user.id);

      res.success({
        sessions: tokens.map(token => ({
          id: token.id,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
          ipAddress: token.ipAddress,
          userAgent: token.userAgent,
        })),
      });
    } catch (error: unknown) {
      logger.error('Failed to get sessions', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get sessions'),
        undefined,
        500
      );
    }
  }

  // ==================== SHARED OAUTH HELPERS ====================

  /**
   * Redirect to frontend error page (GET) or send V2 error (POST).
   */
  private handleOAuthError(req: Request, res: Response, errorCode: string, message: string): void {
    if (req.method === 'GET') {
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorCode)}`);
      return;
    }
    res.error(ApiErrorCode.INVALID_CREDENTIALS, message, undefined, 401);
  }

  /**
   * Validate generic OAuth callback preconditions (config, error, code, HMAC state).
   * Returns the authorization code and optional linkUserId on success,
   * or undefined if response was already sent.
   */
  private validateOAuthCallbackPreconditions(
    req: Request,
    res: Response,
    isConfigured: boolean,
    providerName: string
  ): { code: string; linkUserId?: string } | undefined {
    if (!isConfigured) {
      this.handleOAuthError(
        req,
        res,
        `${providerName}_not_configured`,
        `${providerName} authentication is not available.`
      );
      return undefined;
    }

    const oauthError = req.query.error;
    if (oauthError) {
      // CWE-79: Sanitize user-controlled OAuth error parameter
      const rawError = Array.isArray(oauthError) ? oauthError[0] : oauthError;
      const truncated = String(rawError !== null && rawError !== undefined ? rawError : '')
        .trim()
        .toLowerCase()
        .slice(0, 128);
      const errorStr = OAUTH_ERROR_ALLOWLIST.includes(
        truncated as (typeof OAUTH_ERROR_ALLOWLIST)[number]
      )
        ? truncated
        : truncated.replaceAll(/[^a-zA-Z0-9_\- ]/g, '') || 'unknown_error';
      this.handleOAuthError(
        req,
        res,
        errorStr,
        `${providerName} authentication failed: ${errorStr}`
      );
      return undefined;
    }

    const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    const code = (queryCode ?? req.body.code) as string | undefined;
    if (!code) {
      this.handleOAuthError(req, res, 'no_code', 'Authorization code is required');
      return undefined;
    }

    const queryState = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    const state = String(queryState ?? req.body.state ?? '');
    const stateResult = validateOAuthState(state);
    if (!stateResult.valid) {
      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=invalid_state`);
      } else {
        res.error(ApiErrorCode.FORBIDDEN, 'Invalid or expired OAuth state', undefined, 403);
      }
      return undefined;
    }

    return { code, linkUserId: stateResult.linkUserId };
  }

  /**
   * Validate Discord OAuth callback preconditions.
   * Delegates to shared validateOAuthCallbackPreconditions, then adds
   * the Discord-specific DISCORD_REDIRECT_URI_BACKEND env var check.
   */
  private validateDiscordCallbackPreconditions(
    req: Request,
    res: Response
  ): { code: string; linkUserId?: string } | undefined {
    // Delegate to shared precondition validation first (config, error, code, state)
    const result = this.validateOAuthCallbackPreconditions(
      req,
      res,
      isDiscordServiceInitialized(),
      'Discord'
    );
    if (!result) {
      return undefined;
    }

    // Discord-specific: verify backend redirect URI is configured
    const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
    if (!backendRedirectUri) {
      this.handleOAuthError(
        req,
        res,
        'server_config',
        'DISCORD_REDIRECT_URI_BACKEND is not configured'
      );
      return undefined;
    }

    return result;
  }

  /**
   * Extract the access token from cookies or Authorization header.
   */
  private getAccessTokenFromRequest(req: Request): string | undefined {
    return (
      req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ??
      req.headers.authorization?.replace('Bearer ', '') ??
      undefined
    );
  }

  /**
   * Resolve or create an OAuth user via the OAuthLinkingService,
   * then map the result to an HTTP response.
   *
   * Returns the resolved User, or null if a redirect/error was sent.
   */
  private async resolveOrCreateOAuthUserAndRespond(
    req: Request,
    res: Response,
    opts: {
      linkUserId?: string;
      providerName: string;
      providerId: string;
      providerIdField: string;
      email: string | undefined;
      username: string;
      displayName: string;
      avatar?: string;
      lookupByProviderId: () => Promise<User | null>;
    }
  ): Promise<User | null> {
    const result = await this.oauthLinkingService.resolveOrCreateOAuthUser({
      ...opts,
      accessToken: this.getAccessTokenFromRequest(req),
      ipAddress: req.ip ?? req.socket.remoteAddress,
    });

    if (result.tag === 'duplicate_provider') {
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/settings?error=account_already_linked`);
      return null;
    }

    return result.user;
  }

  /**
   * Allowed custom URL scheme for mobile deep-link redirects.
   * Only this scheme is permitted — prevents open-redirect attacks.
   */
  private static readonly MOBILE_SCHEME = 'scfleetmanager://';

  /**
   * If the request has a `mobile_redirect` query param with an allowed scheme,
   * stash it in a short-lived httpOnly cookie so the callback can use it.
   */
  private storeMobileRedirect(req: Request, res: Response): void {
    const mobileRedirect = req.query.mobile_redirect as string | undefined;
    if (!mobileRedirect) {
      return;
    }

    // CWE-601: Only allow the registered mobile custom scheme
    if (!mobileRedirect.startsWith(AuthControllerV2.MOBILE_SCHEME)) {
      logger.warn('Rejected mobile_redirect with invalid scheme', {
        value: mobileRedirect.substring(0, 60),
      });
      return;
    }

    res.cookie(COOKIE_NAMES.MOBILE_REDIRECT, mobileRedirect, pkceCookieOptions);
  }

  /**
   * Read and clear the mobile redirect cookie. Returns undefined if none.
   */
  private consumeMobileRedirect(req: Request, res: Response): string | undefined {
    const mobileRedirect = req.cookies?.[COOKIE_NAMES.MOBILE_REDIRECT] as string | undefined;
    if (mobileRedirect) {
      res.clearCookie(COOKIE_NAMES.MOBILE_REDIRECT, clearCookieOptions);
    }
    // Defense-in-depth: re-validate scheme even though storeMobileRedirect already checked
    if (mobileRedirect && !mobileRedirect.startsWith(AuthControllerV2.MOBILE_SCHEME)) {
      logger.warn('Rejected consumed mobile_redirect with invalid scheme');
      return undefined;
    }
    return mobileRedirect;
  }

  /**
   * Generate JWT tokens, set cookies, record access log, and send response.
   * Handles both GET (redirect) and POST (V2 JSON) responses.
   *
   * If a mobile_redirect cookie is present, redirects to the mobile app
   * with tokens in the deep-link URL instead of the web frontend.
   *
   * @param redirectUrl - Override the default GET redirect target (e.g. for account linking flows)
   */
  private async completeOAuthLogin(
    req: Request,
    res: Response,
    user: User,
    providerName: string,
    redirectUrl?: string
  ): Promise<void> {
    const tokens = await this.authService.generateTokens(user, {
      ipAddress: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionBinding: createSessionBinding(req),
    });

    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      tokens.accessToken,
      getAccessTokenCookieOptions(tokens.accessToken)
    );
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

    void this.accessLogService.logAccess(
      user.id,
      user.id,
      user.activeOrgId ?? undefined,
      `login:${providerName.toLowerCase()}`,
      req.ip ?? req.socket.remoteAddress,
      req.headers['user-agent']
    );

    if (req.method === 'GET') {
      // Check for mobile app redirect (stored during OAuth initiation)
      const mobileRedirect = this.consumeMobileRedirect(req, res);
      if (mobileRedirect) {
        const mobileUrl = new URL(mobileRedirect);
        mobileUrl.searchParams.set('token', tokens.accessToken);
        mobileUrl.searchParams.set('refreshToken', tokens.refreshToken);
        const target = mobileUrl.toString();
        logger.info(`${providerName} OAuth successful, redirecting to mobile app`);
        res.redirect(target);
        return;
      }

      const frontendUrl = getFrontendUrl();
      const target = redirectUrl ?? `${frontendUrl}/login?success=true`;
      logger.info(`${providerName} OAuth successful, redirecting to ${target}`);
      res.redirect(target);
      return;
    }

    res.success({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
      },
      message: `${providerName} authentication successful`,
    });
  }

  // ==================== DISCORD OAUTH ====================

  /**
   * GET /api/v2/auth/discord
   * Initiate Discord OAuth flow
   */
  async discordInitiate(req: Request, res: Response): Promise<void> {
    try {
      if (!isDiscordServiceInitialized()) {
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=discord_not_configured`);
      }

      // Stash mobile redirect URI if present (for callback to pick up)
      this.storeMobileRedirect(req, res);

      // Generate neutral OAuth state for CSRF protection.
      // Account linking still resolves from callback-time authenticated session.
      const state = generateOAuthState();

      // PKCE (RFC 7636) defense-in-depth: stash verifier in an httpOnly cookie
      // and send only the SHA-256 challenge to Discord.
      const pkce = generatePkcePair();
      res.cookie(COOKIE_NAMES.DISCORD_PKCE_VERIFIER, pkce.verifier, pkceCookieOptions);

      const discordService = getDiscordService();
      const authUrl = discordService.generateAuthUrl(state, pkce.challenge);
      logger.debug('Redirecting to Discord OAuth', { pkce: true });
      safeOAuthRedirect(res, authUrl, 'discord_error');
    } catch (error: unknown) {
      logger.error('Discord OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=discord_error`);
    }
  }

  /**
   * GET/POST /api/v2/auth/discord/callback
   * Discord OAuth callback
   */
  async discordCallback(req: Request, res: Response): Promise<void> {
    try {
      // Validate preconditions using shared helper (validates config, error, code, HMAC state)
      const result = this.validateDiscordCallbackPreconditions(req, res);
      if (!result) {
        return;
      }

      const { code, linkUserId } = result;
      const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND!;

      // PKCE: read the verifier set during initiate (clear it regardless of outcome).
      const codeVerifier = req.cookies?.[COOKIE_NAMES.DISCORD_PKCE_VERIFIER] as string | undefined;
      res.clearCookie(COOKIE_NAMES.DISCORD_PKCE_VERIFIER, clearCookieOptions);

      const discordService = getDiscordService();
      const discordTokens = await discordService.authenticateUser(
        code,
        backendRedirectUri,
        codeVerifier
      );
      const discordUser = await discordService.getUserInfo(discordTokens.access_token);

      const oauthUserOpts = {
        linkUserId,
        providerName: 'Discord',
        providerId: discordUser.id,
        providerIdField: 'discordId',
        email: discordUser.email,
        username: discordUser.username,
        displayName: discordUser.username,
        avatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`
          : undefined,
        lookupByProviderId: () => this.userService.getUserByDiscordId(discordUser.id),
      };

      let user: User | null;
      let redirectUrl: string | undefined;

      if (linkUserId) {
        // Account linking flow — always go through resolveOrCreateOAuthUser
        // so duplicate-provider and ownership checks are applied.
        user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
        if (!user) {
          return; // redirect already sent (duplicate_provider → /settings?error=…)
        }
        const frontendUrl = getFrontendUrl();
        redirectUrl = `${frontendUrl}/settings?linked=discord`;
      } else {
        // Login flow — existing user lookup first, then fallback to resolve/create
        user = await this.userService.getUserByDiscordId(discordUser.id);
        if (user) {
          await this.userService.updateUser(user.id, {
            lastLoginAt: new Date(),
            lastLoginIp: req.ip ?? req.socket.remoteAddress,
          });
          logger.info(`User logged in via Discord OAuth: ${user.id}`);
        } else {
          user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
          if (!user) {
            return;
          }
        }
      }

      await this.completeOAuthLogin(req, res, user, 'Discord', redirectUrl);
    } catch (error: unknown) {
      logger.error('Discord OAuth callback error:', error);

      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }

      res.error(
        ApiErrorCode.INVALID_CREDENTIALS,
        getErrorMessage(error, 'Discord authentication failed'),
        undefined,
        401
      );
    }
  }

  // ==================== AZURE AD OAUTH ====================

  /**
   * POST /api/v2/auth/azuread/callback
   * Azure AD OAuth callback
   */
  async azureADCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, redirectUri } = req.body;

      if (!code || !redirectUri) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Code and redirectUri are required',
          undefined,
          400
        );
      }

      // CWE-918 / CWE-601: Validate redirectUri against allowed frontend origin
      const allowedOrigin = getFrontendUrl();
      try {
        const parsed = new URL(redirectUri as string);
        const allowed = new URL(allowedOrigin);
        if (parsed.origin !== allowed.origin || parsed.pathname !== '/admin/login') {
          return res.error(ApiErrorCode.FORBIDDEN, 'Redirect URI is not allowed', undefined, 403);
        }
      } catch {
        return res.error(ApiErrorCode.INVALID_INPUT, 'Invalid redirect URI format', undefined, 400);
      }

      const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
      const adminConfig = this.resolveAzureAdminConfig();
      if (!adminConfig.ok) {
        return res.error(ApiErrorCode.INTERNAL_ERROR, adminConfig.message, undefined, 500);
      }

      const { clientId, clientSecret, configuredAdminGroups } = adminConfig;

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri as string,
        grant_type: 'authorization_code',
        scope: 'openid profile email User.Read',
      });

      const tokenResponse = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        let errorMessage = 'Failed to exchange code for token';
        try {
          const errorData = (await tokenResponse.json()) as {
            error_description?: string;
            error?: string;
          };
          errorMessage = errorData.error_description ?? errorData.error ?? errorMessage;
        } catch {
          // Non-JSON error response
        }
        logger.error('Azure AD token exchange failed', { error: errorMessage });
        return res.error(ApiErrorCode.INVALID_CREDENTIALS, errorMessage, undefined, 401);
      }

      const tokenData = (await tokenResponse.json()) as AzureADTokenResponse;
      // The access token was just obtained directly from the Microsoft token
      // endpoint over TLS, so the `tid`/`groups` claims used below for the
      // tenant/admin-group gate are trusted without local signature verification.
      const tokenClaims = decodeJwtClaims(tokenData.access_token);
      const tokenTenantId = tokenClaims?.tid;

      if (typeof tokenTenantId !== 'string' || tokenTenantId !== tenantId) {
        return res.error(
          ApiErrorCode.FORBIDDEN,
          'Azure AD tenant is not allowed for admin login',
          undefined,
          403
        );
      }

      const userGroupIds = await this.resolveAzureUserGroupIds(tokenData.access_token, tokenClaims);
      const isInAdminGroup = configuredAdminGroups.some(groupId => userGroupIds.has(groupId));
      if (!isInAdminGroup) {
        return res.error(
          ApiErrorCode.FORBIDDEN,
          'Azure AD account is not in an allowed admin group',
          undefined,
          403
        );
      }

      const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.error(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to fetch user info from Microsoft Graph',
          undefined,
          500
        );
      }

      const azureUser = (await userInfoResponse.json()) as MicrosoftGraphUser;
      const email = azureUser.mail ?? azureUser.userPrincipalName;
      if (!email) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Azure AD user has no email address',
          undefined,
          400
        );
      }

      const user = await this.userService.getUserByEmail(email);

      if (!user) {
        return res.error(
          ApiErrorCode.FORBIDDEN,
          'No linked admin account exists for this Azure AD user',
          undefined,
          403
        );
      }

      if (!this.isAdminRole(user.role)) {
        return res.error(
          ApiErrorCode.FORBIDDEN,
          'User account is not authorized for admin login',
          undefined,
          403
        );
      }

      await this.userService.updateUser(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: req.ip ?? req.socket.remoteAddress,
      });

      logger.info(`Admin user logged in via Azure AD OAuth: ${user.id}`);

      const tokens = await this.authService.generateTokens(user, {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      });

      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      );
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions);

      // Record access log for admin login history
      void this.accessLogService.logAccess(
        user.id,
        user.id,
        user.activeOrgId ?? undefined,
        'login:azuread',
        req.ip ?? req.socket.remoteAddress,
        req.headers['user-agent']
      );

      res.success({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        },
        message: 'Azure AD authentication successful',
      });
    } catch (error: unknown) {
      logger.error('Azure AD OAuth callback error:', error);
      res.error(
        ApiErrorCode.INVALID_CREDENTIALS,
        getErrorMessage(error, 'Azure AD authentication failed'),
        undefined,
        401
      );
    }
  }

  // ==================== GOOGLE OAUTH ====================

  /**
   * GET /api/v2/auth/google
   * Initiate Google OAuth flow
   */
  async googleInitiate(req: Request, res: Response): Promise<void> {
    try {
      if (!isGoogleOAuthConfigured()) {
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
      }

      // Stash mobile redirect URI if present (for callback to pick up)
      this.storeMobileRedirect(req, res);

      const state = generateOAuthState();
      const googleService = getGoogleOAuthService();
      const authUrl = googleService.generateAuthUrl(state);
      logger.debug('Redirecting to Google OAuth');
      safeOAuthRedirect(res, authUrl, 'google_error');
    } catch (error: unknown) {
      logger.error('Google OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=google_error`);
    }
  }

  /**
   * GET/POST /api/v2/auth/google/callback
   * Google OAuth callback
   */
  async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const result = this.validateOAuthCallbackPreconditions(
        req,
        res,
        isGoogleOAuthConfigured(),
        'Google'
      );
      if (!result) {
        return;
      }

      const { code, linkUserId } = result;
      const googleService = getGoogleOAuthService();
      const googleTokens = await googleService.authenticateUser(code);
      const googleUser = await googleService.getUserInfo(googleTokens.access_token);

      const oauthUserOpts = {
        linkUserId,
        providerName: 'Google',
        providerId: googleUser.id,
        providerIdField: 'googleId',
        email: googleUser.email,
        username: googleUser.email.split('@')[0] ?? `google_${crypto.randomUUID().substring(0, 8)}`,
        displayName: googleUser.name,
        avatar: googleUser.picture ?? undefined,
        lookupByProviderId: () => this.userService.getUserByGoogleId(googleUser.id),
      };

      let user: User | null;
      let redirectUrl: string | undefined;

      if (linkUserId) {
        // Account linking flow
        user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
        if (!user) {
          return;
        }
        const frontendUrl = getFrontendUrl();
        redirectUrl = `${frontendUrl}/settings?linked=google`;
      } else {
        // Login flow
        user = await this.userService.getUserByGoogleId(googleUser.id);
        if (user) {
          await this.userService.updateUser(user.id, {
            lastLoginAt: new Date(),
            lastLoginIp: req.ip ?? req.socket.remoteAddress,
          });
          logger.info(`User logged in via Google OAuth: ${user.id}`);
        } else {
          user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
          if (!user) {
            return;
          }
        }
      }

      await this.completeOAuthLogin(req, res, user, 'Google', redirectUrl);
    } catch (error: unknown) {
      logger.error('Google OAuth callback error:', error);
      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }
      res.error(
        ApiErrorCode.INVALID_CREDENTIALS,
        getErrorMessage(error, 'Google authentication failed'),
        undefined,
        401
      );
    }
  }

  /**
   * POST /api/v2/auth/google/link
   * Link Google account to authenticated user
   */
  async googleLink(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      const { code } = req.body;
      if (!code) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Authorization code is required',
          undefined,
          400
        );
      }

      const googleService = getGoogleOAuthService();
      const googleTokens = await googleService.authenticateUser(code);
      const googleUser = await googleService.getUserInfo(googleTokens.access_token);

      const existing = await this.userService.getUserByGoogleId(googleUser.id);
      if (existing && existing.id !== userId) {
        return res.error(
          ApiErrorCode.RESOURCE_CONFLICT,
          'This Google account is already linked to another user',
          undefined,
          409
        );
      }

      await this.userService.updateUser(userId, { googleId: googleUser.id });
      logger.info(`User ${userId} linked Google account ${googleUser.id}`);

      res.success({
        message: 'Google account linked successfully',
        provider: 'google',
        providerId: googleUser.id,
      });
    } catch (error: unknown) {
      logger.error('Google account linking failed:', error);
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Google account linking failed'),
        undefined,
        500
      );
    }
  }

  // ==================== TWITCH OAUTH ====================

  /**
   * GET /api/v2/auth/twitch
   * Initiate Twitch OAuth flow
   */
  async twitchInitiate(req: Request, res: Response): Promise<void> {
    try {
      if (!isTwitchOAuthConfigured()) {
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=twitch_not_configured`);
      }

      // Stash mobile redirect URI if present (for callback to pick up)
      this.storeMobileRedirect(req, res);

      const state = generateOAuthState();
      const twitchService = getTwitchOAuthService();
      const authUrl = twitchService.generateAuthUrl(state);
      logger.debug('Redirecting to Twitch OAuth');
      safeOAuthRedirect(res, authUrl, 'twitch_error');
    } catch (error: unknown) {
      logger.error('Twitch OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=twitch_error`);
    }
  }

  /**
   * GET/POST /api/v2/auth/twitch/callback
   * Twitch OAuth callback
   */
  async twitchCallback(req: Request, res: Response): Promise<void> {
    try {
      const result = this.validateOAuthCallbackPreconditions(
        req,
        res,
        isTwitchOAuthConfigured(),
        'Twitch'
      );
      if (!result) {
        return;
      }

      const { code, linkUserId } = result;
      const twitchService = getTwitchOAuthService();
      const twitchTokens = await twitchService.authenticateUser(code);
      const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);

      const oauthUserOpts = {
        linkUserId,
        providerName: 'Twitch',
        providerId: twitchUser.id,
        providerIdField: 'twitchId',
        email: twitchUser.email,
        username: twitchUser.login ?? `twitch_${crypto.randomUUID().substring(0, 8)}`,
        displayName: twitchUser.display_name,
        avatar: twitchUser.profile_image_url ?? undefined,
        lookupByProviderId: () => this.userService.getUserByTwitchId(twitchUser.id),
      };

      let user: User | null;
      let redirectUrl: string | undefined;

      if (linkUserId) {
        // Account linking flow
        user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
        if (!user) {
          return;
        }
        const frontendUrl = getFrontendUrl();
        redirectUrl = `${frontendUrl}/settings?linked=twitch`;
      } else {
        // Login flow
        user = await this.userService.getUserByTwitchId(twitchUser.id);
        if (user) {
          await this.userService.updateUser(user.id, {
            lastLoginAt: new Date(),
            lastLoginIp: req.ip ?? req.socket.remoteAddress,
          });
          logger.info(`User logged in via Twitch OAuth: ${user.id}`);
        } else {
          user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
          if (!user) {
            return;
          }
        }
      }

      await this.completeOAuthLogin(req, res, user, 'Twitch', redirectUrl);
    } catch (error: unknown) {
      logger.error('Twitch OAuth callback error:', error);
      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }
      res.error(
        ApiErrorCode.INVALID_CREDENTIALS,
        getErrorMessage(error, 'Twitch authentication failed'),
        undefined,
        401
      );
    }
  }

  /**
   * POST /api/v2/auth/twitch/link
   * Link Twitch account to authenticated user
   */
  async twitchLink(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        return res.error(ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
      }

      const { code } = req.body;
      if (!code) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Authorization code is required',
          undefined,
          400
        );
      }

      const twitchService = getTwitchOAuthService();
      const twitchTokens = await twitchService.authenticateUser(code);
      const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);

      const existing = await this.userService.getUserByTwitchId(twitchUser.id);
      if (existing && existing.id !== userId) {
        return res.error(
          ApiErrorCode.RESOURCE_CONFLICT,
          'This Twitch account is already linked to another user',
          undefined,
          409
        );
      }

      await this.userService.updateUser(userId, { twitchId: twitchUser.id });
      logger.info(`User ${userId} linked Twitch account ${twitchUser.id}`);

      res.success({
        message: 'Twitch account linked successfully',
        provider: 'twitch',
        providerId: twitchUser.id,
      });
    } catch (error: unknown) {
      logger.error('Twitch account linking failed:', error);
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Twitch account linking failed'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/sessions/:sessionId/revoke
   * Revoke a specific session by ID
   */
  async revokeSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.error(ApiErrorCode.INVALID_INPUT, 'Session ID is required', undefined, 400);
      }

      // Revoke the specific session's refresh token
      await this.authService.revokeRefreshToken(sessionId).catch(() => {
        logger.debug('Session revocation skipped (already revoked or expired)');
      });

      // Only clear cookies if the revoked session matches the current session
      const currentRefreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
      if (currentRefreshToken === sessionId) {
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions);
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearRefreshCookieOptions);
        res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, clearCsrfCookieOptions);
      }

      const userId = (req as AuthRequest).user?.id ?? 'unknown';
      logger.info(`Session ${sessionId} revoked for user ${userId}`);

      res.success({ message: 'Session revoked successfully' });
    } catch (error: unknown) {
      logger.error('Failed to revoke session', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to revoke session'),
        undefined,
        500
      );
    }
  }

  /**
   * GET /api/v2/auth/tokens/verify
   * Verify the current access token
   */
  async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      // If we reach here, the authenticate middleware has already verified the token
      const user = (req as Request & { user?: Record<string, unknown> }).user;

      if (!user) {
        throw new Error('User not found in request');
      }

      res.success({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error: unknown) {
      res.error(
        ApiErrorCode.UNAUTHORIZED,
        getErrorMessage(error, 'Token verification failed'),
        undefined,
        401
      );
    }
  }

  /**
   * POST /api/v2/auth/token/refresh
   * Refresh access token with rotation
   */
  async refreshAccessToken(req: Request, res: Response): Promise<void> {
    // Alias for refresh method to support both endpoints
    return this.refresh(req, res);
  }

  /**
   * DELETE /api/v2/auth/sessions/all
   * Revoke all user sessions (security feature)
   */
  async revokeAllSessions(req: Request, res: Response): Promise<void> {
    // Alias for logoutAll to support v2 endpoint naming
    return this.logoutAll(req, res);
  }
}
