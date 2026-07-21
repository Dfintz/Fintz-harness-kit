import { NextFunction, Response } from 'express';

import { TwoFactorService } from '../services/authentication/TwoFactorService';
import { UserService } from '../services/user';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Configuration for 2FA challenge middleware
 */
export interface TwoFactorChallengeConfig {
  /** Header name for 2FA code */
  codeHeader: string;
  /** Require 2FA for all users or only those with 2FA enabled */
  requireEnabled: boolean;
  /** Actions that require 2FA challenge */
  sensitiveActions: string[];
  /** Skip 2FA for certain roles */
  skipForRoles?: string[];
  /** Time window (in seconds) to allow same code reuse */
  codeReuseWindow: number;
}

const defaultConfig: TwoFactorChallengeConfig = {
  codeHeader: 'X-2FA-Code',
  requireEnabled: false, // Only require if user has 2FA enabled
  sensitiveActions: [
    'cross-tenant-admin',
    'user-delete',
    'organization-delete',
    'permission-grant-admin',
    'security-settings-change',
    'gdpr-data-deletion',
  ],
  skipForRoles: [],
  codeReuseWindow: 30, // 30 seconds
};

/**
 * Cache for recently validated 2FA codes to allow reuse within time window
 */
const validatedCodes: Map<string, { code: string; timestamp: number }> = new Map();

/**
 * Clean up expired codes periodically
 */
setInterval(() => {
  const now = Date.now();
  const window = defaultConfig.codeReuseWindow * 1000;
  for (const [key, value] of validatedCodes.entries()) {
    if (now - value.timestamp > window) {
      validatedCodes.delete(key);
    }
  }
}, 60 * 1000).unref(); // Every minute

/**
 * Middleware factory for 2FA challenge on sensitive operations
 *
 * This middleware requires users with 2FA enabled to provide a valid
 * TOTP code for sensitive operations like cross-tenant admin actions.
 *
 * The 2FA code should be sent in the X-2FA-Code header (or configured header).
 */
export const twoFactorChallengeMiddleware = (
  action: string,
  config: Partial<TwoFactorChallengeConfig> = {}
) => {
  const finalConfig = { ...defaultConfig, ...config };

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip if not authenticated
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to perform this action',
        });
        return;
      }

      // Skip for allowed roles
      if (finalConfig.skipForRoles?.includes(req.user.role)) {
        return next();
      }

      // Check if action requires 2FA challenge
      if (!finalConfig.sensitiveActions.includes(action)) {
        return next();
      }

      // Get user to check 2FA status
      const userService = new UserService();
      const user = await userService.getUserById(req.user.id);

      if (!user) {
        res.status(401).json({
          error: 'User not found',
          message: 'Unable to verify user identity',
        });
        return;
      }

      // Skip if 2FA not enabled and not required
      if (!user.twoFactorEnabled && !finalConfig.requireEnabled) {
        logger.info(`2FA challenge skipped for ${action} - user has no 2FA`, {
          userId: req.user.id,
          action,
        });
        return next();
      }

      // Require 2FA code
      const twoFactorCode = req.headers[finalConfig.codeHeader.toLowerCase()] as string;

      if (!twoFactorCode) {
        logger.warn(`2FA challenge required for ${action}`, {
          userId: req.user.id,
          action,
          path: req.path,
        });

        res.status(403).json({
          error: '2FA verification required',
          message: `This action requires 2FA verification. Please provide your 2FA code in the ${finalConfig.codeHeader} header.`,
          code: '2FA_REQUIRED',
          action,
        });
        return;
      }

      // Check if code was recently validated (within reuse window)
      const cacheKey = `${req.user.id}:${action}`;
      const cached = validatedCodes.get(cacheKey);
      const now = Date.now();

      if (
        cached?.code === twoFactorCode &&
        now - cached.timestamp < finalConfig.codeReuseWindow * 1000
      ) {
        logger.debug(`2FA code reused within window for ${action}`, {
          userId: req.user.id,
        });
        return next();
      }

      // Validate 2FA code
      const twoFactorService = new TwoFactorService();

      if (!user.twoFactorSecret) {
        res.status(403).json({
          error: '2FA not configured',
          message: 'You must set up 2FA before performing this action',
          code: '2FA_NOT_CONFIGURED',
        });
        return;
      }

      const isValid = twoFactorService.verifyToken(user.twoFactorSecret, twoFactorCode);

      if (!isValid) {
        logger.warn(`Invalid 2FA code for ${action}`, {
          userId: req.user.id,
          action,
          path: req.path,
        });

        res.status(403).json({
          error: 'Invalid 2FA code',
          message: 'The 2FA code provided is invalid or expired',
          code: '2FA_INVALID',
        });
        return;
      }

      // Cache successful validation
      validatedCodes.set(cacheKey, { code: twoFactorCode, timestamp: now });

      logger.info(`2FA challenge passed for ${action}`, {
        userId: req.user.id,
        action,
        path: req.path,
      });

      next();
    } catch (error) {
      logger.error('2FA challenge middleware error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to validate 2FA',
      });
    }
  };
};

/**
 * Pre-configured middleware for cross-tenant admin actions
 */
export const crossTenantAdmin2faChallenge = twoFactorChallengeMiddleware('cross-tenant-admin');

/**
 * Pre-configured middleware for GDPR data deletion
 */
export const gdprDeletion2faChallenge = twoFactorChallengeMiddleware('gdpr-data-deletion');

/**
 * Pre-configured middleware for security settings changes
 */
export const securitySettings2faChallenge = twoFactorChallengeMiddleware(
  'security-settings-change'
);
