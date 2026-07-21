import crypto from 'crypto';

import jwt from 'jsonwebtoken';
import NodeCache from 'node-cache';
import { MoreThan, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { SessionBinding } from '../../middleware/sessionBinding';
import { RefreshToken } from '../../models/RefreshToken';
import { TokenBlacklist } from '../../models/TokenBlacklist';
import { User } from '../../models/User';
import { UserSession } from '../../models/UserSession';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { getTokenEncryptionService } from '../security';

/**
 * Token pair returned from authentication operations
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Decoded JWT payload
 */
export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  jti: string;
  iat: number;
  exp: number;
  sessionBinding?: SessionBinding;
}

/**
 * Session metadata for tracking
 */
export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  sessionBinding?: SessionBinding;
}

/**
 * Session information returned to client
 */
export interface SessionInfo {
  id: number;
  sessionToken: string;
  userId: number;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

/**
 * Refresh token information
 */
export interface RefreshTokenInfo {
  id: string;
  familyId: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Configuration for authentication service
 */
export interface AuthConfig {
  // Access token configuration
  accessTokenSecret: string;
  accessTokenExpiry: string; // e.g., '15m'

  // Refresh token configuration
  refreshTokenExpiryDays: number; // e.g., 7

  // Session configuration
  sessionAbsoluteTimeout: number; // in ms, e.g., 7 days
  sessionIdleTimeout: number; // in ms, e.g., 2 hours

  // Blacklist cache configuration
  blacklistCacheTTL: number; // in seconds
  blacklistCacheCheckPeriod: number; // in seconds
}

/**
 * AuthenticationService
 *
 * Unified authentication service that consolidates:
 * - Token generation and validation (JWT)
 * - Refresh token lifecycle management
 * - Session management
 * - Token blacklist management
 * - Security breach detection
 *
 * This service replaces the following legacy services:
 * - RefreshTokenService
 * - SessionService
 * - JwtBlacklistService
 *
 * @see PHASE3_PHASE4_OPTIONAL_ROADMAP.md for consolidation details
 */
export class AuthenticationService {
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly sessionRepository: Repository<UserSession>;
  private readonly blacklistRepository: Repository<TokenBlacklist>;
  private readonly userRepository: Repository<User>;
  private encryptionService;
  private readonly blacklistCache: NodeCache;
  private readonly config: AuthConfig;

  // Development-only: dynamically generated secret (regenerated on each server start)
  private static devAccessTokenSecret: string | null = null;
  // Track if we've already logged the development secret warning
  private static devSecretWarningLogged = false;

  constructor() {
    this.refreshTokenRepository = AppDataSource.getRepository(RefreshToken);
    this.sessionRepository = AppDataSource.getRepository(UserSession);
    this.blacklistRepository = AppDataSource.getRepository(TokenBlacklist);
    this.userRepository = AppDataSource.getRepository(User);
    this.encryptionService = getTokenEncryptionService();

    // Initialize configuration
    this.config = {
      accessTokenSecret: this.getAccessTokenSecret(),
      accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '1h',
      refreshTokenExpiryDays: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7'),
      sessionAbsoluteTimeout: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '604800000'), // 7 days
      sessionIdleTimeout: parseInt(process.env.SESSION_IDLE_TIMEOUT || '14400000'), // 4 hours
      blacklistCacheTTL: parseInt(process.env.BLACKLIST_CACHE_TTL || '3600'), // 1 hour
      blacklistCacheCheckPeriod: parseInt(process.env.BLACKLIST_CACHE_CHECK_PERIOD || '600'), // 10 minutes
    };

    // Initialize blacklist cache
    this.blacklistCache = new NodeCache({
      stdTTL: this.config.blacklistCacheTTL,
      checkperiod: this.config.blacklistCacheCheckPeriod,
      useClones: false,
    });

    logger.info('AuthenticationService initialized', {
      accessTokenExpiry: this.config.accessTokenExpiry,
      refreshTokenExpiryDays: this.config.refreshTokenExpiryDays,
      sessionAbsoluteTimeout: `${this.config.sessionAbsoluteTimeout / 1000 / 60 / 60} hours`,
      sessionIdleTimeout: `${this.config.sessionIdleTimeout / 1000 / 60} minutes`,
      blacklistCacheTTL: `${this.config.blacklistCacheTTL}s`,
    });
  }

