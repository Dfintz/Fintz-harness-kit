import crypto from 'crypto';

import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Repository } from 'typeorm';

import { getFrontendUrl } from '../../config/urls';
import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';
import { WebAuthnCredential } from '../../models/WebAuthnCredential';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

/**
 * Configuration for WebAuthn service
 */
export interface WebAuthnConfig {
  /** Relying Party name (displayed to user during registration) */
  rpName: string;
  /** Relying Party ID (usually the domain name) */
  rpId: string;
  /** Origin of the application (e.g., https://example.com) */
  origin: string;
  /** Timeout for WebAuthn operations in milliseconds */
  timeout: number;
  /** Challenge TTL in seconds (for in-memory challenge storage) */
  challengeTTL: number;
}

/**
 * Result of WebAuthn registration
 */
export interface WebAuthnRegistrationResult {
  credentialId: string;
  verified: boolean;
  deviceName?: string;
}

/**
 * Result of WebAuthn authentication
 */
export interface WebAuthnAuthenticationResult {
  userId: string;
  credentialId: string;
  verified: boolean;
  newCounter: number;
}

/**
 * Session metadata for WebAuthn operations
 */
export interface WebAuthnSessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Credential info returned to client
 */
export interface WebAuthnCredentialInfo {
  id: string;
  deviceName?: string;
  createdAt: Date;
  lastUsedAt?: Date;
  useCount: number;
  backedUp: boolean;
  transports?: string[];
}

/**
 * Extended authentication options that includes challenge key for discoverable credentials
 */
export interface WebAuthnAuthenticationOptionsWithKey extends PublicKeyCredentialRequestOptionsJSON {
  /** Challenge key for verifying discoverable credentials (only present when no userId provided) */
  _challengeKey?: string;
}

/**
 * WebAuthnService
 *
 * Provides WebAuthn/FIDO2 authentication support for passwordless login
 * and second-factor authentication using hardware security keys,
 * platform authenticators (Touch ID, Windows Hello), and passkeys.
 *
 * Features:
 * - Registration flow with attestation verification
 * - Authentication flow with assertion verification
 * - Counter tracking for replay attack prevention
 * - Multiple credential management per user
 * - Transports and backup status tracking
 *
 * @see https://webauthn.guide/
 * @see https://simplewebauthn.dev/
 */
export class WebAuthnService {
  private readonly credentialRepository: Repository<WebAuthnCredential>;
  private readonly userRepository: Repository<User>;
  private readonly config: WebAuthnConfig;

  // Redis key prefix for challenge storage
  private static readonly CHALLENGE_KEY_PREFIX = 'webauthn:challenge:';

  // Fallback in-memory challenge storage (used when Redis is unavailable)
  private readonly fallbackChallenges: Map<string, { challenge: string; expiresAt: Date }> =
    new Map();
  private challengeCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.credentialRepository = AppDataSource.getRepository(WebAuthnCredential);
    this.userRepository = AppDataSource.getRepository(User);

    // Initialize configuration from environment
    this.config = {
      rpName: process.env.WEBAUTHN_RP_NAME || 'Star Citizen Fleet Manager',
      rpId: process.env.WEBAUTHN_RP_ID || 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN || getFrontendUrl(),
      timeout: parseInt(process.env.WEBAUTHN_TIMEOUT || '60000'),
      challengeTTL: parseInt(process.env.WEBAUTHN_CHALLENGE_TTL || '300'),
    };

    // Start fallback challenge cleanup interval (every minute)
    this.challengeCleanupInterval = setInterval(
      () => this.cleanupExpiredFallbackChallenges(),
      60000
    );

