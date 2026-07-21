import crypto from 'node:crypto';

import { Request, Response } from 'express';
import { Repository } from 'typeorm';

import {
  clearCookieOptions,
  clearCsrfCookieOptions,
  clearRefreshCookieOptions,
  COOKIE_NAMES,
  getAccessTokenCookieOptions,
  refreshTokenCookieOptions,
} from '../config/cookies';
import { AppDataSource } from '../config/database';
import { getFrontendUrl } from '../config/urls';
import { AuthRequest } from '../middleware/auth';
import { createSessionBinding } from '../middleware/sessionBinding';
import { Organization } from '../models/Organization';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { User } from '../models/User';
import { AuthenticationService } from '../services/authentication';
import { getDiscordService, isDiscordServiceInitialized } from '../services/discord/DiscordService';
import {
  getGoogleOAuthService,
  isGoogleOAuthConfigured,
} from '../services/google/GoogleOAuthService';
import { getOrgDefaultsService } from '../services/organization/OrgDefaultsService';
import { AccountSecurityService } from '../services/security';
import { AccountAccessLogService } from '../services/security/access/AccountAccessLogService';
import { getRoleService } from '../services/security/core/RoleService';
import {
  getTwitchOAuthService,
  isTwitchOAuthConfigured,
} from '../services/twitch/TwitchOAuthService';
import { UserAuthenticationService, UserProfileService, UserService } from '../services/user';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { generateOAuthState, getOAuthSecret, validateOAuthState } from '../utils/oauthState';

import { BaseController } from './BaseController';

/**
 * Azure AD OAuth Error Response
 */
interface AzureADErrorResponse {
  error?: string;
  error_description?: string;
}

/**
 * Azure AD Token Response
 */
interface AzureADTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Microsoft Graph User Info
 */
interface MicrosoftGraphUser {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

/**
 * Allowlist of OAuth provider authorization endpoint origins.
 * Used by safeOAuthRedirect to defend against open-redirect vulnerabilities.
 */
const OAUTH_PROVIDER_ORIGINS = new Set<string>([
  'https://discord.com',
  'https://accounts.google.com',
  'https://id.twitch.tv',
]);

/**
 * Safely redirect to a provider-built OAuth authorization URL.
 * Validates URL origin against an allowlist before issuing redirect.
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
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Refused OAuth redirect to malformed URL', { error: message });
  }

  res.redirect(`${getFrontendUrl()}/login?error=${encodeURIComponent(errorCode)}`);
}

/**
 * AuthController - Handles authentication and session management
 * Extends BaseController for standardized error handling
 * Integrates with AccountSecurityService for unified security management
 *
 * UPDATED: Phase 4.3 - Now uses domain-separated UserService architecture
 */
export class AuthController extends BaseController {
  private readonly authService: AuthenticationService;
  private readonly userService: UserService;
  private readonly userAuthService: UserAuthenticationService;
  private readonly userProfileService: UserProfileService;
  private readonly securityService: AccountSecurityService;
  private readonly accessLogService: AccountAccessLogService;

  constructor() {
    super();
    this.authService = new AuthenticationService();
    this.userService = new UserService();
    this.userAuthService = new UserAuthenticationService();
    this.userProfileService = new UserProfileService();
    this.securityService = AccountSecurityService.getInstance();
    this.accessLogService = new AccountAccessLogService();
  }

