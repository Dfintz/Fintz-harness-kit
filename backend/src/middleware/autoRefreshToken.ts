import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { UserSession } from '../models/UserSession';
import { getDiscordService, isDiscordServiceInitialized } from '../services/discord/DiscordService';
import { getTokenEncryptionService } from '../services/security';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Token refresh threshold in milliseconds
 * Refresh tokens when they have less than 1 hour remaining
 */
const TOKEN_REFRESH_THRESHOLD = 60 * 60 * 1000; // 1 hour

/**
 * Automatic Token Refresh Middleware
 *
 * This middleware automatically refreshes Discord OAuth tokens before they expire.
 * It runs after authentication and checks if the Discord access token needs refreshing.
 *
 * Features:
 * - Proactive token refresh (1 hour before expiration)
 * - Transparent to the user (happens in background)
 * - Updates session with new tokens
 * - Logs refresh operations for auditing
 * - Handles refresh failures gracefully
 *
 * Usage:
 * Apply after authenticateToken middleware on routes that need Discord API access:
 *
 * ```typescript
 * router.get('/discord-resource',
 *   authenticateToken,
 *   autoRefreshDiscordToken,
 *   handler
 * );
 * ```
 */
export const autoRefreshDiscordToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip if user is not authenticated
  if (!req.user) {
    next();
    return;
  }

  try {
    // Get user session to check Discord token expiry
    const sessionRepository = AppDataSource.getRepository(UserSession);
    const session = await sessionRepository.findOne({
      where: {
        userId: req.user.id as unknown as number, // userId is UUID in DB despite number type declaration
        isActive: true,
      },
      order: {
        lastActivity: 'DESC',
      },
    });

    // Skip if no active session found
    if (!session) {
      next();
      return;
    }

    // Skip if session doesn't have required Discord tokens or expiry information
    if (
      !session.discordAccessToken ||
      !session.discordRefreshToken ||
      !session.discordTokenExpiry
    ) {
      next();
      return;
    }

    // Check if token needs refreshing
    const now = new Date();
    const tokenExpiry = new Date(session.discordTokenExpiry);
    const timeUntilExpiry = tokenExpiry.getTime() - now.getTime();

    // If token is still valid for more than threshold, skip refresh
    if (timeUntilExpiry > TOKEN_REFRESH_THRESHOLD) {
      next();
      return;
    }

    // Check if Discord service is initialized
    if (!isDiscordServiceInitialized()) {
      logger.warn('Discord service not initialized, skipping token refresh');
      next();
      return;
    }

    logger.info(
      `Auto-refreshing Discord token for user ${req.user.id} (expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes)`
    );

    // Decrypt the refresh token
    const tokenEncryptionService = getTokenEncryptionService();
    const refreshTokenData = JSON.parse(session.discordRefreshToken);
    const decryptedRefreshToken = tokenEncryptionService.decrypt(
      refreshTokenData.encrypted,
      refreshTokenData.iv,
      refreshTokenData.authTag
    );

    // Get Discord service and refresh the token
    const discordService = getDiscordService();
    const newTokens = await discordService.refreshAccessToken(decryptedRefreshToken);

    // Encrypt new tokens
    const encryptedAccessToken = tokenEncryptionService.encrypt(newTokens.access_token);
    const encryptedRefreshToken = tokenEncryptionService.encrypt(newTokens.refresh_token);

    // Calculate new expiry time
    const newExpiry = new Date(now.getTime() + newTokens.expires_in * 1000);

    // Update session with new tokens (store as JSON strings)
    session.discordAccessToken = JSON.stringify(encryptedAccessToken);
    session.discordRefreshToken = JSON.stringify(encryptedRefreshToken);
    session.discordTokenExpiry = newExpiry;
    session.lastActivity = now;

    await sessionRepository.save(session);

    logger.info(
      `Successfully refreshed Discord token for user ${req.user.id}, new expiry: ${newExpiry.toISOString()}`
    );

    // Continue to next middleware
    next();
  } catch (error: unknown) {
    // Log error but don't block the request
    // The request can still proceed even if token refresh fails
    logger.error('Failed to auto-refresh Discord token', {
      error: getErrorMessage(error),
    });

    // If refresh fails, the user may need to re-authenticate
    // but we don't want to break their current request
    next();
  }
};

/**
 * Check if Discord token refresh is needed for a user session
 * Utility function for manual checks
 *
 * @param session - User session to check
 * @returns true if token should be refreshed
 */
export const shouldRefreshDiscordToken = (session: UserSession): boolean => {
  if (!session.discordTokenExpiry) {
    return false;
  }

  const now = new Date();
  const tokenExpiry = new Date(session.discordTokenExpiry);
  const timeUntilExpiry = tokenExpiry.getTime() - now.getTime();

  return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD;
};

/**
 * Manual token refresh function for background jobs
 * Can be used by scheduled tasks to refresh tokens proactively
 *
 * @param userId - User ID to refresh tokens for
 * @returns true if refresh was successful
 */
export const refreshUserDiscordToken = async (userId: number): Promise<boolean> => {
  try {
    const sessionRepository = AppDataSource.getRepository(UserSession);
    const session = await sessionRepository.findOne({
      where: {
        userId,
        isActive: true,
      },
      order: {
        lastActivity: 'DESC',
      },
    });

    if (!session?.discordRefreshToken) {
      return false;
    }

    if (!shouldRefreshDiscordToken(session)) {
      return true; // Token is still valid
    }

    if (!isDiscordServiceInitialized()) {
      logger.warn('Discord service not initialized, cannot refresh token');
      return false;
    }

    const tokenEncryptionService = getTokenEncryptionService();
    const refreshTokenData = JSON.parse(session.discordRefreshToken);
    const decryptedRefreshToken = tokenEncryptionService.decrypt(
      refreshTokenData.encrypted,
      refreshTokenData.iv,
      refreshTokenData.authTag
    );

    const discordService = getDiscordService();
    const newTokens = await discordService.refreshAccessToken(decryptedRefreshToken);

    const now = new Date();
    const encryptedAccessToken = tokenEncryptionService.encrypt(newTokens.access_token);
    const encryptedRefreshToken = tokenEncryptionService.encrypt(newTokens.refresh_token);
    const newExpiry = new Date(now.getTime() + newTokens.expires_in * 1000);

    session.discordAccessToken = JSON.stringify(encryptedAccessToken);
    session.discordRefreshToken = JSON.stringify(encryptedRefreshToken);
    session.discordTokenExpiry = newExpiry;
    session.lastActivity = now;

    await sessionRepository.save(session);

    logger.info(`Background refresh successful for user ${userId}`);
    return true;
  } catch (error: unknown) {
    logger.error(`Failed to refresh Discord token for user ${userId}`, {
      error: getErrorMessage(error),
    });
    return false;
  }
};