    const redisStatus = cache.getStatus();
    logger.info('WebAuthnService initialized', {
      rpName: this.config.rpName,
      rpId: this.config.rpId,
      origin: this.config.origin,
      redisConnected: redisStatus.connected,
      redisEnabled: redisStatus.enabled,
    });
  }

  // ========================================
  // REGISTRATION FLOW
  // ========================================

  /**
   * Generate registration options for a new credential
   * Step 1 of the registration flow
   *
   * @param userId - User ID registering the credential
   * @param userName - Username for display in authenticator
   * @returns Registration options to send to the client
   */
  async generateRegistrationOptions(
    userId: string,
    userName: string
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    // Get existing credentials for this user (to exclude)
    const existingCredentials = await this.credentialRepository.find({
      where: { userId, isActive: true },
    });

    const excludeCredentials = existingCredentials.map(cred => ({
      id: cred.credentialId,
      type: 'public-key' as const,
      transports: (cred.transports || []) as AuthenticatorTransportFuture[],
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpId,
      userName,
      userDisplayName: userName,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none', // 'none' is recommended for most use cases
      authenticatorSelection: {
        residentKey: 'preferred', // Allow passkeys
        userVerification: 'preferred', // Prefer biometric/PIN verification
        authenticatorAttachment: undefined, // Allow any authenticator type
      },
      excludeCredentials,
      timeout: this.config.timeout,
    });

    // Store challenge for verification
    await this.storeChallenge(userId, options.challenge);

    logger.info('WebAuthn registration options generated', {
      userId,
      excludedCredentials: excludeCredentials.length,
    });

    return options;
  }

  /**
   * Verify registration response and store the credential
   * Step 2 of the registration flow
   *
   * @param userId - User ID registering the credential
   * @param response - Registration response from the authenticator
   * @param deviceName - Optional user-friendly name for the device
   * @param metadata - Session metadata (IP, user agent)
   * @returns Registration result
   */
  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    deviceName?: string,
    metadata?: WebAuthnSessionMetadata
  ): Promise<WebAuthnRegistrationResult> {
    // Get stored challenge
    const storedChallenge = await this.getChallenge(userId);
    if (!storedChallenge) {
      throw new ValidationError('Registration challenge not found or expired');
    }

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: storedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
      });
    } catch (error: unknown) {
      logger.error('WebAuthn registration verification failed', {
        userId,
        error: getErrorMessage(error),
      });
      throw new ValidationError(`Registration verification failed: ${getErrorMessage(error)}`);
    }

    // Clear challenge after use
    await this.clearChallenge(userId);

    if (!verification.verified || !verification.registrationInfo) {
      throw new ValidationError('Registration verification failed');
    }

    const { registrationInfo } = verification;
    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    // Check if credential already exists
    // credential.id is already a Base64URLString in @simplewebauthn/server v10+
    const existingCredential = await this.credentialRepository.findOne({
      where: { credentialId: credential.id },
    });

    if (existingCredential) {
      throw new ValidationError('Credential already registered');
    }

    // Create credential record
    // credential.id is already Base64URLString; credential.publicKey is Uint8Array
    const webAuthnCredential = this.credentialRepository.create({
      id: crypto.randomUUID(),
      userId,
      credentialId: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: Number(credential.counter),
      aaguid: registrationInfo.aaguid,
      credentialType: registrationInfo.credentialType,
      deviceName: deviceName || this.guessDeviceName(metadata?.userAgent),
      transports: response.response.transports,
      backedUp: credentialBackedUp,
      backupEligible: credentialDeviceType === 'multiDevice',
      attestationFormat: registrationInfo.fmt,
      isActive: true,
      registrationIp: metadata?.ipAddress,
      registrationUserAgent: metadata?.userAgent,
    });

    await this.credentialRepository.save(webAuthnCredential);

    logger.info('WebAuthn credential registered', {
      userId,
      credentialId: webAuthnCredential.id,
      deviceName: webAuthnCredential.deviceName,
      backedUp: credentialBackedUp,
    });

    logAuditEvent({
      eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
      userId,
      resource: 'auth.webauthn',
      action: 'credential_registered',
      message: `WebAuthn passkey registered for user ${userId} (device: ${webAuthnCredential.deviceName})`,
      metadata: {
        credentialId: webAuthnCredential.id,
        deviceName: webAuthnCredential.deviceName,
        backedUp: credentialBackedUp,
      },
    });

    return {
      credentialId: webAuthnCredential.id,
      verified: true,
      deviceName: webAuthnCredential.deviceName,
    };
  }

  // ========================================
  // AUTHENTICATION FLOW
  // ========================================

  /**
   * Generate authentication options for credential verification
   * Step 1 of the authentication flow
   *
   * @param userId - Optional user ID to limit allowed credentials
   * @returns Authentication options to send to the client (includes _challengeKey for discoverable credentials)
   */
  async generateAuthenticationOptions(
    userId?: string
  ): Promise<WebAuthnAuthenticationOptionsWithKey> {
    let allowCredentials:
      { id: string; type: 'public-key'; transports?: AuthenticatorTransportFuture[] }[] | undefined;

    if (userId) {
      // Get user's credentials to allow
      const credentials = await this.credentialRepository.find({
        where: { userId, isActive: true },
      });

      if (credentials.length === 0) {
        throw new NotFoundError('No WebAuthn credentials registered for this user');
      }

      allowCredentials = credentials.map(cred => ({
        id: cred.credentialId,
        type: 'public-key' as const,
        transports: (cred.transports || []) as AuthenticatorTransportFuture[],
      }));
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: this.config.rpId,
      allowCredentials,
      userVerification: 'preferred',
      timeout: this.config.timeout,
    });

    // Store challenge (use a temporary ID if no userId)
    const challengeKey = userId || `temp-${crypto.randomUUID()}`;
    await this.storeChallenge(challengeKey, options.challenge);

    // Create response with optional challengeKey for discoverable credentials
    const response: WebAuthnAuthenticationOptionsWithKey = {
      ...options,
    };

    // Include challengeKey for discoverable credentials flow (no userId)
    if (!userId) {
      response._challengeKey = challengeKey;
    }

    logger.info('WebAuthn authentication options generated', {
      userId,
      allowedCredentials: allowCredentials?.length || 'any',
    });

    return response;
  }

  /**
   * Verify authentication response
   * Step 2 of the authentication flow
   *
   * @param response - Authentication response from the authenticator
   * @param challengeKey - Challenge key (userId or temp key for discoverable credentials)
   * @returns Authentication result with user ID
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    challengeKey: string
  ): Promise<WebAuthnAuthenticationResult> {
    // Get stored challenge
    const storedChallenge = await this.getChallenge(challengeKey);
    if (!storedChallenge) {
      throw new ValidationError('Authentication challenge not found or expired');
    }

    // Find the credential by ID
    const credentialId = response.id;
    const credential = await this.credentialRepository.findOne({
      where: { credentialId, isActive: true },
    });

    if (!credential) {
      throw new NotFoundError('Credential');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: storedChallenge,
        expectedOrigin: this.config.origin,
        expectedRPID: this.config.rpId,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.credentialPublicKey, 'base64url'),
          counter: credential.counter,
          transports: (credential.transports || []) as AuthenticatorTransportFuture[],
        },
      });
    } catch (error: unknown) {
      logger.error('WebAuthn authentication verification failed', {
        credentialId: credential.id,
        userId: credential.userId,
        error: getErrorMessage(error),
      });
      throw new ValidationError(`Authentication verification failed: ${getErrorMessage(error)}`);
    }

    // Clear challenge after use
    await this.clearChallenge(challengeKey);

    if (!verification.verified) {
      throw new ValidationError('Authentication verification failed');
    }

    const { authenticationInfo } = verification;

    // Update credential counter (prevent replay attacks)
    credential.counter = authenticationInfo.newCounter;
    credential.lastUsedAt = new Date();
    credential.useCount += 1;
    await this.credentialRepository.save(credential);

    logger.info('WebAuthn authentication successful', {
      userId: credential.userId,
      credentialId: credential.id,
      newCounter: authenticationInfo.newCounter,
    });

    return {
      userId: credential.userId,
      credentialId: credential.id,
      verified: true,
      newCounter: authenticationInfo.newCounter,
    };
  }

  // ========================================
  // CREDENTIAL MANAGEMENT
  // ========================================

  /**
   * Get all credentials for a user
   * @param userId - User ID
   * @returns List of credential info
   */
  async getUserCredentials(userId: string): Promise<WebAuthnCredentialInfo[]> {
    const credentials = await this.credentialRepository.find({
      where: { userId, isActive: true },
      order: { lastUsedAt: 'DESC' },
    });

    return credentials.map(cred => ({
      id: cred.id,
      deviceName: cred.deviceName,
      createdAt: cred.createdAt,
      lastUsedAt: cred.lastUsedAt,
      useCount: cred.useCount,
      backedUp: cred.backedUp,
      transports: cred.transports,
    }));
  }

  /**
   * Update credential device name
   * @param userId - User ID (for authorization)
   * @param credentialId - Credential ID
   * @param deviceName - New device name
   */
  async updateCredentialName(
    userId: string,
    credentialId: string,
    deviceName: string
  ): Promise<void> {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, userId, isActive: true },
    });

    if (!credential) {
      throw new NotFoundError('Credential');
    }

    credential.deviceName = deviceName;
    await this.credentialRepository.save(credential);

    logger.info('WebAuthn credential name updated', {
      userId,
      credentialId,
      deviceName,
    });
  }

  /**
   * Remove a credential (soft delete)
   * @param userId - User ID (for authorization)
   * @param credentialId - Credential ID to remove
   */
  async removeCredential(userId: string, credentialId: string): Promise<void> {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, userId, isActive: true },
    });

    if (!credential) {
      throw new NotFoundError('Credential');
    }

    credential.isActive = false;
    await this.credentialRepository.save(credential);

    logger.info('WebAuthn credential removed', {
      userId,
      credentialId,
    });
  }

  /**
   * Remove all credentials for a user
   * @param userId - User ID
   * @returns Number of credentials removed
   */
  async removeAllCredentials(userId: string): Promise<number> {
    const result = await this.credentialRepository.update(
      { userId, isActive: true },
      { isActive: false }
    );

    const removedCount = result.affected || 0;

    logger.info('All WebAuthn credentials removed', {
      userId,
      removedCount,
    });

    return removedCount;
  }

  /**
   * Check if user has any WebAuthn credentials
   * @param userId - User ID
   * @returns True if user has at least one active credential
   */
  async hasCredentials(userId: string): Promise<boolean> {
    const count = await this.credentialRepository.count({
      where: { userId, isActive: true },
    });

    return count > 0;
  }

  // ========================================
  // CHALLENGE MANAGEMENT (Redis with fallback)
  // ========================================

  /**
   * Store a challenge for later verification
   * Uses Redis for production multi-instance support with in-memory fallback
   */
  private async storeChallenge(key: string, challenge: string): Promise<void> {
    const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;
    const ttlSeconds = this.config.challengeTTL;

    // Try Redis first
    const stored = await cache.set(redisKey, { challenge }, ttlSeconds);

    if (!stored) {
      // Fallback to in-memory storage when Redis is unavailable or operation failed
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      this.fallbackChallenges.set(key, { challenge, expiresAt });

      const redisStatus = cache.getStatus();
      logger.debug('WebAuthn challenge stored in fallback memory', {
        key,
        reason: !redisStatus.enabled
          ? 'Redis disabled'
          : !redisStatus.connected
            ? 'Redis not connected'
            : 'Redis operation failed',
      });
    } else {
      logger.debug('WebAuthn challenge stored in Redis', { key, ttlSeconds });
    }
  }

  /**
   * Get and validate a stored challenge
   * Checks Redis first, then falls back to in-memory storage
   */
  private async getChallenge(key: string): Promise<string | null> {
    const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;

    // Try Redis first
    const redisStored = await cache.get<{ challenge: string }>(redisKey);
    if (redisStored) {
      return redisStored.challenge;
    }

    // Fallback to in-memory storage
    const memoryStored = this.fallbackChallenges.get(key);
    if (!memoryStored) {
      return null;
    }

    if (new Date() > memoryStored.expiresAt) {
      this.fallbackChallenges.delete(key);
      return null;
    }

    return memoryStored.challenge;
  }

  /**
   * Clear a challenge after use
   * Clears from both Redis and in-memory storage
   */
  private async clearChallenge(key: string): Promise<void> {
    const redisKey = `${WebAuthnService.CHALLENGE_KEY_PREFIX}${key}`;

    // Clear from Redis
    await cache.del(redisKey);

    // Clear from fallback memory
    this.fallbackChallenges.delete(key);
  }

  /**
   * Cleanup expired fallback challenges (in-memory only)
   * Redis handles expiration automatically via TTL
   */
  private cleanupExpiredFallbackChallenges(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, value] of this.fallbackChallenges.entries()) {
      if (now > value.expiresAt) {
        this.fallbackChallenges.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired WebAuthn fallback challenges', { count: cleaned });
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Guess device name from user agent
   */
  private guessDeviceName(userAgent?: string): string {
    if (!userAgent) {
      return 'Security Key';
    }

    const ua = userAgent.toLowerCase();

    // Platform authenticators
    if (ua.includes('mac') && (ua.includes('safari') || ua.includes('chrome'))) {
      return 'MacBook Touch ID';
    }
    if (ua.includes('iphone') || ua.includes('ipad')) {
      return 'iPhone/iPad Face ID';
    }
    if (ua.includes('windows')) {
      return 'Windows Hello';
    }
    if (ua.includes('android')) {
      return 'Android Device';
    }

    return 'Security Key';
  }

  /**
   * Get service configuration (for debugging)
   */
  getConfig(): Omit<WebAuthnConfig, 'challengeTTL'> {
    return {
      rpName: this.config.rpName,
      rpId: this.config.rpId,
      origin: this.config.origin,
      timeout: this.config.timeout,
    };
  }

  /**
   * Cleanup resources on service shutdown
   */
  destroy(): void {
    if (this.challengeCleanupInterval) {
      clearInterval(this.challengeCleanupInterval);
      this.challengeCleanupInterval = null;
    }
    this.fallbackChallenges.clear();
  }
}
