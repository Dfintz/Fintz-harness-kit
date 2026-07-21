import crypto from 'crypto';

import { LessThan, Repository } from 'typeorm';

import { getFrontendUrl } from '../../config/urls';
import { AppDataSource } from '../../data-source';
import { PasswordlessToken } from '../../models/PasswordlessToken';
import { User } from '../../models/User';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { emailService } from '../communication/email';

/**
 * Configuration for passwordless authentication
 */
export interface PasswordlessConfig {
  /** Token expiration time in minutes */
  tokenExpirationMinutes: number;
  /** Short code expiration time in minutes */
  codeExpirationMinutes: number;
  /** Maximum verification attempts */
  maxAttempts: number;
  /** Frontend URL for magic link generation */
  frontendUrl: string;
  /** Rate limit: max requests per hour per email */
  rateLimitPerHour: number;
}

/**
 * Result of sending a magic link
 */
export interface SendMagicLinkResult {
  success: boolean;
  message: string;
  expiresAt: Date;
  /** Token ID for tracking (not the actual token) */
  tokenId: string;
}

/**
 * Result of sending a login code
 */
export interface SendCodeResult {
  success: boolean;
  message: string;
  expiresAt: Date;
  tokenId: string;
}

/**
 * Result of verifying a passwordless token
 */
export interface VerifyTokenResult {
  valid: boolean;
  userId?: string;
  email: string;
  purpose: string;
  isNewUser: boolean;
}

/**
 * Session metadata for passwordless operations
 */
export interface PasswordlessSessionMetadata {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * PasswordlessService
 *
 * Provides passwordless authentication via magic links and email codes.
 * Allows users to authenticate without remembering a password.
 *
 * Features:
 * - Magic link authentication (click link in email)
 * - Code-based authentication (enter 6-digit code)
 * - Rate limiting to prevent abuse
 * - Token expiration and single-use enforcement
 * - Support for login, registration, and account linking
 *
 * Security considerations:
 * - Tokens are hashed before storage
 * - Single-use tokens with expiration
 * - Attempt limiting with lockout
 * - IP and user agent tracking
 */
export class PasswordlessService {
  private readonly tokenRepository: Repository<PasswordlessToken>;
  private readonly userRepository: Repository<User>;
  private readonly config: PasswordlessConfig;

  constructor() {
    this.tokenRepository = AppDataSource.getRepository(PasswordlessToken);
    this.userRepository = AppDataSource.getRepository(User);

    // Initialize configuration
    this.config = {
      tokenExpirationMinutes: parseInt(process.env.PASSWORDLESS_TOKEN_EXPIRY || '15'),
      codeExpirationMinutes: parseInt(process.env.PASSWORDLESS_CODE_EXPIRY || '10'),
      maxAttempts: parseInt(process.env.PASSWORDLESS_MAX_ATTEMPTS || '5'),
      frontendUrl: getFrontendUrl(),
      rateLimitPerHour: parseInt(process.env.PASSWORDLESS_RATE_LIMIT || '5'),
    };

    logger.info('PasswordlessService initialized', {
      tokenExpirationMinutes: this.config.tokenExpirationMinutes,
      codeExpirationMinutes: this.config.codeExpirationMinutes,
      maxAttempts: this.config.maxAttempts,
    });
  }

  // ========================================
  // MAGIC LINK FLOW
  // ========================================

  /**
   * Send a magic link for passwordless login
   *
   * @param email - Email address to send the link to
   * @param purpose - Purpose of the token (login, register, etc.)
   * @param metadata - Session metadata (IP, user agent)
   * @returns Result with token info
   */
  async sendMagicLink(
    email: string,
    purpose: 'login' | 'register' | 'link_account' | 'verify_email' = 'login',
    metadata?: PasswordlessSessionMetadata
  ): Promise<SendMagicLinkResult> {
    // Check rate limiting
    await this.checkRateLimit(email);

    // Find user by email (may not exist for registration)
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.config.tokenExpirationMinutes);

