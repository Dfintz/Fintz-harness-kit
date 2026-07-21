import crypto from 'node:crypto';

import bcrypt from 'bcrypt';
import { LessThan } from 'typeorm';

import { getFrontendUrl } from '../../config/urls';
import { AppDataSource } from '../../data-source';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { User } from '../../models/User';
import { ApiErrorCode } from '../../types/api';
import { ApiError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { emailService } from '../communication/email';
import { AccountSecurityService } from '../security/core/AccountSecurityService';

/**
 * Service for handling password reset functionality
 * Manages token generation, validation, and password reset operations
 */
export class PasswordResetService {
  private readonly tokenRepository = AppDataSource.getRepository(PasswordResetToken);
  private readonly userRepository = AppDataSource.getRepository(User);

  // Token expiration time in hours
  private readonly TOKEN_EXPIRATION_HOURS = 1;
  // Maximum number of active tokens per user
  private readonly MAX_ACTIVE_TOKENS = 3;

  // ==================== REQUEST PASSWORD RESET ====================

  /**
   * Request a password reset by email
   * Generates a token and sends reset email
   * @param email User email address
   * @returns Success message
   * @throws Error if user not found or email service unavailable
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    // Find user by email (need to handle encrypted email)
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      // For security, don't reveal if user exists
      return { message: 'If the email exists in our system, a password reset link has been sent.' };
    }

    // Invalidate any existing active tokens for this user
    await this.invalidateUserTokens(user.id);

    // Generate secure token
    const token = this.generateSecureToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRATION_HOURS);

    // Create password reset token — store only the hash, never the plaintext
    const resetToken = this.tokenRepository.create({
      userId: user.id,
      token: tokenHash,
      expiresAt,
      used: false,
    });

    await this.tokenRepository.save(resetToken);

    // Send reset email with the plaintext token (user-facing only)
    await this.sendPasswordResetEmail(user, token);

    return { message: 'If the email exists in our system, a password reset link has been sent.' };
  }

  // ==================== VERIFY RESET TOKEN ====================

  /**
   * Verify if a reset token is valid
   * @param token Reset token
   * @returns Token validity and associated user ID
   * @throws Error if token is invalid, expired, or already used
   */
  async verifyResetToken(token: string): Promise<{ valid: boolean; userId: string }> {
    // Hash the incoming token to compare against stored hash
    const tokenHash = this.hashToken(token);
    const resetToken = await this.tokenRepository.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'Invalid or expired reset token', 400);
    }

    if (resetToken.used) {
      throw new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'This reset token has already been used', 400);
    }

    if (resetToken.isExpired()) {
      throw new ApiError(ApiErrorCode.TOKEN_EXPIRED, 'This reset token has expired', 400);
    }

    return {
      valid: true,
      userId: resetToken.userId,
    };
  }

  // ==================== RESET PASSWORD ====================

  /**
   * Reset user password using a valid token
   * @param token Reset token
   * @param newPassword New password (plain text, will be hashed)
   * @returns Success message
   * @throws Error if token is invalid or password reset fails
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Verify token
    const { userId } = await this.verifyResetToken(token);

    // Get user (need to select password field)
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Check password history to prevent reuse
    const securityService = AccountSecurityService.getInstance();
    const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);

    if (!isPasswordAllowed) {
      throw new ValidationError(AccountSecurityService.PASSWORD_REUSE_ERROR);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Add password to history
    await securityService.addPasswordToHistory(userId, hashedPassword);

    // Mark token as used (look up by hash)
    const resetToken = await this.tokenRepository.findOne({
      where: { token: this.hashToken(token) },
    });
    if (resetToken) {
      resetToken.markAsUsed();
      await this.tokenRepository.save(resetToken);
    }

    // Send confirmation email
    await this.sendPasswordResetConfirmationEmail(user);

    logAuditEvent({
      eventType: AuditEventType.SECURITY_LEVEL_CHANGED,
      userId,
      resource: 'auth.password',
      action: 'reset',
      message: `Password successfully reset for user ${userId}`,
      metadata: { userId },
    });

    return { message: 'Password has been successfully reset' };
  }

  // ==================== TOKEN MANAGEMENT ====================

  /**
   * Generate a cryptographically secure random token
   * @returns Secure token string
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash a token using SHA-256 for secure storage.
   * The plaintext token is sent to the user via email;
   * only the hash is persisted in the database.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Invalidate all active tokens for a user
   * @param userId User ID
   */
  private async invalidateUserTokens(userId: string): Promise<void> {
    await this.tokenRepository
      .createQueryBuilder()
      .update(PasswordResetToken)
      .set({ used: true })
      .where('userId = :userId AND used = false AND expiresAt > :now', {
        userId,
        now: new Date(),
      })
      .execute();
  }

  /**
   * Cleanup expired tokens (maintenance job)
   * Should be run periodically via cron job
   * @returns Number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Get active token count for a user
   * @param userId User ID
   * @returns Number of active tokens
   */
  async getActiveTokenCount(userId: string): Promise<number> {
    return this.tokenRepository.count({
      where: {
        userId,
        used: false,
        expiresAt: LessThan(new Date()),
      },
    });
  }

  // ==================== EMAIL TEMPLATES ====================

  /**
   * Send password reset email with token link
   * @param user User object
   * @param token Reset token
   */
  private async sendPasswordResetEmail(user: User, token: string): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Skipping password reset email.');
      return;
    }

    const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;
    const expirationMinutes = this.TOKEN_EXPIRATION_HOURS * 60;

    const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
                    .button { display: inline-block; padding: 12px 30px; background-color: #4a90e2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${user.username},</p>
                        <p>We received a request to reset your password for your Star Citizen Fleet Manager account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #4a90e2;">${resetUrl}</p>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul>
                                <li>This link will expire in ${expirationMinutes} minutes</li>
                                <li>If you didn't request this reset, please ignore this email</li>
                                <li>Never share this link with anyone</li>
                            </ul>
                        </div>
                        <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Star Citizen Fleet Manager.</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    try {
      const result = await emailService.send({
        to: user.email,
        subject: 'Password Reset Request - Star Citizen Fleet Manager',
        html: emailHtml,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: unknown) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Send password reset confirmation email
   * @param user User object
   */
  private async sendPasswordResetConfirmationEmail(user: User): Promise<void> {
    if (!emailService.isConfigured()) {
      return;
    }

    const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
                    .warning { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Password Reset Successful</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${user.username},</p>
                        <p>Your password has been successfully reset for your Star Citizen Fleet Manager account.</p>
                        <p>You can now log in using your new password.</p>
                        <div class="warning">
                            <strong>⚠️ Didn't reset your password?</strong>
                            <p>If you didn't perform this action, your account may be compromised. Please contact support immediately.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Star Citizen Fleet Manager.</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    try {
      await emailService.send({
        to: user.email,
        subject: 'Password Reset Successful - Star Citizen Fleet Manager',
        html: emailHtml,
      });
    } catch (error: unknown) {
      logger.error('Failed to send password reset confirmation email:', error);
      // Don't throw error here as password was already reset successfully
    }
  }
}