  /**
   * Get access token secret with proper fallback for development
   *
   * Security Warning: In development mode, if JWT_SECRET is not set,
   * a random secret is generated. This is INSECURE because:
   * 1. The secret changes on each server restart
   * 2. All existing tokens become invalid
   * 3. No persistence across deployments
   *
   * For production: Always set JWT_SECRET via environment variable or secrets manager.
   */
  private getAccessTokenSecret(): string {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret) {
      return envSecret;
    }

    // In production, fail fast
    if (process.env.NODE_ENV === 'production') {
      throw new ValidationError('JWT_SECRET is required in production environment');
    }

    // Generate a random secret for this dev session (not hardcoded)
    if (!AuthenticationService.devAccessTokenSecret) {
      AuthenticationService.devAccessTokenSecret = crypto.randomBytes(32).toString('hex');
      // Log a more explicit warning only once
      if (!AuthenticationService.devSecretWarningLogged) {
        AuthenticationService.devSecretWarningLogged = true;
        logger.warn('⚠️  SECURITY WARNING: JWT_SECRET environment variable not set!');
        logger.warn(
          '⚠️  Generated random development JWT secret (this is INSECURE and not persistent)'
        );
        logger.warn('⚠️  All tokens will be invalidated on server restart');
        logger.warn(
          '⚠️  To fix: Set JWT_SECRET environment variable with a secure 32+ character value'
        );
      }
    }
    return AuthenticationService.devAccessTokenSecret;
  }

  // ========================================
  // TOKEN GENERATION AND VALIDATION
  // ========================================

  /**
   * Generate a standalone access token (JWT) for a given payload.
   * This is the single source of truth for JWT signing — all token
   * generation MUST go through this method to guarantee a consistent secret.
   * @param payload - Object with id, username, and role
   * @param sessionBinding - Optional session binding for token-to-device binding
   * @returns Signed JWT string
   */
  generateAccessToken(
    payload: { id: string; username: string; role: string },
    sessionBinding?: SessionBinding
  ): string {
    const jti = crypto.randomUUID();
    const fullPayload: Record<string, unknown> = { ...payload };

    // Include session binding for token-to-device binding (ZT-03)
    if (sessionBinding) {
      fullPayload.sessionBinding = sessionBinding;
    }

    return jwt.sign(fullPayload, this.config.accessTokenSecret, {
      algorithm: 'HS256',
      expiresIn: this.config.accessTokenExpiry,
      jwtid: jti,
    } as jwt.SignOptions);
  }