    // Invalidate any existing tokens for this email/purpose
    await this.invalidateTokens(email, purpose);

    // Create token record
    const passwordlessToken = this.tokenRepository.create({
      id: crypto.randomUUID(),
      userId: user?.id,
      email,
      tokenHash,
      tokenType: 'magic_link',
      purpose,
      expiresAt,
      requestIp: metadata?.ipAddress,
      requestUserAgent: metadata?.userAgent,
      maxAttempts: this.config.maxAttempts,
    });

    await this.tokenRepository.save(passwordlessToken);

    // Send magic link email
    await this.sendMagicLinkEmail(email, token, purpose, user?.username);

    logger.info('Magic link sent', {
      email,
      purpose,
      tokenId: passwordlessToken.id,
      isNewUser: !user,
    });

    return {
      success: true,
      message: 'Magic link sent to your email address',
      expiresAt,
      tokenId: passwordlessToken.id,
    };
  }

  /**
   * Verify a magic link token
   *
   * @param token - The token from the magic link
   * @param metadata - Session metadata (IP, user agent)
   * @returns Verification result with user info
   */
  async verifyMagicLink(
    token: string,
    metadata?: PasswordlessSessionMetadata
  ): Promise<VerifyTokenResult> {
    const tokenHash = this.hashToken(token);

    const passwordlessToken = await this.tokenRepository.findOne({
      where: { tokenHash, tokenType: 'magic_link' },
    });

    if (!passwordlessToken) {
      throw new ValidationError('Invalid or expired magic link');
    }

    // Check if token is valid
    if (!passwordlessToken.isValid()) {
      if (passwordlessToken.used) {
        throw new ValidationError('This magic link has already been used');
      }
      if (passwordlessToken.isExpired()) {
        throw new ValidationError('This magic link has expired');
      }
      if (passwordlessToken.isLocked()) {
        throw new ForbiddenError('Too many verification attempts');
      }
    }

    // Mark token as used
    passwordlessToken.used = true;
    passwordlessToken.usedAt = new Date();
    passwordlessToken.verifyIp = metadata?.ipAddress;
    passwordlessToken.verifyUserAgent = metadata?.userAgent;
    await this.tokenRepository.save(passwordlessToken);

    logger.info('Magic link verified', {
      tokenId: passwordlessToken.id,
      email: passwordlessToken.email,
      purpose: passwordlessToken.purpose,
    });

    logAuditEvent({
      eventType: AuditEventType.AUTH_SUCCESS,
      userId: passwordlessToken.userId ?? undefined,
      resource: 'auth.passwordless',
      action: 'magic_link_verified',
      message: `Magic link verified for ${passwordlessToken.email} (purpose: ${passwordlessToken.purpose})`,
      metadata: {
        email: passwordlessToken.email,
        purpose: passwordlessToken.purpose,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    return {
      valid: true,
      userId: passwordlessToken.userId,
      email: passwordlessToken.email,
      purpose: passwordlessToken.purpose,
      isNewUser: !passwordlessToken.userId,
    };
  }

  // ========================================
  // CODE-BASED FLOW
  // ========================================

  /**
   * Send a verification code for passwordless login
   *
   * @param email - Email address to send the code to
   * @param purpose - Purpose of the code
   * @param metadata - Session metadata
   * @returns Result with token info
   */
  async sendLoginCode(
    email: string,
    purpose: 'login' | 'register' | 'link_account' | 'verify_email' = 'login',
    metadata?: PasswordlessSessionMetadata
  ): Promise<SendCodeResult> {
    // Check rate limiting
    await this.checkRateLimit(email);

    // Find user by email
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();

    // Generate 6-digit code
    const code = this.generateCode();
    const tokenHash = this.hashToken(code);

    // Calculate expiration (shorter for codes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.config.codeExpirationMinutes);

    // Invalidate any existing tokens for this email/purpose
    await this.invalidateTokens(email, purpose);

    // Create token record
    const passwordlessToken = this.tokenRepository.create({
      id: crypto.randomUUID(),
      userId: user?.id,
      email,
      tokenHash,
      tokenType: 'code',
      purpose,
      expiresAt,
      requestIp: metadata?.ipAddress,
      requestUserAgent: metadata?.userAgent,
      maxAttempts: this.config.maxAttempts,
    });

    await this.tokenRepository.save(passwordlessToken);

    // Send code email
    await this.sendCodeEmail(email, code, purpose, user?.username);

    logger.info('Login code sent', {
      email,
      purpose,
      tokenId: passwordlessToken.id,
      isNewUser: !user,
    });

    return {
      success: true,
      message: 'Verification code sent to your email address',
      expiresAt,
      tokenId: passwordlessToken.id,
    };
  }

  /**
   * Verify a login code
   *
   * @param email - Email address the code was sent to
   * @param code - The 6-digit code
   * @param metadata - Session metadata
   * @returns Verification result
   */
  async verifyCode(
    email: string,
    code: string,
    metadata?: PasswordlessSessionMetadata
  ): Promise<VerifyTokenResult> {
    // Find the token by email and code type
    const passwordlessToken = await this.tokenRepository.findOne({
      where: { email, tokenType: 'code', used: false },
      order: { createdAt: 'DESC' },
    });

    if (!passwordlessToken) {
      throw new NotFoundError('Pending verification code');
    }

    // Check if locked
    if (passwordlessToken.isLocked()) {
      throw new ForbiddenError('Too many failed attempts. Please request a new code.');
    }

    // Check if expired
    if (passwordlessToken.isExpired()) {
      throw new ValidationError('Verification code has expired. Please request a new code.');
    }

    // Verify the code
    const codeHash = this.hashToken(code);
    if (passwordlessToken.tokenHash !== codeHash) {
      // Increment attempts
      passwordlessToken.attempts += 1;
      await this.tokenRepository.save(passwordlessToken);

      const remainingAttempts = passwordlessToken.maxAttempts - passwordlessToken.attempts;
      if (remainingAttempts <= 0) {
        throw new ForbiddenError('Too many failed attempts. Please request a new code.');
      }

      throw new ValidationError(`Invalid code. ${remainingAttempts} attempts remaining.`);
    }

    // Mark token as used
    passwordlessToken.used = true;
    passwordlessToken.usedAt = new Date();
    passwordlessToken.verifyIp = metadata?.ipAddress;
    passwordlessToken.verifyUserAgent = metadata?.userAgent;
    await this.tokenRepository.save(passwordlessToken);

    logger.info('Login code verified', {
      tokenId: passwordlessToken.id,
      email: passwordlessToken.email,
      purpose: passwordlessToken.purpose,
    });

    return {
      valid: true,
      userId: passwordlessToken.userId,
      email: passwordlessToken.email,
      purpose: passwordlessToken.purpose,
      isNewUser: !passwordlessToken.userId,
    };
  }

  // ========================================
  // TOKEN MANAGEMENT
  // ========================================

  /**
   * Invalidate existing tokens for an email/purpose
   */
  private async invalidateTokens(
    email: string,
    purpose: 'login' | 'register' | 'link_account' | 'verify_email'
  ): Promise<void> {
    await this.tokenRepository.update(
      { email, purpose, used: false },
      { used: true, usedAt: new Date() }
    );
  }

  /**
   * Clean up expired tokens
   * @returns Number of tokens deleted
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.tokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const cleaned = result.affected || 0;
    if (cleaned > 0) {
      logger.info('Cleaned up expired passwordless tokens', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Check rate limiting
   */
  private async checkRateLimit(email: string): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await this.tokenRepository
      .createQueryBuilder('token')
      .where('token.email = :email', { email })
      .andWhere('token.createdAt > :oneHourAgo', { oneHourAgo })
      .getCount();

    if (count >= this.config.rateLimitPerHour) {
      throw new ForbiddenError('Too many requests. Please try again later.');
    }
  }

  // ========================================
  // EMAIL TEMPLATES
  // ========================================

  /**
   * Send magic link email
   */
  private async sendMagicLinkEmail(
    email: string,
    token: string,
    purpose: string,
    username?: string
  ): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Skipping magic link email.');
      return;
    }

    const magicLinkUrl = `${this.config.frontendUrl}/auth/verify?token=${token}&type=magic_link`;
    const expirationMinutes = this.config.tokenExpirationMinutes;

    const purposeText =
      {
        login: 'sign in to your account',
        register: 'create your account',
        link_account: 'link your account',
        verify_email: 'verify your email address',
      }[purpose] || 'authenticate';

    const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: bold; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    .icon { font-size: 48px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="icon">🔐</div>
                        <h1>Passwordless Login</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${username || 'there'},</p>
                        <p>Click the button below to ${purposeText} at Star Citizen Fleet Manager:</p>
                        <div style="text-align: center;">
                            <a href="${magicLinkUrl}" class="button">Sign In Securely</a>
                        </div>
                        <p style="word-break: break-all; font-size: 12px; color: #666;">
                            Or copy this link: ${magicLinkUrl}
                        </p>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>This link expires in ${expirationMinutes} minutes</li>
                                <li>Can only be used once</li>
                                <li>If you didn't request this, ignore this email</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Star Citizen Fleet Manager - Secure Passwordless Login</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    try {
      const result = await emailService.send({
        to: email,
        subject: `Your Secure Login Link - Star Citizen Fleet Manager`,
        html: emailHtml,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: unknown) {
      logger.error('Failed to send magic link email', { email, error: getErrorMessage(error) });
      throw new BadRequestError('Failed to send magic link email');
    }
  }

  /**
   * Send verification code email
   */
  private async sendCodeEmail(
    email: string,
    code: string,
    purpose: string,
    username?: string
  ): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Skipping code email.');
      return;
    }

    const expirationMinutes = this.config.codeExpirationMinutes;

    const purposeText =
      {
        login: 'sign in',
        register: 'register',
        link_account: 'link your account',
        verify_email: 'verify your email',
      }[purpose] || 'authenticate';

    const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code-box { background-color: #fff; border: 2px dashed #667eea; padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px; }
                    .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: monospace; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    .icon { font-size: 48px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="icon">🔢</div>
                        <h1>Your Verification Code</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${username || 'there'},</p>
                        <p>Use this code to ${purposeText} at Star Citizen Fleet Manager:</p>
                        <div class="code-box">
                            <div class="code">${code}</div>
                        </div>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>This code expires in ${expirationMinutes} minutes</li>
                                <li>Never share this code with anyone</li>
                                <li>If you didn't request this, ignore this email</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Star Citizen Fleet Manager - Secure Passwordless Login</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    try {
      const result = await emailService.send({
        to: email,
        subject: `Your Verification Code: ${code} - Star Citizen Fleet Manager`,
        html: emailHtml,
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: unknown) {
      logger.error('Failed to send code email', { email, error: getErrorMessage(error) });
      throw new BadRequestError('Failed to send verification code email');
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Generate a 6-digit verification code
   */
  private generateCode(): string {
    // Generate a random 6-digit code
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    activeTokens: number;
    usedTokens24h: number;
    expiredTokens: number;
  }> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const activeTokens = await this.tokenRepository.count({
      where: { used: false },
    });

    const usedTokens24h = await this.tokenRepository
      .createQueryBuilder('token')
      .where('token.usedAt > :yesterday', { yesterday })
      .getCount();

    const expiredTokens = await this.tokenRepository.count({
      where: { expiresAt: LessThan(now), used: false },
    });

    return {
      activeTokens,
      usedTokens24h,
      expiredTokens,
    };
  }
}
