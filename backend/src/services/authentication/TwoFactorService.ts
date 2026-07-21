import crypto from 'crypto';

import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';

import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { UserService } from '../user/UserService';

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface LockoutStatus {
  isLocked: boolean;
  lockedUntil?: Date;
  remainingAttempts: number;
  attemptCount: number;
}

export class TwoFactorService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }
  /**
   * Generate a new TOTP secret and QR code for authenticator apps
   */
  public async generateSecret(
    username: string,
    issuer: string = process.env.TOTP_ISSUER || 'Fringe Core'
  ): Promise<TwoFactorSetup> {
    // Generate secret
    const secretBytes = new Secret({ size: 32 });

    // Create TOTP instance for QR code generation
    const totp = new TOTP({
      issuer,
      label: username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secretBytes,
    });

    const qrCodeUrl = await QRCode.toDataURL(totp.toString());

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    return {
      secret: secretBytes.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify a TOTP token
   */
  public verifyToken(secret: string, token: string): boolean {
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret),
    });

    // validate returns the token delta or null if invalid
    // window: 2 allows 2 time steps before and after current time
    const delta = totp.validate({ token, window: 2 });
    return delta !== null;
  }

  /**
   * Generate backup codes
   */
  public generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric code
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Hash backup codes for secure storage
   */
  public hashBackupCodes(codes: string[]): string[] {
    return codes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
  }

  /**
   * Verify a backup code against hashed codes
   */
  public verifyBackupCode(code: string, hashedCodes: string[]): boolean {
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    return hashedCodes.includes(hashedCode);
  }

  /**
   * Remove a used backup code from the list
   */
  public removeBackupCode(code: string, hashedCodes: string[]): string[] {
    const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
    return hashedCodes.filter(c => c !== hashedCode);
  }

  /**
   * Track failed 2FA attempt
   * Implements progressive lockout strategy
   */
  public async trackFailedAttempt(userId: string): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      const attempts = (user.failedTwoFactorAttempts || 0) + 1;

      // Progressive lockout strategy
      // 5 attempts = 15 minutes
      // 10 attempts = 1 hour
      // 15+ attempts = 24 hours
      let lockoutUntil: Date | undefined;

      if (attempts >= 15) {
        lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        logger.warn('User locked out for 24 hours', { userId, attempts });
      } else if (attempts >= 10) {
        lockoutUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        logger.warn('User locked out for 1 hour', { userId, attempts });
      } else if (attempts >= 5) {
        lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        logger.warn('User locked out for 15 minutes', { userId, attempts });
      }

      await this.userService.updateUser(userId, {
        failedTwoFactorAttempts: attempts,
        twoFactorLockedUntil: lockoutUntil,
      });

      logger.info('Failed 2FA attempt tracked', {
        userId,
        attemptCount: attempts,
        lockedUntil: lockoutUntil,
      });

      logAuditEvent({
        eventType: AuditEventType.AUTH_FAILURE,
        userId,
        resource: 'auth.totp',
        action: 'verify_failed',
        message: `Failed 2FA attempt for user ${userId}: attempt ${attempts}${lockoutUntil ? ` — locked until ${lockoutUntil.toISOString()}` : ''}`,
        metadata: { attemptCount: attempts, lockedUntil: lockoutUntil?.toISOString() },
      });
    } catch (error: unknown) {
      logger.error('Failed to track 2FA attempt', {
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Check if user is locked out from 2FA verification
   */
  public async checkLockout(userId: string): Promise<LockoutStatus> {
    try {
      const user = await this.userService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      const now = new Date();

      // Check if currently locked
      if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > now) {
        return {
          isLocked: true,
          lockedUntil: user.twoFactorLockedUntil,
          remainingAttempts: 0,
          attemptCount: user.failedTwoFactorAttempts || 0,
        };
      }

      // If lockout expired, clear it
      if (user.twoFactorLockedUntil && user.twoFactorLockedUntil <= now) {
        await this.userService.updateUser(userId, {
          failedTwoFactorAttempts: 0,
          twoFactorLockedUntil: undefined,
        });

        return {
          isLocked: false,
          remainingAttempts: 15,
          attemptCount: 0,
        };
      }

      // Not locked, calculate remaining attempts
      const maxAttempts = 15;
      const attempts = user.failedTwoFactorAttempts || 0;
      const remaining = Math.max(0, maxAttempts - attempts);

      return {
        isLocked: false,
        remainingAttempts: remaining,
        attemptCount: attempts,
      };
    } catch (error: unknown) {
      logger.error('Failed to check lockout status', {
        userId,
        error: getErrorMessage(error),
      });
      // Fail secure - assume locked on error
      return {
        isLocked: true,
        remainingAttempts: 0,
        attemptCount: 0,
      };
    }
  }

  /**
   * Reset failed attempts (called on successful verification)
   */
  public async resetFailedAttempts(userId: string): Promise<void> {
    try {
      await this.userService.updateUser(userId, {
        failedTwoFactorAttempts: 0,
        twoFactorLockedUntil: undefined,
      });

      logger.info('Failed 2FA attempts reset', { userId });
    } catch (error: unknown) {
      logger.error('Failed to reset 2FA attempts', {
        userId,
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Calculate lockout duration based on attempt count
   */
  public calculateLockoutDuration(attempts: number): number {
    if (attempts >= 15) {
      return 24 * 60 * 60 * 1000; // 24 hours
    } else if (attempts >= 10) {
      return 60 * 60 * 1000; // 1 hour
    } else if (attempts >= 5) {
      return 15 * 60 * 1000; // 15 minutes
    }
    return 0; // No lockout
  }
}