  /**
   * Generate access token (JWT) and refresh token pair
   * @param user - User object with id, username, and role
   * @param metadata - Optional session metadata (IP, user agent, location)
   * @returns Token pair with access token and refresh token
   */
  async generateTokens(user: User, metadata?: SessionMetadata): Promise<AuthTokens> {
    // Generate JWT access token using single source of truth
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    // Route through generateAccessToken for consistency
    const accessToken = this.generateAccessToken(payload, metadata?.sessionBinding);

    // Generate refresh token
    const { token: refreshToken } = await this.generateRefreshToken(
      user.id,
      metadata?.ipAddress,
      metadata?.userAgent,
      undefined,
      metadata?.location
    );

    // Calculate expiry in seconds
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;
    const expiresIn = (decoded.exp as number) - (decoded.iat as number);

    logger.info('Token pair generated', {
      userId: user.id,
      jti: decoded.jti,
      expiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Validate and decode access token
   * @param token - JWT access token string
   * @returns Decoded token payload
   * @throws Error if token is invalid, expired, or blacklisted
   */
  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      // Verify JWT signature and expiration. Pin the algorithm allowlist to the
      // symmetric HS256 strategy (SEC-05) so a token presented with any other `alg`
      // (algorithm-confusion / CWE-347) is rejected outright.
      const decoded = jwt.verify(token, this.config.accessTokenSecret, {
        algorithms: ['HS256'],
      }) as TokenPayload;

      // Check if token is blacklisted
      if (await this.isTokenBlacklisted(decoded.jti)) {
        throw new UnauthorizedError('Token has been revoked');
      }

      return decoded;
    } catch (error: unknown) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * Implements token rotation for security
   * @param refreshToken - Current refresh token
   * @param metadata - Optional session metadata
   * @returns New token pair
   * @throws Error if refresh token is invalid or reused (security breach)
   */
  async refreshTokens(refreshToken: string, metadata?: SessionMetadata): Promise<AuthTokens> {
    // Rotate refresh token
    const rotationResult = await this.rotateRefreshToken(
      refreshToken,
      metadata?.ipAddress,
      metadata?.userAgent,
      metadata?.location
    );

    if (!rotationResult) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const { token: newRefreshToken, refreshTokenRecord } = rotationResult;

    // Get user info from refresh token
    const userId = refreshTokenRecord.userId;

    // Fetch actual user data from database for accurate JWT payload
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User');
    }

    // Generate new access token using centralized method
    const payload = {
      id: userId,
      username: user.username,
      role: user.role,
    };

    // Route through generateAccessToken for consistency
    const accessToken = this.generateAccessToken(payload, metadata?.sessionBinding);

    const decoded = jwt.decode(accessToken) as Record<string, unknown>;
    const expiresIn = (decoded.exp as number) - (decoded.iat as number);

    logger.info('Tokens refreshed', {
      userId,
      jti: decoded.jti,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  }

  /**
   * Revoke an access token by adding to blacklist
   * @param token - JWT access token to revoke
   * @param reason - Optional reason for revocation
   * @param metadata - Optional session metadata
   */
  async revokeAccessToken(
    token: string,
    reason?: string,
    metadata?: SessionMetadata
  ): Promise<void> {
    try {
      // Decode token to extract JTI and expiration
      const decoded = jwt.decode(token) as Record<string, unknown> | null;

      if (!decoded?.jti) {
        throw new ValidationError('Invalid token format');
      }

      const jti = decoded.jti as string;

      // Check if already blacklisted
      if (await this.isTokenBlacklisted(jti)) {
        logger.debug('Token already blacklisted', { jti });
        return;
      }

      // Calculate expiration
      const expiresAt = new Date((decoded.exp as number) * 1000);

      // Add to blacklist database
      const blacklistEntry = this.blacklistRepository.create({
        tokenJti: jti,
        userId: decoded.sub as string,
        expiresAt,
        reason: reason || 'User logout',
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      });

      await this.blacklistRepository.save(blacklistEntry);

      // Add to cache for fast lookup
      this.blacklistCache.set(jti, true, this.config.blacklistCacheTTL);

      logger.info('Access token revoked', {
        jti,
        reason,
        expiresAt,
      });
    } catch (error: unknown) {
      logger.error('Failed to revoke access token', { error });
      throw error;
    }
  }

  /**
   * Check if token is blacklisted
   * Uses in-memory cache for performance
   * @param jti - JWT ID to check
   * @returns True if blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    // Check cache first
    const cached = this.blacklistCache.get<boolean>(jti);
    if (cached !== undefined) {
      return cached;
    }

    // Check database
    const blacklisted = await this.blacklistRepository.findOne({
      where: { tokenJti: jti },
    });

    const isBlacklisted = !!blacklisted;

    // Cache result
    this.blacklistCache.set(jti, isBlacklisted, this.config.blacklistCacheTTL);

    return isBlacklisted;
  }

  // ========================================
  // REFRESH TOKEN MANAGEMENT
  // ========================================

  /**
   * Generate a new refresh token for a user
   * Enhanced with encryption and family tracking
   * @param userId - User ID
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   * @param parentToken - Optional parent token for rotation
   * @param location - Optional location
   * @returns Token string and database record
   */
  async generateRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    parentToken?: RefreshToken,
    location?: string
  ): Promise<{ token: string; refreshTokenRecord: RefreshToken }> {
    // Generate a random token
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(token);

    // Encrypt token for storage
    const { encrypted, iv, authTag } = this.encryptionService.encrypt(token);

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.refreshTokenExpiryDays);

    // Determine family ID (inherit from parent or create new)
    const familyId = parentToken?.familyId || crypto.randomUUID();

    // Create refresh token record with enhanced security
    const refreshTokenRecord = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      tokenEncrypted: encrypted,
      encryptionIv: iv,
      encryptionAuthTag: authTag,
      familyId,
      parentTokenId: parentToken?.id,
      expiresAt,
      ipAddress,
      userAgent,
      location,
      revoked: false,
    });

    await this.refreshTokenRepository.save(refreshTokenRecord);

    logger.info('Refresh token generated', {
      userId,
      familyId,
      hasParent: !!parentToken,
    });