  /**
   * Login endpoint - generates access token and refresh token
   * POST /api/auth/login
   *
   * @param req - Request with username and password
   * @param res - Response object
   * @returns Access token, refresh token, and user info
   * @throws ValidationError if credentials missing
   * @throws UnauthorizedError if credentials invalid
   * @throws ForbiddenError if account locked
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.body, 'username', 'password');
      const { username, password } = req.body;

      // Validate user credentials
      const user = await this.userService.validateCredentials(username, password);
      if (!user) {
        logger.warn(`Failed login attempt for username: ${username}`);

        // Record failed attempt if user exists (to enable lockout)
        const existingUser = await this.userService.getUserByUsername(username);
        if (existingUser) {
          const lockoutResult = await this.securityService.recordFailedAttempt(existingUser.id);

          if (lockoutResult.isLocked && lockoutResult.lockedUntil) {
            const lockoutMinutes = Math.ceil(
              (lockoutResult.lockedUntil.getTime() - Date.now()) / 60000
            );
            throw new ForbiddenError(
              `Account locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`
            );
          }

          if (lockoutResult.attemptsRemaining <= 2) {
            throw new UnauthorizedError(
              `Invalid credentials. ${lockoutResult.attemptsRemaining} attempts remaining before lockout.`,
              { attemptsRemaining: lockoutResult.attemptsRemaining }
            );
          }
        }

        throw new UnauthorizedError('Invalid credentials');
      }

      // Check if account is locked
      if (this.securityService.isAccountLocked(user)) {
        const status = await this.securityService.getLockoutStatus(user.id);
        const lockoutMinutes = status.lockoutExpiresIn
          ? Math.ceil(status.lockoutExpiresIn / 60000)
          : 0;

        logger.warn(`Login attempt on locked account: ${user.id}`);
        throw new ForbiddenError(
          `Account is locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`
        );
      }

      // Generate tokens using unified AuthenticationService
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const tokens = await this.authService.generateTokens(user, {
        ipAddress,
        userAgent,
        sessionBinding: createSessionBinding(req),
      });

      // Reset failed login attempts on successful login
      await this.securityService.resetFailedAttempts(user.id);

      logger.info(`User ${user.id} logged in successfully`);

      // Record login event for login history
      void this.accessLogService.logAccess(
        user.id,
        user.id,
        user.activeOrgId ?? undefined,
        'login:password',
        ipAddress,
        userAgent
      );

      // CWE-1004: Set httpOnly cookies for tokens (reduces XSS risk)
      // NOSONAR: CWE-1004/CWE-614 false positive — accessTokenCookieOptions and
      // refreshTokenCookieOptions (config/cookies.ts) set httpOnly: true AND secure: true.
      // accessTokenCookieOptions includes: httpOnly: true, secure: true, sameSite: 'none'
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      ); // NOSONAR
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        message: 'Login successful. Tokens also set in httpOnly cookies for enhanced security.',
      };
    });
  };

  /**
   * Dev persona organization definitions.
   * Maps persona usernames to the orgs and memberships they should have.
   */
  private static readonly DEV_PERSONA_ORGS: Record<
    string,
    Array<{
      orgId: string;
      orgName: string;
      role: string;
      isPrimary?: boolean;
    }>
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
    // DEV ONLY: Default persona when no specific username is provided.
    // Protected by NODE_ENV !== 'production' hard block in devLogin()
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
   * Ensure a single dev org exists, creating it if needed.
   */
  private async ensureDevOrg(
    orgRepo: Repository<Organization>,
    config: (typeof AuthController.DEV_PERSONA_ORGS)[string][number],
    userId: string
  ): Promise<void> {
    let org = await orgRepo.findOne({ where: { id: config.orgId } });
    if (org) {
      return;
    }

    org = orgRepo.create({
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
      await getOrgDefaultsService().seedDefaults(config.orgId);
    } catch (seedError: unknown) {
      logger.warn('Dev persona: failed to seed org defaults (non-fatal)', {
        orgId: config.orgId,
        error: seedError instanceof Error ? seedError.message : String(seedError),
      });
    }
  }

  /**
   * Ensure a membership exists for a dev persona in an org.
   */
  private async ensureDevMembership(
    membershipRepo: Repository<OrganizationMembership>,
    orgRepo: Repository<Organization>,
    config: (typeof AuthController.DEV_PERSONA_ORGS)[string][number],
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
   * Seed organizations and memberships for known dev personas.
   * Idempotent — safe to call on every dev login.
   */
  private async seedDevPersonaOrgs(userId: string, username: string): Promise<void> {
    const personaOrgs = AuthController.DEV_PERSONA_ORGS[username];
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

    // Set activeOrgId if the user doesn't already have one
    if (primaryOrgId) {
      const currentUser = await userRepo.findOne({ where: { id: userId } });
      if (currentUser && !currentUser.activeOrgId) {
        await userRepo.update(userId, { activeOrgId: primaryOrgId });
        logger.info(`Dev persona: set activeOrgId for "${username}" to ${primaryOrgId}`);
      }
    }
  }

  /**
   * Development/demo login endpoint - creates or reuses a local user without SSO
   * POST /api/auth/demo (also available via /api/v2/auth/demo)
   */
  public devLogin = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      // SECURITY: Never allow dev login in production, regardless of ALLOW_DEV_LOGIN
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenError('Development login is disabled in production environments');
      }

      // In non-production environments, check if dev login is explicitly enabled
      if (process.env.ALLOW_DEV_LOGIN !== 'true') {
        throw new ForbiddenError(
          'Development login is disabled. Set ALLOW_DEV_LOGIN=true to enable.'
        );
      }

      const rawUsername =
        typeof req.body?.username === 'string' ? req.body.username.trim() : 'dev-user';
      const username = rawUsername ?? 'dev-user';
      const emailInput = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      const email = emailInput ?? `${username}@dev.local`;
      const roleInput = typeof req.body?.role === 'string' ? req.body.role.trim() : undefined;
      const role = roleInput ?? process.env.DEV_LOGIN_ROLE ?? 'admin';

      const metadata = {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      };

      let user =
        (await this.userService.getUserByUsername(username)) ??
        (await this.userService.getUserByEmail(email));

      // Dev users created before UUID enforcement may have non-UUID IDs
      // (e.g. "demo-user-admiral-002"). These break wiki/revision tables
      // that have columns typed as uuid. Delete and recreate with a proper UUID.
      const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
      if (user && !uuidPattern.test(user.id)) {
        logger.info(`Dev persona: replacing non-UUID user "${user.id}" with UUID`);
        const oldId = user.id;
        try {
          // Delete referencing rows first, then the user
          await AppDataSource.query(`DELETE FROM organization_memberships WHERE "userId" = $1`, [
            oldId,
          ]);
          await AppDataSource.query(`DELETE FROM users WHERE id = $1`, [oldId]);
          logger.info(`Dev persona: deleted old non-UUID user "${oldId}"`);
        } catch (delErr: unknown) {
          logger.warn('Dev persona: could not delete non-UUID user (non-fatal)', {
            userId: oldId,
            error: delErr instanceof Error ? delErr.message : String(delErr),
          });
        }
        user = null; // Force create path below
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
        // NOSONAR: S7735 — idiomatic "create if not found, else update" pattern
        // CWE-798: Use environment variable for dev Discord ID prefix
        // NOSONAR: Hardcoded-credential FP — 'dev' is a non-secret ID prefix fallback,
        // not a password or credential. Falls back from process.env.DEV_DISCORD_ID_PREFIX.
        const devDiscordPrefix = process.env.DEV_DISCORD_ID_PREFIX ?? 'dev'; // NOSONAR
        user = await this.userService.createUser({
          id: crypto.randomUUID(),
          username,
          email,
          discordId: `${devDiscordPrefix}-${username}`,
          role,
          displayName: 'Developer',
          lastLoginAt: new Date(),
          lastLoginIp: metadata.ipAddress,
        });
      }

      await this.securityService.resetFailedAttempts(user.id);

      // Seed organizations and memberships for known dev personas
      await this.seedDevPersonaOrgs(user.id, username);

      const tokens = await this.authService.generateTokens(user, metadata);

      // CWE-1004: httpOnly cookies prevent XSS token theft
      // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      ); // NOSONAR
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

      logger.info('Development login issued', { userId: user.id, role: user.role });

      return {
        token: tokens.accessToken,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
        message: 'Development login successful. Tokens set in httpOnly cookies for this session.',
      };
    });
  };

  /**
   * Refresh token endpoint - exchanges refresh token for new access token
   * POST /api/auth/refresh
   *
   * @param req - Request with refresh token
   * @param res - Response object
   * @returns New access token and rotated refresh token
   * @throws ValidationError if refresh token missing
   * @throws ForbiddenError if refresh token invalid
   * @throws NotFoundError if user not found
   */
  public refresh = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      // Check for refresh token in cookies first, then body
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;

      if (!refreshToken) {
        this.validateRequired(req.body, 'refreshToken');
      }

      // Refresh tokens using unified AuthenticationService
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      try {
        const tokens = await this.authService.refreshTokens(refreshToken, {
          ipAddress,
          userAgent,
          sessionBinding: createSessionBinding(req),
        });

        logger.info(`Tokens refreshed successfully`);

        // Set new tokens in cookies
        // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
        res.cookie(
          COOKIE_NAMES.ACCESS_TOKEN,
          tokens.accessToken,
          getAccessTokenCookieOptions(tokens.accessToken)
        ); // NOSONAR
        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        };
      } catch (error) {
        logger.warn('Token refresh failed', { error: (error as Error).message });
        const err: Error & { name: string } = new Error('Invalid or expired refresh token');
        err.name = 'ForbiddenError';
        throw err;
      }
    });
  };

  /**
   * Logout endpoint - revokes a single refresh token
   * POST /api/auth/logout
   *
   * @param req - Authenticated request with refresh token
   * @param res - Response object
   * @returns Success message
   * @throws ValidationError if refresh token missing
   * @throws NotFoundError if token not found
   */
  public logout = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      // Check for refresh token in cookies first, then body
      const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;

      if (refreshToken) {
        // Best-effort revocation — don't fail if token is already revoked/expired
        await this.authService.revokeRefreshToken(refreshToken).catch(() => {
          logger.debug('Refresh token revocation skipped (already revoked or expired)');
        });
      }

      // Always clear cookies regardless of token state
      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions);
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearRefreshCookieOptions);
      res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, clearCsrfCookieOptions);

      logger.info(`User ${req.user?.id ?? 'unknown'} logged out`);
      return { message: 'Logged out successfully' };
    });
  };

  /**
   * Logout all devices - revokes all refresh tokens for the user
   * POST /api/auth/logout-all
   *
   * @param req - Authenticated request
   * @param res - Response object
   * @returns Success message with count of revoked tokens
   * @throws UnauthorizedError if not authenticated
   */
  public logoutAll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      // Revoke all refresh tokens for the user
      const count = await this.authService.revokeAllUserTokens(user.id);

      // Clear cookies for this device
      res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions);
      res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearRefreshCookieOptions);
      res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, clearCsrfCookieOptions);

      logger.info(`All tokens revoked for user ${user.id} (${count} tokens)`);

      return {
        message: 'Logged out from all devices successfully',
        tokensRevoked: count,
      };
    });
  };

  /**
   * Get active sessions - returns all active refresh tokens for the user
   * GET /api/auth/sessions
   *
   * @param req - Authenticated request
   * @param res - Response object
   * @returns List of active sessions
   * @throws UnauthorizedError if not authenticated
   */
  public getActiveSessions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);

      const tokens = await this.authService.getUserRefreshTokens(user.id);

      return {
        sessions: tokens.map(token => ({
          id: token.id,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
          ipAddress: token.ipAddress,
          userAgent: token.userAgent,
        })),
      };
    });
  };

  /**
   * Discord OAuth initiation endpoint - redirects user to Discord authorization
   * GET /api/auth/discord or /api/v2/auth/discord
   *
   * @param req - Request object
   * @param res - Response object
   * @returns Redirect to Discord OAuth authorization page
   * @throws UnauthorizedError if Discord service not initialized
   */
  public discordInitiate = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check if Discord service is initialized
      if (!isDiscordServiceInitialized()) {
        logger.warn('Discord OAuth initiation attempted but service not initialized');

        // Redirect to frontend with error
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=discord_not_configured`);
      }

      // Generate OAuth state for CSRF protection using HMAC-signed token
      // (cookie-based state fails because Chrome blocks third-party cookies
      // during the cross-site redirect chain: backend → Discord → backend)
      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString(36);
      const payload = `${nonce}.${timestamp}`;
      const secret = getOAuthSecret();
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const state = `${payload}.${signature}`;

      // Get Discord service and generate auth URL
      const discordService = getDiscordService();
      const authUrl = discordService.generateAuthUrl(state);

      logger.debug('Redirecting to Discord OAuth', { state });

      safeOAuthRedirect(res, authUrl, 'discord_error');
    } catch (error) {
      logger.error('Discord OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=discord_error`);
    }
  };

  /**
   * Redirect to frontend error page (GET) or throw (POST).
   */
  private handleOAuthError(
    req: Request,
    res: Response,
    errorCode: string,
    ErrorClass: new (msg: string) => Error,
    message: string
  ): void {
    if (req.method === 'GET') {
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorCode)}`);
      return;
    }
    throw new ErrorClass(message);
  }

  /**
   * Validate Discord OAuth preconditions (service init, redirect URI, code, state).
   * Returns authorization code on success, or void if response was already sent.
   */
  private validateDiscordOAuthPreconditions(req: Request, res: Response): string | undefined {
    if (!isDiscordServiceInitialized()) {
      logger.warn('Discord OAuth callback attempted but service not initialized');
      this.handleOAuthError(
        req,
        res,
        'discord_not_configured',
        UnauthorizedError,
        'Discord authentication is not available. Please contact the administrator or use an alternative login method.'
      );
      return undefined;
    }

    const oauthError = req.query.error;
    if (oauthError) {
      logger.warn('Discord OAuth error received', { error: oauthError });
      this.handleOAuthError(
        req,
        res,
        String(oauthError),
        UnauthorizedError,
        `Discord authentication failed: ${oauthError}`
      );
      return undefined;
    }

    const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
    if (!backendRedirectUri) {
      logger.error('Discord OAuth callback failed: DISCORD_REDIRECT_URI_BACKEND not configured');
      this.handleOAuthError(
        req,
        res,
        'server_config',
        ValidationError,
        'DISCORD_REDIRECT_URI_BACKEND is not configured'
      );
      return undefined;
    }

    const code = this.extractAuthorizationCode(req);
    if (!code) {
      this.handleOAuthError(req, res, 'no_code', ValidationError, 'Authorization code is required');
      return undefined;
    }

    // For GET requests, verify CSRF state via HMAC signature (no cookies needed)
    if (req.method === 'GET' && !this.validateGetRequestState(req, res)) {
      return undefined;
    }

    return code;
  }

  /**
   * Extract the authorization code from query params or body.
   */
  private extractAuthorizationCode(req: Request): string | undefined {
    const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    return ((queryCode ?? req.body.code) as string | undefined) ?? undefined;
  }

  /**
   * Validate the HMAC state parameter on GET OAuth callbacks.
   * Returns true if valid, sends redirect and returns false otherwise.
   */
  private validateGetRequestState(req: Request, res: Response): boolean {
    const queryState = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    const state = String(queryState ?? req.body.state ?? '');

    if (!validateOAuthState(state).valid) {
      logger.warn('Discord OAuth state invalid or expired');
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=invalid_state`);
      return false;
    }
    return true;
  }

  /**
   * Discord OAuth callback endpoint - exchanges code for tokens and creates/logs in user
   * Handles redirect from Discord with authorization code
   */
  public discordCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const code = this.validateDiscordOAuthPreconditions(req, res);
      if (!code) {
        return;
      } // Response already sent by validation helper

      const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND!;

      logger.debug('Discord OAuth callback starting', {
        hasCode: true,
        redirectUri: backendRedirectUri,
        method: req.method,
      });

      const discordService = getDiscordService();
      const discordTokens = await discordService.authenticateUser(code, backendRedirectUri);
      const discordUser = await discordService.getUserInfo(discordTokens.access_token);

      // Find or create user
      let user = await this.userService.getUserByDiscordId(discordUser.id);

      if (user) {
        await this.userService.updateUser(user.id, {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip ?? req.socket.remoteAddress,
        });
        logger.info(`User logged in via Discord OAuth: ${user.id}`);
      } else {
        user = await this.userService.createUser({
          id: crypto.randomUUID(),
          discordId: discordUser.id,
          username: discordUser.username,
          email: discordUser.email ?? `${discordUser.id}@noemail.discord.local`,
          displayName: discordUser.username,
          avatar: discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`
            : undefined,
          role: 'user',
          lastLoginAt: new Date(),
        });
        logger.info(`New user created via Discord OAuth: ${user.id}`);
      }

      // Generate JWT tokens
      const tokens = await this.authService.generateTokens(user, {
        ipAddress: req.ip ?? req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionBinding: createSessionBinding(req),
      });

      // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
      res.cookie(
        COOKIE_NAMES.ACCESS_TOKEN,
        tokens.accessToken,
        getAccessTokenCookieOptions(tokens.accessToken)
      ); // NOSONAR
      res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        logger.info(`Discord OAuth successful, redirecting to ${frontendUrl}/login?success=true`);
        res.redirect(`${frontendUrl}/login?success=true`);
        return;
      }

      res.status(200).json({
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          role: user.role,
        },
        message: 'Discord authentication successful',
      });
    } catch (error) {
      logger.error('Discord OAuth callback error:', error);

      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }

      await this.executeAndReturn(req, res, async () => {
        if (
          error instanceof Error &&
          (error.constructor.name === 'ValidationError' ||
            error.constructor.name === 'UnauthorizedError' ||
            error.constructor.name === 'ForbiddenError' ||
            error.constructor.name === 'NotFoundError')
        ) {
          throw error;
        }
        throw new UnauthorizedError('Discord authentication failed');
      });
    }
  };

  /**
   * CWE-918 / CWE-601: Validate redirectUri against allowed frontend origin
   * to prevent SSRF and open-redirect attacks.
   * Only the frontend origin with the /admin/login path is permitted.
   */
  private validateRedirectUri(redirectUri: string): void {
    const allowedOrigin = getFrontendUrl();
    try {
      const parsed = new URL(redirectUri);
      const allowed = new URL(allowedOrigin);
      if (parsed.origin !== allowed.origin) {
        throw new ValidationError('Redirect URI origin is not allowed');
      }
      if (parsed.pathname !== '/admin/login') {
        throw new ValidationError('Redirect URI path is not allowed');
      }
    } catch (error: unknown) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid redirect URI format');
    }
  }

  /**
   * Legacy Azure AD OAuth callback handler.
   * The public legacy route now returns HTTP 410 with migration guidance to
   * `/api/v2/auth/azuread/callback` from `routes/authRoutes.ts`.
   *
   * @param req - Request with authorization code and redirect URI
   * @param res - Response object
   * @returns Access token, refresh token, and user info
   * @throws ValidationError if code or redirectUri missing
   * @throws UnauthorizedError if authentication fails
   */
  public azureADCallback = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.body, 'code', 'redirectUri');
      const { code, redirectUri } = req.body;

      this.validateRedirectUri(redirectUri as string);

      try {
        const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
        const clientId = process.env.AZURE_AD_CLIENT_ID;
        const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          throw new ValidationError('Azure AD not configured - missing client ID or secret');
        }

        // Exchange authorization code for access token
        const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const tokenParams = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid profile email User.Read',
        });

        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenParams.toString(),
        });

        if (!tokenResponse.ok) {
          let errorMessage = 'Failed to exchange code for token';
          try {
            const errorData = (await tokenResponse.json()) as AzureADErrorResponse;
            logger.error('Azure AD token exchange failed:', errorData);
            errorMessage = errorData.error_description ?? errorData.error ?? errorMessage;
          } catch (_parseError: unknown) {
            // S2486: log the parse error so the catch block is not empty
            logger.error('Azure AD token exchange failed with non-JSON response', {
              parseError: _parseError instanceof Error ? _parseError.message : String(_parseError),
            });
          }
          throw new ValidationError(errorMessage);
        }

        const tokenData = (await tokenResponse.json()) as AzureADTokenResponse;

        // Get user info from Microsoft Graph
        const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new ValidationError('Failed to fetch user info from Microsoft Graph');
        }

        const azureUser = (await userInfoResponse.json()) as MicrosoftGraphUser;

        // Ensure we have a valid email
        const email = azureUser.mail ?? azureUser.userPrincipalName;
        if (!email) {
          throw new ValidationError('Azure AD user has no email address');
        }

        // Find or create user
        let user = await this.userService.getUserByEmail(email);

        if (user) {
          // Update last login time and ensure admin role
          await this.userService.updateUser(user.id, {
            lastLoginAt: new Date(),
            lastLoginIp: req.ip ?? req.socket.remoteAddress,
            role: 'admin', // Ensure Azure AD users have admin role
          });

          logger.info(`Admin user logged in via Azure AD OAuth: ${user.id}`);
        } else {
          // NOSONAR: S7735 — idiomatic "create if not found, else update" pattern
          // Create new admin user from Azure AD info
          // Generate username from userPrincipalName or displayName with proper null checking
          const username =
            azureUser.userPrincipalName?.split('@')[0] ??
            azureUser.displayName?.replaceAll(/\s+/g, '').toLowerCase() ??
            `admin_${crypto.randomUUID().substring(0, 8)}`;

          user = await this.userService.createUser({
            id: crypto.randomUUID(),
            discordId: `azuread:${azureUser.id}`, // Store Azure AD ID with prefix
            username,
            email,
            displayName: azureUser.displayName,
            role: 'admin', // Azure AD users get admin role by default
            lastLoginAt: new Date(),
          });

          logger.info(`New admin user created via Azure AD OAuth: ${user.id}`);
        }

        // Generate JWT tokens
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        const tokens = await this.authService.generateTokens(user, {
          ipAddress,
          userAgent,
          sessionBinding: createSessionBinding(req),
        });

        // Set httpOnly cookies for tokens (reduces XSS risk)
        // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
        res.cookie(
          COOKIE_NAMES.ACCESS_TOKEN,
          tokens.accessToken,
          getAccessTokenCookieOptions(tokens.accessToken)
        ); // NOSONAR
        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

        return {
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
        };
      } catch (error) {
        logger.error('Azure AD OAuth callback error:', error);
        throw new UnauthorizedError('Azure AD authentication failed');
      }
    });
  };

  // ==================== SHARED OAUTH HELPERS ====================

  /**
   * Validate generic OAuth callback preconditions (config, error, code, state).
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
        UnauthorizedError,
        `${providerName} authentication is not available.`
      );
      return undefined;
    }

    const oauthError = req.query.error;
    if (oauthError) {
      this.handleOAuthError(
        req,
        res,
        String(oauthError),
        UnauthorizedError,
        `${providerName} authentication failed: ${oauthError}`
      );
      return undefined;
    }

    const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    const code = (queryCode ?? req.body.code) as string | undefined;
    if (!code) {
      this.handleOAuthError(req, res, 'no_code', ValidationError, 'Authorization code is required');
      return undefined;
    }

    // Validate HMAC state for CSRF protection (all methods)
    const queryState = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
    const state = String(queryState ?? req.body.state ?? '');
    const stateResult = validateOAuthState(state);
    if (!stateResult.valid) {
      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=invalid_state`);
      } else {
        res.status(403).json({ error: 'Invalid or expired OAuth state' });
      }
      return undefined;
    }

    return { code, linkUserId: stateResult.linkUserId };
  }

  /**
   * Resolve the authenticated user for account linking.
   * Checks state-embedded userId first (survives cross-site redirect),
   * then falls back to cookie/header-based session detection.
   */
  private async resolveExistingSessionUser(
    req: Request,
    linkUserId?: string
  ): Promise<User | null> {
    // Prefer state-embedded userId (survives cross-site redirect)
    if (linkUserId) {
      const user = await this.userService.getUserById(linkUserId);
      if (user) {
        logger.debug('Resolved linking user from OAuth state', { linkUserId });
        return user;
      }
    }

    // Fall back to cookie-based session (may be stripped by browser)
    try {
      const accessToken =
        req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ??
        req.headers.authorization?.replace('Bearer ', '');
      if (accessToken) {
        const decoded = await this.authService.validateAccessToken(accessToken);
        if (decoded?.id) {
          return await this.userService.getUserById(decoded.id);
        }
      }
    } catch {
      // Token invalid/expired — not authenticated
    }

    return null;
  }

  /**
   * Handle the "user not found by provider ID" branch of an OAuth callback.
   * Covers: session-based linking, duplicate-provider check, email-match auto-link, and new account creation.
   * Extracted to reduce cognitive complexity of individual provider callbacks.
   */
  private async resolveOrCreateOAuthUser(
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
    const existingSessionUser = await this.resolveExistingSessionUser(req, opts.linkUserId);

    if (existingSessionUser) {
      // Prevent linking if this provider ID is already linked to another user
      const existingByProvider = await opts.lookupByProviderId();
      if (existingByProvider && existingByProvider.id !== existingSessionUser.id) {
        logger.warn(`${opts.providerName} account already linked to another user`, {
          providerId: opts.providerId,
          targetUser: existingSessionUser.id,
        });
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/settings?error=account_already_linked`);
        return null;
      }

      await this.userService.updateUser(existingSessionUser.id, {
        [opts.providerIdField]: opts.providerId,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip ?? req.socket.remoteAddress,
      });
      logger.info(
        `Linked ${opts.providerName} account to authenticated user: ${existingSessionUser.id}`
      );
      return existingSessionUser;
    }

    // Not authenticated — check email match for auto-linking
    const existingByEmail = opts.email ? await this.userService.getUserByEmail(opts.email) : null;

    if (existingByEmail) {
      await this.userService.updateUser(existingByEmail.id, {
        [opts.providerIdField]: opts.providerId,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip ?? req.socket.remoteAddress,
      });
      logger.info(
        `Linked ${opts.providerName} account to existing user by email: ${existingByEmail.id}`
      );
      return existingByEmail;
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
    return user;
  }

  /**
   * Generate JWT tokens for user, set cookies, and send response.
   * Handles both GET (redirect) and POST (JSON) responses.
   */
  private async completeOAuthLogin(
    req: Request,
    res: Response,
    user: User,
    providerName: string
  ): Promise<void> {
    const tokens = await this.authService.generateTokens(user, {
      ipAddress: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionBinding: createSessionBinding(req),
    });

    // NOSONAR: CWE-1004/CWE-614 FP — options from config/cookies.ts set httpOnly: true, secure: true
    res.cookie(
      COOKIE_NAMES.ACCESS_TOKEN,
      tokens.accessToken,
      getAccessTokenCookieOptions(tokens.accessToken)
    ); // NOSONAR
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, refreshTokenCookieOptions); // NOSONAR

    // Record login event for login history
    void this.accessLogService.logAccess(
      user.id,
      user.id,
      user.activeOrgId ?? undefined,
      `login:${providerName.toLowerCase()}`,
      req.ip ?? req.socket.remoteAddress,
      req.headers['user-agent']
    );

    if (req.method === 'GET') {
      const frontendUrl = getFrontendUrl();
      logger.info(
        `${providerName} OAuth successful, redirecting to ${frontendUrl}/login?success=true`
      );
      res.redirect(`${frontendUrl}/login?success=true`);
      return;
    }

    res.status(200).json({
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

  // ==================== GOOGLE OAUTH ====================

  /**
   * Google OAuth initiation endpoint - redirects user to Google authorization
   * GET /api/v2/auth/google
   */
  public googleInitiate = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isGoogleOAuthConfigured()) {
        logger.warn('Google OAuth initiation attempted but not configured');
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
      }

      // Generate neutral OAuth state for CSRF protection.
      // Account linking still resolves from callback-time authenticated session.
      const state = generateOAuthState();
      const googleService = getGoogleOAuthService();
      const authUrl = googleService.generateAuthUrl(state);
      logger.debug('Redirecting to Google OAuth');
      safeOAuthRedirect(res, authUrl, 'google_error');
    } catch (error) {
      logger.error('Google OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=google_error`);
    }
  };

  /**
   * Google OAuth callback endpoint - exchanges code for tokens and creates/logs in user
   * GET/POST /api/v2/auth/google/callback
   */
  public googleCallback = async (req: Request, res: Response): Promise<void> => {
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

      // Find or create user
      let user = await this.userService.getUserByGoogleId(googleUser.id);

      if (user) {
        await this.userService.updateUser(user.id, {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip ?? req.socket.remoteAddress,
        });
        logger.info(`User logged in via Google OAuth: ${user.id}`);
      } else {
        user = await this.resolveOrCreateOAuthUser(req, res, {
          linkUserId,
          providerName: 'Google',
          providerId: googleUser.id,
          providerIdField: 'googleId',
          email: googleUser.email,
          username:
            googleUser.email.split('@')[0] ?? `google_${crypto.randomUUID().substring(0, 8)}`,
          displayName: googleUser.name,
          avatar: googleUser.picture ?? undefined,
          lookupByProviderId: () => this.userService.getUserByGoogleId(googleUser.id),
        });
        if (!user) {
          return; // redirect was sent (duplicate link)
        }
      }

      await this.completeOAuthLogin(req, res, user, 'Google');
    } catch (error) {
      logger.error('Google OAuth callback error:', error);

      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }

      await this.executeAndReturn(req, res, async () => {
        if (
          error instanceof Error &&
          (error.constructor.name === 'ValidationError' ||
            error.constructor.name === 'UnauthorizedError')
        ) {
          throw error;
        }
        throw new UnauthorizedError('Google authentication failed');
      });
    }
  };

  /**
   * Link Google account to an existing authenticated user
   * POST /api/v2/auth/google/link
   */
  public googleLink = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.body, 'code');
      const { code } = req.body;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const googleService = getGoogleOAuthService();
      const googleTokens = await googleService.authenticateUser(code);
      const googleUser = await googleService.getUserInfo(googleTokens.access_token);

      // Ensure no other user already has this Google ID
      const existing = await this.userService.getUserByGoogleId(googleUser.id);
      if (existing && existing.id !== userId) {
        throw new ValidationError('This Google account is already linked to another user');
      }

      await this.userService.updateUser(userId, { googleId: googleUser.id });
      logger.info(`User ${userId} linked Google account ${googleUser.id}`);

      return {
        message: 'Google account linked successfully',
        provider: 'google',
        providerId: googleUser.id,
      };
    });
  };

  // ==================== TWITCH OAUTH ====================

  /**
   * Twitch OAuth initiation endpoint - redirects user to Twitch authorization
   * GET /api/v2/auth/twitch
   */
  public twitchInitiate = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isTwitchOAuthConfigured()) {
        logger.warn('Twitch OAuth initiation attempted but not configured');
        const frontendUrl = getFrontendUrl();
        return res.redirect(`${frontendUrl}/login?error=twitch_not_configured`);
      }

      // Generate neutral OAuth state for CSRF protection.
      // Account linking still resolves from callback-time authenticated session.
      const state = generateOAuthState();
      const twitchService = getTwitchOAuthService();
      const authUrl = twitchService.generateAuthUrl(state);
      logger.debug('Redirecting to Twitch OAuth');
      safeOAuthRedirect(res, authUrl, 'twitch_error');
    } catch (error) {
      logger.error('Twitch OAuth initiation error:', error);
      const frontendUrl = getFrontendUrl();
      res.redirect(`${frontendUrl}/login?error=twitch_error`);
    }
  };

  /**
   * Twitch OAuth callback endpoint - exchanges code for tokens and creates/logs in user
   * GET/POST /api/v2/auth/twitch/callback
   */
  public twitchCallback = async (req: Request, res: Response): Promise<void> => {
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

      // Find or create user
      let user = await this.userService.getUserByTwitchId(twitchUser.id);

      if (user) {
        await this.userService.updateUser(user.id, {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip ?? req.socket.remoteAddress,
        });
        logger.info(`User logged in via Twitch OAuth: ${user.id}`);
      } else {
        user = await this.resolveOrCreateOAuthUser(req, res, {
          linkUserId,
          providerName: 'Twitch',
          providerId: twitchUser.id,
          providerIdField: 'twitchId',
          email: twitchUser.email,
          username: twitchUser.login ?? `twitch_${crypto.randomUUID().substring(0, 8)}`,
          displayName: twitchUser.display_name,
          avatar: twitchUser.profile_image_url ?? undefined,
          lookupByProviderId: () => this.userService.getUserByTwitchId(twitchUser.id),
        });
        if (!user) {
          return; // redirect was sent (duplicate link)
        }
      }

      await this.completeOAuthLogin(req, res, user, 'Twitch');
    } catch (error) {
      logger.error('Twitch OAuth callback error:', error);

      if (req.method === 'GET') {
        const frontendUrl = getFrontendUrl();
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }

      await this.executeAndReturn(req, res, async () => {
        if (
          error instanceof Error &&
          (error.constructor.name === 'ValidationError' ||
            error.constructor.name === 'UnauthorizedError')
        ) {
          throw error;
        }
        throw new UnauthorizedError('Twitch authentication failed');
      });
    }
  };

  /**
   * Link Twitch account to an existing authenticated user
   * POST /api/v2/auth/twitch/link
   */
  public twitchLink = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.validateRequired(req.body, 'code');
      const { code } = req.body;
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const twitchService = getTwitchOAuthService();
      const twitchTokens = await twitchService.authenticateUser(code);
      const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);

      // Ensure no other user already has this Twitch ID
      const existing = await this.userService.getUserByTwitchId(twitchUser.id);
      if (existing && existing.id !== userId) {
        throw new ValidationError('This Twitch account is already linked to another user');
      }

      await this.userService.updateUser(userId, { twitchId: twitchUser.id });
      logger.info(`User ${userId} linked Twitch account ${twitchUser.id}`);

      return {
        message: 'Twitch account linked successfully',
        provider: 'twitch',
        providerId: twitchUser.id,
      };
    });
  };
}
