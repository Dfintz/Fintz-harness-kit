import crypto from 'crypto';

import bcrypt from 'bcrypt';
import { MoreThan, Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { PasswordHistory } from '../../../models/PasswordHistory';
import { RecoveryToken } from '../../../models/RecoveryToken';
import { User } from '../../../models/User';
import { DatabaseError, NotFoundError, ValidationError } from '../../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../../utils/auditLogger';
import { logger } from '../../../utils/logger';

import { getTokenEncryptionService, TokenEncryptionService } from './TokenEncryptionService';

export type RecoveryType = 'email' | 'recovery_code' | 'admin';

/**
 * Password validation result with detailed feedback
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
  score: number; // 0-100
}

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  disallowCommonPasswords: boolean;
  disallowUserInfo: boolean;
}

/**
 * Lockout status information for a user account
 */
export interface LockoutStatus {
  isLocked: boolean;
  failedAttempts: number;
  attemptsRemaining: number;
  lockedUntil?: Date;
  lockoutExpiresIn?: number; // milliseconds
}

/**
 * Security statistics for monitoring dashboards
 */
export interface SecurityStats {
  lockedAccounts: number;
  recentFailedAttempts: number;
  activeRecoveryTokens: number;
}

/**
 * AccountSecurityService
 *
 * Unified service consolidating all account security functionality:
 * - Account lockout protection (from AccountLockoutService)
 * - Account recovery mechanisms (from AccountRecoveryService)
 * - Audit trail management (from auditLogger)
 * - Password reset functionality
 * - Security breach detection
 *
 * Phase 3.2 - Security Consolidation
 * Replaces: AccountLockoutService, AccountRecoveryService, parts of auditLogger
 *
 * @author GitHub Copilot
 * @since October 2025
 */
export class AccountSecurityService {
  private static instance: AccountSecurityService;

  private readonly userRepository: Repository<User>;
  private readonly recoveryTokenRepository: Repository<RecoveryToken>;
  private readonly passwordHistoryRepository: Repository<PasswordHistory>;
  private readonly encryptionService: TokenEncryptionService;

  // Security constants
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly RECOVERY_TOKEN_EXPIRY_HOURS = 24;
  private static readonly PASSWORD_HISTORY_COUNT = 12; // Number of previous passwords to check
  private static readonly CLEANUP_FETCH_MULTIPLIER = 2; // Fetch 2x history count for cleanup
  public static readonly PASSWORD_REUSE_ERROR =
    'Password has been used recently. Please choose a different password.';
  // Note: MAX_2FA_ATTEMPTS reserved for future use
  // private static readonly MAX_2FA_ATTEMPTS = 3;

  // Password policy configuration
  private static readonly DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommonPasswords: true,
    disallowUserInfo: true,
  };

  // Common weak passwords to reject (top 100 commonly used)
  private static readonly COMMON_PASSWORDS: Set<string> = new Set([
    'password',
    'password123',
    '123456',
    '12345678',
    'qwerty',
    'abc123',
    'letmein',
    'welcome',
    'admin',
    'iloveyou',
    'monkey',
    'dragon',
    'master',
    'login',
    'passw0rd',
    '123456789',
    '1234567890',
    'password1',
    'sunshine',
    'princess',
    'football',
    'baseball',
    'starwars',
    'trustno1',
    'michael',
    'shadow',
    'ashley',
    'jessica',
    'charlie',
    'superman',
    'qwerty123',
    'hello',
    '12345',
    '1234567',
    'nothing',
    'secret',
    'passwort',
    'password!',
    'password1!',
    'changeme',
    'default',
    'starcitizen',
    'fleetmanager',
    'fleet123',
    'citizen',
    'aegis',
  ]);

  private constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.recoveryTokenRepository = AppDataSource.getRepository(RecoveryToken);
    this.passwordHistoryRepository = AppDataSource.getRepository(PasswordHistory);
    this.encryptionService = getTokenEncryptionService();

    logger.info('AccountSecurityService initialized - unified security management');
  }

  public static getInstance(): AccountSecurityService {
    if (!AccountSecurityService.instance) {
      AccountSecurityService.instance = new AccountSecurityService();
    }
    return AccountSecurityService.instance;
  }

  // =================================================================
  // ACCOUNT LOCKOUT FUNCTIONALITY (from AccountLockoutService)
  // =================================================================

  /**
   * Check if an account is currently locked
   * @param user User entity to check
   * @returns true if account is locked, false otherwise
   */
  public isAccountLocked(user: User): boolean {
    if (!user.lockedUntil) {
      return false;
    }

    const now = new Date();
    const isLocked = user.lockedUntil > now;

    // If lockout period has expired, clear the lock
    if (!isLocked && user.failedLoginAttempts > 0) {
      logger.info(`Account lockout expired for user ${user.id}`);
    }

    return isLocked;
  }

  /**
   * Record a failed login attempt and lock account if threshold exceeded
   * @param userId User ID
   * @returns Object with lockout status and remaining attempts
   */
  public async recordFailedAttempt(userId: string): Promise<{
    isLocked: boolean;
    attemptsRemaining: number;
    lockedUntil?: Date;
  }> {
    try {
      // Atomic increment to prevent race conditions on concurrent requests
      await this.userRepository
        .createQueryBuilder()
        .update(User)
        .set({ failedLoginAttempts: () => '"failedLoginAttempts" + 1' })
        .where('id = :id', { id: userId })
        .execute();

      // Re-read the updated user to check threshold
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const attemptsRemaining =
        AccountSecurityService.MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;

      // Lock account if threshold exceeded — use atomic update to avoid
      // overwriting a concurrent increment with a stale failedLoginAttempts.
      if (user.failedLoginAttempts >= AccountSecurityService.MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + AccountSecurityService.LOCKOUT_DURATION_MS);
        await this.userRepository
          .createQueryBuilder()
          .update(User)
          .set({ lockedUntil })
          .where('id = :id', { id: userId })
          .execute();

        logger.warn(
          `Account locked for user ${userId} after ${user.failedLoginAttempts} failed attempts`
        );

        logAuditEvent({
          eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
          userId,
          action: 'account_locked',
          message: 'Account locked due to max failed attempts exceeded',
          metadata: {
            reason: 'max_failed_attempts_exceeded',
            failedAttempts: user.failedLoginAttempts,
            lockedUntil,
          },
        });

        return {
          isLocked: true,
          attemptsRemaining: 0,
          lockedUntil,
        };
      }

      logger.info(
        `Failed login attempt ${user.failedLoginAttempts}/${AccountSecurityService.MAX_FAILED_ATTEMPTS} for user ${userId}`
      );

      return {
        isLocked: false,
        attemptsRemaining: Math.max(0, attemptsRemaining),
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error recording failed login attempt:', error);
      throw new DatabaseError('Failed to record login attempt');
    }
  }

  /**
   * Reset failed login attempts (called on successful login)
   * @param userId User ID
   */
  public async resetFailedAttempts(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        return; // User not found, nothing to reset
      }

      const previousAttempts = user.failedLoginAttempts || 0;
      const hadFailedAttempts = previousAttempts > 0;
      const wasLocked = user.lockedUntil && user.lockedUntil > new Date();

      // Reset failed attempts and clear lockout
      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;

      await this.userRepository.save(user);

      if (hadFailedAttempts || wasLocked) {
        logger.info(`Reset failed login attempts for user ${userId}`);

        logAuditEvent({
          eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
          userId,
          action: 'lockout_reset',
          message: 'Account lockout reset after successful login',
          metadata: {
            reason: 'successful_login',
            previousAttempts,
          },
        });
      }
    } catch (error: unknown) {
      logger.error(`Error resetting failed attempts for user ${userId}:`, error);
      throw new DatabaseError('Failed to reset login attempts');
    }
  }

  /**
   * Get current lockout status for a user
   * @param userId User ID
   * @returns Lockout status information
   */
  public async getLockoutStatus(userId: string): Promise<LockoutStatus> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const failedAttempts = user.failedLoginAttempts || 0;
      const attemptsRemaining = Math.max(
        0,
        AccountSecurityService.MAX_FAILED_ATTEMPTS - failedAttempts
      );
      const isLocked = this.isAccountLocked(user);

      const result: LockoutStatus = {
        isLocked,
        failedAttempts,
        attemptsRemaining,
      };

      if (user.lockedUntil && isLocked) {
        result.lockedUntil = user.lockedUntil;
        result.lockoutExpiresIn = user.lockedUntil.getTime() - Date.now();
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error(`Error getting lockout status for user ${userId}:`, error);
      throw new DatabaseError('Failed to get lockout status');
    }
  }

  /**
   * Manually unlock an account (admin function)
   * @param userId User ID to unlock
   */
  public async unlockAccount(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      const wasLocked = this.isAccountLocked(user);

      user.failedLoginAttempts = 0;
      user.lockedUntil = undefined;

      await this.userRepository.save(user);

      if (wasLocked) {
        logger.info(`Account manually unlocked for user ${userId}`);

        logAuditEvent({
          eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
          userId,
          action: 'account_unlocked',
          message: 'Account manually unlocked by admin',
          metadata: {
            reason: 'admin_override',
          },
        });
      }
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error(`Error unlocking account for user ${userId}:`, error);
      throw new DatabaseError('Failed to unlock account');
    }
  }

  // =================================================================
  // ACCOUNT RECOVERY FUNCTIONALITY (from AccountRecoveryService)
  // =================================================================

  /**
   * Generate recovery codes (longer than backup codes, for emergency use)
   * Format: XXXX-XXXX-XXXX (12 characters)
   */
  generateRecoveryCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 12-character code with dashes
      const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
      const code = `${part1}-${part2}-${part3}`;
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash recovery codes for secure storage
   */
  hashRecoveryCodes(codes: string[]): string[] {
    return codes.map(code =>
      crypto.createHash('sha256').update(code.replace(/-/g, '')).digest('hex')
    );
  }

  /**
   * Initiate email-based account recovery
   * @param email User's email address
   * @param recoveryType Type of recovery being initiated
   * @returns Recovery token for email verification
   */
  async initiateEmailRecovery(
    email: string,
    recoveryType: RecoveryType = 'email'
  ): Promise<{ token: string; expiresAt: Date }> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });

      // Generate secure recovery token (always, to normalize timing)
      const token = crypto.randomBytes(32).toString('hex');
      const encryptedTokenData = this.encryptionService.encrypt(token);
      const encryptedToken = JSON.stringify(encryptedTokenData);
      const expiresAt = new Date(
        Date.now() + AccountSecurityService.RECOVERY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      if (!user) {
        // Don't reveal if email exists - return success either way
        // Timing is normalized: encryption work already done above
        logger.warn('Recovery attempt for non-existent email');
        return { token, expiresAt };
      }

      // Save recovery token with hash for efficient lookup
      const recoveryToken = this.recoveryTokenRepository.create({
        userId: user.id,
        token: encryptedToken,
        tokenHash,
        type: recoveryType,
        expiresAt,
        isUsed: false,
      });

      await this.recoveryTokenRepository.save(recoveryToken);

      logger.info(`Recovery token generated for user ${user.id}, type: ${recoveryType}`);

      logAuditEvent({
        eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
        userId: user.id,
        action: 'recovery_initiated',
        message: 'Account recovery initiated',
        metadata: {
          recoveryType,
          email,
        },
      });

      return { token, expiresAt };
    } catch (error: unknown) {
      logger.error('Error initiating email recovery:', error);
      throw new DatabaseError('Failed to initiate recovery');
    }
  }

  /**
   * Verify a recovery token
   * @param token Recovery token to verify
   * @returns Recovery token entity if valid, null otherwise
   */
  async verifyRecoveryToken(token: string): Promise<RecoveryToken | null> {
    try {
      // Use token hash for efficient indexed lookup instead of scanning all tokens
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const now = new Date();

      const recoveryToken = await this.recoveryTokenRepository.findOne({
        where: {
          tokenHash,
          isUsed: false,
          expiresAt: MoreThan(now),
        },
      });

      if (!recoveryToken?.token) {
        logger.warn('Invalid recovery token provided');
        return null;
      }

      try {
        // Decrypt and verify with timing-safe comparison as defence in depth
        const tokenData = JSON.parse(recoveryToken.token);
        const decryptedToken = this.encryptionService.decrypt(
          tokenData.encrypted,
          tokenData.iv,
          tokenData.authTag
        );

        const a = Buffer.from(decryptedToken);
        const b = Buffer.from(token);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          logger.warn('Recovery token hash matched but decrypted value did not');
          return null;
        }
      } catch (_decryptError: unknown) {
        logger.warn('Recovery token decryption failed during verification');
        return null;
      }

      logger.info(`Valid recovery token verified for user ${recoveryToken.userId}`);
      return recoveryToken;
    } catch (error: unknown) {
      logger.error('Error verifying recovery token:', error);
      throw new DatabaseError('Failed to verify recovery token');
    }
  }

  /**
   * Mark a recovery token as used
   * @param tokenId Recovery token ID
   */
  async markTokenUsed(tokenId: number): Promise<void> {
    try {
      await this.recoveryTokenRepository.update(tokenId, {
        isUsed: true,
        used: true,
        usedAt: new Date(),
      });

      logger.info(`Recovery token ${tokenId} marked as used`);
    } catch (error: unknown) {
      logger.error(`Error marking recovery token ${tokenId} as used:`, error);
      throw new DatabaseError('Failed to mark token as used');
    }
  }

  /**
   * Disable 2FA using a verified recovery token
   * @param userId User ID
   * @param recoveryMethod Method used for recovery
   * @param recoveryTokenId ID of the verified and consumed recovery token
   */
  async disable2FAWithRecovery(
    userId: string,
    recoveryMethod: RecoveryType,
    recoveryTokenId: number
  ): Promise<void> {
    try {
      // Verify the recovery token exists and belongs to this user
      const recoveryToken = await this.recoveryTokenRepository.findOne({
        where: { id: recoveryTokenId, userId, isUsed: true },
      });
      if (!recoveryToken) {
        throw new ValidationError('Invalid or unconsumed recovery token');
      }

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundError('User', userId);
      }

      if (!user.twoFactorEnabled) {
        logger.warn(`Attempt to disable 2FA for user ${userId} who doesn't have 2FA enabled`);
        return;
      }

      // Disable 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.failedTwoFactorAttempts = 0;

      await this.userRepository.save(user);

      logger.info(`2FA disabled for user ${userId} via ${recoveryMethod} recovery`);

      logAuditEvent({
        eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
        userId,
        action: '2fa_disabled',
        message: '2FA disabled via recovery method',
        metadata: {
          method: 'recovery',
          recoveryMethod,
          recoveryTokenId,
          timestamp: new Date(),
        },
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      logger.error(`Error disabling 2FA for user ${userId}:`, error);
      throw new DatabaseError('Failed to disable 2FA');
    }
  }

  /**
   * Clean up expired recovery tokens
   * @returns Number of tokens cleaned up
   */
  async cleanupExpiredTokens(): Promise<number> {
    try {
      const result = await this.recoveryTokenRepository
        .createQueryBuilder()
        .delete()
        .from(RecoveryToken)
        .where('expiresAt < :now', { now: new Date() })
        .execute();

      const deletedCount = result.affected || 0;

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired recovery tokens`);
      }

      return deletedCount;
    } catch (error: unknown) {
      logger.error('Error cleaning up expired recovery tokens:', error);
      return 0;
    }
  }

  // =================================================================
  // UNIFIED AUDIT TRAIL FUNCTIONALITY
  // =================================================================

  /**
   * Log a security event with full context
   * @param eventType Type of security event
   * @param data Event data
   * @param userId Optional user ID
   * @param ipAddress Optional IP address
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    data: Record<string, unknown>,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      logAuditEvent({
        eventType,
        userId,
        ipAddress,
        message: (data.message as string) || 'Security event',
        metadata: {
          ...data,
          timestamp: new Date(),
          service: 'AccountSecurityService',
        },
      });
    } catch (error: unknown) {
      logger.error('Error logging security event:', error);
      // Don't throw - audit failures shouldn't break security operations
    }
  }

  /**
   * Get security statistics for monitoring
   * @returns Security metrics and statistics
   */
  async getSecurityStats(): Promise<SecurityStats> {
    try {
      const now = new Date();

      // Count locked accounts (lockedUntil in the future)
      const lockedAccounts = await this.userRepository.count({
        where: {
          lockedUntil: MoreThan(now),
        },
      });

      // Count users with recent failed attempts
      const recentFailedAttempts = await this.userRepository.count({
        where: {
          failedLoginAttempts: MoreThan(0),
        },
      });

      // Count active (non-expired, unused) recovery tokens
      const activeRecoveryTokens = await this.recoveryTokenRepository.count({
        where: {
          isUsed: false,
          expiresAt: MoreThan(now),
        },
      });

      return {
        lockedAccounts: lockedAccounts || 0,
        recentFailedAttempts: recentFailedAttempts || 0,
        activeRecoveryTokens: activeRecoveryTokens || 0,
      };
    } catch (error: unknown) {
      logger.error('Error getting security stats:', error);
      // Fail open: return zeros so the admin dashboard doesn't crash.
      // The logged error above will trigger alerts in monitoring.
      return {
        lockedAccounts: 0,
        recentFailedAttempts: 0,
        activeRecoveryTokens: 0,
      };
    }
  }

  // =================================================================
  // PASSWORD POLICY ENFORCEMENT
  // =================================================================

  /**
   * Get the current password policy configuration
   * @returns PasswordPolicy configuration
   */
  public getPasswordPolicy(): PasswordPolicy {
    return { ...AccountSecurityService.DEFAULT_PASSWORD_POLICY };
  }

  /**
   * Validate a password against the security policy
   * @param password Password to validate
   * @param userInfo Optional user info to check against (username, email)
   * @returns PasswordValidationResult with detailed feedback
   */
  public validatePassword(
    password: string,
    userInfo?: { username?: string; email?: string }
  ): PasswordValidationResult {
    const policy = AccountSecurityService.DEFAULT_PASSWORD_POLICY;
    const errors: string[] = [];
    let score = 0;

    // Length checks
    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    } else {
      score += 20;
      // Bonus for longer passwords
      if (password.length >= 16) {
        score += 10;
      }
      if (password.length >= 20) {
        score += 10;
      }
    }

    if (password.length > policy.maxLength) {
      errors.push(`Password must not exceed ${policy.maxLength} characters`);
    }

    // Character class checks
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*...)');
    } else if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      score += 15;
    }

    // Common password check
    if (policy.disallowCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (AccountSecurityService.COMMON_PASSWORDS.has(lowerPassword)) {
        errors.push('Password is too common. Please choose a more unique password');
        score = Math.max(0, score - 30);
      }
    }

    // User info check (prevent password containing username or email)
    if (policy.disallowUserInfo && userInfo) {
      const lowerPassword = password.toLowerCase();

      if (userInfo.username && lowerPassword.includes(userInfo.username.toLowerCase())) {
        errors.push('Password cannot contain your username');
        score = Math.max(0, score - 20);
      }

      if (userInfo.email) {
        const emailLocal = userInfo.email.split('@')[0].toLowerCase();
        if (lowerPassword.includes(emailLocal)) {
          errors.push('Password cannot contain your email address');
          score = Math.max(0, score - 20);
        }
      }
    }

    // Check for sequential characters (e.g., "abc", "123")
    if (this.hasSequentialChars(password)) {
      errors.push('Password should not contain sequential characters (e.g., "abc", "123")');
      score = Math.max(0, score - 10);
    }

    // Check for repeated characters (e.g., "aaa", "111")
    if (this.hasRepeatedChars(password)) {
      errors.push('Password should not contain repeated characters (e.g., "aaa", "111")');
      score = Math.max(0, score - 10);
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Determine strength based on score
    let strength: 'weak' | 'fair' | 'good' | 'strong';
    if (score < 40) {
      strength = 'weak';
    } else if (score < 60) {
      strength = 'fair';
    } else if (score < 80) {
      strength = 'good';
    } else {
      strength = 'strong';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  /**
   * Check if password contains sequential characters
   * @param password Password to check
   * @returns true if contains 3+ sequential chars
   */
  private hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 3; i++) {
        if (password.includes(seq.substring(i, i + 3))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if password contains repeated characters
   * @param password Password to check
   * @returns true if contains 3+ repeated chars
   */
  private hasRepeatedChars(password: string): boolean {
    for (let i = 0; i < password.length - 2; i++) {
      if (password[i] === password[i + 1] && password[i] === password[i + 2]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if the new password has been used recently
   * Compares the new password against the last N passwords in history
   *
   * @param userId User ID to check history for
   * @param newPassword Plain text password to check (will be compared via bcrypt)
   * @param historyCount Number of previous passwords to check against (default: 12)
   * @returns true if password is not in history, false if password was used recently
   */
  public async checkPasswordHistory(
    userId: string,
    newPassword: string,
    historyCount: number = AccountSecurityService.PASSWORD_HISTORY_COUNT
  ): Promise<boolean> {
    try {
      // Fetch the last N password hashes for this user
      const previousPasswords = await this.passwordHistoryRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: historyCount,
      });

      // Check if the new password matches any of the previous passwords
      // Use Promise.all for parallel bcrypt comparisons to improve performance
      const comparisonPromises = previousPasswords.map(async historyEntry => {
        try {
          const isMatch = await bcrypt.compare(newPassword, historyEntry.passwordHash);
          return { isMatch, entry: historyEntry };
        } catch (bcryptError: unknown) {
          // Handle invalid hash gracefully - log but continue checking
          logger.error('Error comparing password hash:', bcryptError);
          return { isMatch: false, entry: historyEntry };
        }
      });

      const results = await Promise.all(comparisonPromises);
      const matchedEntry = results.find(result => result.isMatch);

      if (matchedEntry) {
        logger.warn(`Password reuse attempt detected for user ${userId}`);
        logAuditEvent({
          eventType: AuditEventType.AUTH_FAILURE,
          userId,
          action: 'password_reuse_attempt',
          message: 'Password reuse attempt detected',
          metadata: { historyCount },
        });
        return false; // Password is in history
      }

      logger.debug(`Password history check passed for user ${userId}`);
      return true; // Password is not in history
    } catch (error: unknown) {
      logger.error('Error checking password history:', error);
      // Fail open to prevent blocking legitimate password changes.
      // Audit the event so monitoring can detect persistent DB issues.
      logAuditEvent({
        eventType: AuditEventType.AUTH_FAILURE,
        userId,
        action: 'password_history_check_failed',
        message: 'Password history check failed — allowing change (fail-open)',
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      return true;
    }
  }

  /**
   * Store a password in the user's password history
   * Should be called after successfully changing a password
   *
   * @param userId User ID
   * @param passwordHash The bcrypt hash of the password
   */
  public async addPasswordToHistory(userId: string, passwordHash: string): Promise<void> {
    try {
      // Create new password history entry
      const historyEntry = this.passwordHistoryRepository.create({
        userId,
        passwordHash,
      });

      await this.passwordHistoryRepository.save(historyEntry);
      logger.debug(`Password added to history for user ${userId}`);

      // Clean up old password history entries beyond the configured limit
      await this.cleanupOldPasswordHistory(userId);
    } catch (error: unknown) {
      logger.error('Error adding password to history:', error);
      // Don't throw error to prevent blocking password changes
    }
  }

  /**
   * Clean up old password history entries beyond the configured limit
   * Keeps only the most recent N passwords
   *
   * @param userId User ID to clean up history for
   */
  private async cleanupOldPasswordHistory(userId: string): Promise<void> {
    try {
      // Add upper bound to prevent fetching excessive records
      const allPasswords = await this.passwordHistoryRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take:
          AccountSecurityService.PASSWORD_HISTORY_COUNT *
          AccountSecurityService.CLEANUP_FETCH_MULTIPLIER,
      });

      // Keep only the most recent PASSWORD_HISTORY_COUNT entries
      if (allPasswords.length > AccountSecurityService.PASSWORD_HISTORY_COUNT) {
        const entriesToDelete = allPasswords.slice(AccountSecurityService.PASSWORD_HISTORY_COUNT);
        const idsToDelete = entriesToDelete.map(entry => entry.id);

        await this.passwordHistoryRepository.delete(idsToDelete);
        logger.debug(
          `Cleaned up ${entriesToDelete.length} old password history entries for user ${userId}`
        );
      }
    } catch (error: unknown) {
      logger.error('Error cleaning up old password history:', error);
      // Don't throw error - this is a cleanup operation
    }
  }
}