    return { token, refreshTokenRecord };
  }

  /**
   * Verify a refresh token and return the associated record
   * @param token - Refresh token string
   * @returns RefreshToken record or null if invalid
   */
  async verifyRefreshToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(token);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!refreshToken) {
      return null;
    }

    // Check if token is revoked
    if (refreshToken.revoked) {
      return null;
    }

    // Check if token is expired
    if (new Date() > refreshToken.expiresAt) {
      return null;
    }

    return refreshToken;
  }

  /**
   * Rotate refresh token (create new token and revoke old one)
   * Enhanced with breach detection via token family tracking
   * @param oldToken - Current refresh token
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent
   * @param location - Optional location
   * @returns New token pair or null if invalid
   * @throws Error if token reuse detected (security breach)
   */
  async rotateRefreshToken(
    oldToken: string,
    ipAddress?: string,
    userAgent?: string,
    location?: string
  ): Promise<{ token: string; refreshTokenRecord: RefreshToken } | null> {
    const tokenHash = this.hashToken(oldToken);

    // First, fetch token WITHOUT filtering by revoked status (for breach detection)
    const oldRefreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!oldRefreshToken) {
      return null;
    }

    // BREACH DETECTION: Check if token was already used (revoked)
    // If a revoked token is presented, it means someone tried to reuse it
    // This is a security breach - revoke the entire token family
    if (oldRefreshToken.revoked && oldRefreshToken.familyId) {
      logger.error('Token reuse detected - possible security breach!', {
        userId: oldRefreshToken.userId,
        familyId: oldRefreshToken.familyId,
        tokenId: oldRefreshToken.id,
        ipAddress,
      });

      // Revoke entire token family
      await this.revokeTokenFamily(oldRefreshToken.familyId);

      throw new ForbiddenError(
        'Token reuse detected - all tokens in family have been revoked for security'
      );
    }

    // Check if token is expired
    if (new Date() > oldRefreshToken.expiresAt) {
      return null;
    }

    // Update last used timestamp
    oldRefreshToken.lastUsedAt = new Date();

    // Generate new token (part of same family)
    const { token: newToken, refreshTokenRecord: newRefreshToken } =
      await this.generateRefreshToken(
        oldRefreshToken.userId,
        ipAddress,
        userAgent,
        oldRefreshToken,
        location
      );

    // Revoke old token
    oldRefreshToken.revoked = true;
    oldRefreshToken.revokedAt = new Date();
    oldRefreshToken.replacedByToken = newRefreshToken.id;
    await this.refreshTokenRepository.save(oldRefreshToken);

    logger.info('Refresh token rotated', {
      userId: oldRefreshToken.userId,
      familyId: oldRefreshToken.familyId,
      oldTokenId: oldRefreshToken.id,
      newTokenId: newRefreshToken.id,
    });

    return { token: newToken, refreshTokenRecord: newRefreshToken };
  }

  /**
   * Revoke entire token family (used when breach is detected)
   * @param familyId - Token family ID
   * @returns Number of tokens revoked
   */
  async revokeTokenFamily(familyId: string): Promise<number> {
    const result = await this.refreshTokenRepository.update(
      { familyId, revoked: false },
      { revoked: true, revokedAt: new Date() }
    );

    const revokedCount = result.affected || 0;

    logger.warn('Token family revoked due to breach detection', {
      familyId,
      revokedCount,
    });

    logAuditEvent({
      eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
      resource: 'auth.tokenFamily',
      action: 'revoke_family',
      message: `Token family revoked (breach detection): familyId=${familyId}, count=${revokedCount}`,
      metadata: { familyId, revokedCount },
    });

    return revokedCount;
  }

  /**
   * Revoke a single refresh token
   * @param token - Refresh token string
   * @returns True if revoked, false if not found
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!refreshToken || refreshToken.revoked) {
      return false;
    }

    refreshToken.revoked = true;
    refreshToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(refreshToken);

    logger.info('Refresh token revoked', {
      userId: refreshToken.userId,
      tokenId: refreshToken.id,
    });

    return true;
  }

  /**
   * Revoke a refresh token by ID with user ownership validation
   * @param tokenId - Refresh token ID (UUID)
   * @param userId - User ID (for ownership validation)
   * @returns True if revoked, false if not found or not owned by user
   */
  async revokeRefreshTokenById(tokenId: string, userId: string): Promise<boolean> {
    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { id: tokenId, userId },
    });

    if (!refreshToken || refreshToken.revoked) {
      return false;
    }

    refreshToken.revoked = true;
    refreshToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(refreshToken);

    logger.info('Refresh token revoked by ID', {
      userId,
      tokenId,
    });

    return true;
  }

  /**
   * Revoke all refresh tokens for a user
   * @param userId - User ID
   * @returns Number of tokens revoked
   */
  async revokeAllUserTokens(userId: string): Promise<number> {
    const result = await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true, revokedAt: new Date() }
    );

    const revokedCount = result.affected || 0;

    logger.info('All user refresh tokens revoked', {
      userId,
      revokedCount,
    });

    return revokedCount;
  }

  /**
   * Get all active refresh tokens for a user
   * @param userId - User ID
   * @returns Array of active refresh token records
   */
  async getUserRefreshTokens(userId: string): Promise<RefreshTokenInfo[]> {
    const tokens = await this.refreshTokenRepository.find({
      where: { userId, revoked: false, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });

    return tokens.map(token => ({
      id: token.id, // UUID string - no coercion needed
      familyId: token.familyId || '',
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
    }));
  }

  /**
   * Detect token reuse (security breach indicator)
   * @param token - Refresh token to check
   * @returns True if reuse detected
   */
  async detectTokenReuse(token: string): Promise<boolean> {
    const refreshToken = await this.verifyRefreshToken(token);
    return refreshToken?.revoked || false;
  }

  // ========================================
  // SESSION MANAGEMENT
  // ========================================

  /**
   * Create new user session
   * @param userId - User ID
   * @param sessionToken - Session token string
   * @param discordTokens - Discord OAuth tokens
   * @param metadata - Optional session metadata
   * @returns Created session record
   */
  async createSession(
    userId: number,
    sessionToken: string,
    discordTokens: { access_token: string; refresh_token: string; expires_in: number },
    metadata?: SessionMetadata
  ): Promise<UserSession> {
    const now = new Date();
    const session = this.sessionRepository.create({
      userId,
      sessionToken,
      discordAccessToken: discordTokens.access_token,
      discordRefreshToken: discordTokens.refresh_token,
      discordTokenExpiry: new Date(now.getTime() + discordTokens.expires_in * 1000),
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.config.sessionAbsoluteTimeout),
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    });

    await this.sessionRepository.save(session);

    logger.info('Session created', {
      userId,
      sessionToken: `${sessionToken.substring(0, 10)}...`,
      expiresAt: session.expiresAt,
    });

    logAuditEvent({
      eventType: AuditEventType.AUTH_SUCCESS,
      userId: String(userId),
      resource: 'auth.session',
      action: 'create',
      message: `Session created for user ${userId}`,
      metadata: { ipAddress: metadata?.ipAddress, userAgent: metadata?.userAgent },
    });

    return session;
  }

  /**
   * Get session by token
   * @param sessionToken - Session token string
   * @returns Session record or null if not found
   */
  async getSession(sessionToken: string): Promise<UserSession | null> {
    return this.sessionRepository.findOne({
      where: { sessionToken, isActive: true },
    });
  }

  /**
   * Get all active sessions for a user
   * @param userId - User ID
   * @returns Array of active session records
   */
  async getUserSessions(userId: number): Promise<SessionInfo[]> {
    const sessions = await this.sessionRepository.find({
      where: { userId, isActive: true },
      order: { lastActivity: 'DESC' },
    });

    return sessions.map(session => ({
      id: session.id,
      sessionToken: session.sessionToken,
      userId: session.userId,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive,
    }));
  }

  /**
   * Update session activity timestamp
   * @param sessionToken - Session token string
   */
  async updateActivity(sessionToken: string): Promise<void> {
    const session = await this.getSession(sessionToken);
    if (session) {
      session.lastActivity = new Date();
      await this.sessionRepository.save(session);
    }
  }

  /**
   * Update Discord tokens in session
   * @param sessionToken - Session token string
   * @param accessToken - New Discord access token
   * @param refreshToken - New Discord refresh token
   * @param expiresIn - Token expiration in seconds
   */
  async updateDiscordTokens(
    sessionToken: string,
    accessToken: string,
    refreshToken: string,
    expiresIn: number
  ): Promise<void> {
    const session = await this.getSession(sessionToken);
    if (session) {
      session.discordAccessToken = accessToken;
      session.discordRefreshToken = refreshToken;
      session.discordTokenExpiry = new Date(Date.now() + expiresIn * 1000);
      await this.sessionRepository.save(session);

      logger.info('Discord tokens updated in session', {
        sessionToken: `${sessionToken.substring(0, 10)}...`,
      });
    }
  }

  /**
   * Check if session is valid (not expired)
   * @param session - Session record
   * @returns True if valid
   */
  isSessionValid(session: UserSession): boolean {
    const now = new Date();

    // Check absolute timeout
    if (session.expiresAt < now) {
      logger.info('Session expired (absolute timeout)', {
        sessionToken: `${session.sessionToken.substring(0, 10)}...`,
        expiresAt: session.expiresAt,
      });
      return false;
    }

    // Check idle timeout
    const idleTime = now.getTime() - session.lastActivity.getTime();
    if (idleTime > this.config.sessionIdleTimeout) {
      logger.info('Session expired (idle timeout)', {
        sessionToken: `${session.sessionToken.substring(0, 10)}...`,
        idleMinutes: Math.round(idleTime / 1000 / 60),
      });
      return false;
    }

    return true;
  }

  /**
   * Terminate a single session
   * @param sessionToken - Session token string
   */
  async terminateSession(sessionToken: string): Promise<void> {
    await this.sessionRepository.update({ sessionToken }, { isActive: false });

    logger.info('Session terminated', {
      sessionToken: `${sessionToken.substring(0, 10)}...`,
    });
  }

  /**
   * Terminate a session by ID with user ownership validation
   * @param sessionId - Session ID
   * @param userId - User ID (for ownership validation)
   * @returns True if terminated, false if not found or not owned by user
   */
  async terminateSessionById(sessionId: number, userId: number): Promise<boolean> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId, isActive: true },
    });

    if (!session) {
      return false;
    }

    session.isActive = false;
    await this.sessionRepository.save(session);

    logger.info('Session terminated by ID', {
      userId,
      sessionId,
    });

    return true;
  }

  /**
   * Terminate all sessions for a user
   * @param userId - User ID
   * @returns Number of sessions terminated
   */
  async terminateAllUserSessions(userId: number): Promise<number> {
    const result = await this.sessionRepository.update(
      { userId, isActive: true },
      { isActive: false }
    );

    const terminatedCount = result.affected || 0;

    logger.info('All user sessions terminated', {
      userId,
      terminatedCount,
    });

    return terminatedCount;
  }

  // ========================================
  // CLEANUP AND MAINTENANCE
  // ========================================

  /**
   * Clean up expired refresh tokens (run as scheduled job)
   * @returns Number of tokens cleaned up
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await this.refreshTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now })
      .execute();

    const cleanedCount = result.affected || 0;

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired refresh tokens', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Clean up expired sessions (run as scheduled job)
   * @returns Number of sessions cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const idleThreshold = new Date(now.getTime() - this.config.sessionIdleTimeout);

    const result = await this.sessionRepository
      .createQueryBuilder()
      .update()
      .set({ isActive: false })
      .where('isActive = :isActive', { isActive: true })
      .andWhere('(expiresAt < :now OR lastActivity < :idleThreshold)', { now, idleThreshold })
      .execute();

    const cleanedCount = result.affected || 0;

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Clean up expired blacklist entries (run as scheduled job)
   * @returns Number of entries cleaned up
   */
  async cleanupExpiredBlacklist(): Promise<number> {
    const now = new Date();
    const result = await this.blacklistRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now })
      .execute();

    const cleanedCount = result.affected || 0;

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired blacklist entries', { count: cleanedCount });
      // Clear cache to prevent stale data
      this.blacklistCache.flushAll();
    }

    return cleanedCount;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Hash a token using SHA-256
   * @param token - Token string to hash
   * @returns Hashed token
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get service statistics
   * @returns Service statistics object
   */
  async getStats(): Promise<{
    activeSessions: number;
    activeRefreshTokens: number;
    blacklistedTokens: number;
    cacheSize: number;
  }> {
    const activeSessions = await this.sessionRepository.count({
      where: { isActive: true },
    });

    const activeRefreshTokens = await this.refreshTokenRepository.count({
      where: { revoked: false },
    });

    const blacklistedTokens = await this.blacklistRepository.count();

    const cacheSize = this.blacklistCache.keys().length;

    return {
      activeSessions,
      activeRefreshTokens,
      blacklistedTokens,
      cacheSize,
    };
  }
}
