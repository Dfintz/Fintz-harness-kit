import { Response } from 'express';

import * as rateLimitConfig from '../../config/rateLimitConfig';
import { AuthRequest } from '../../middleware/auth';
import { rateLimitConfigService } from '../../services/security/RateLimitConfigService';
import { BaseController } from '../BaseController';

/**
 * Rate Limit Controller (v2)
 *
 * Admin endpoints for viewing and managing rate limit configuration.
 * Reads from rateLimitConfig (env-based defaults) merged with runtime
 * overrides from RateLimitConfigService (Redis-backed).
 */
export class RateLimitController extends BaseController {
  getConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const overrides = await rateLimitConfigService.getOverrides();

      res.json({
        success: true,
        data: {
          windowMs: rateLimitConfig.RATE_LIMIT_WINDOW_MS,
          maxRequests: rateLimitConfig.RATE_LIMIT_MAX_REQUESTS,
          redisEnabled: rateLimitConfig.RATE_LIMIT_REDIS_ENABLED,
          redisPrefix: rateLimitConfig.RATE_LIMIT_REDIS_PREFIX,
          loggingEnabled: rateLimitConfig.RATE_LIMIT_LOGGING_ENABLED,
          alertThreshold: rateLimitConfig.RATE_LIMIT_ALERT_THRESHOLD,
          roleMultipliers: rateLimitConfig.ROLE_RATE_LIMIT_MULTIPLIERS,
          whitelistedUsers: rateLimitConfig.RATE_LIMIT_WHITELIST_USERS.length,
          whitelistedIps: rateLimitConfig.RATE_LIMIT_WHITELIST_IPS.length,
          endpointOverrides: overrides,
        },
      });
    });
  };

  updateConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { endpoints } = req.body as {
        endpoints: Record<string, { windowMs?: number; maxRequests?: number }>;
      };

      const overrides = await rateLimitConfigService.updateOverrides(endpoints, user.id);

      res.json({
        success: true,
        data: {
          message: 'Rate limit configuration updated',
          endpointOverrides: overrides,
        },
      });
    });
  };

  getUsage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);

      const isWhitelisted = rateLimitConfig.isUserWhitelisted(user.id);
      const roleMultiplier = rateLimitConfig.getRoleLimitMultiplier(
        (req as AuthRequest & { user?: { role?: string } }).user?.role
      );

      res.json({
        success: true,
        data: {
          userId: user.id,
          isWhitelisted,
          roleMultiplier,
          effectiveLimit: Math.ceil(rateLimitConfig.RATE_LIMIT_MAX_REQUESTS * roleMultiplier),
          windowMs: rateLimitConfig.RATE_LIMIT_WINDOW_MS,
        },
      });
    });
  };

  reset = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { userId } = req.body as { userId: string };

      const result = await rateLimitConfigService.resetUserRateLimits(userId);

      res.json({
        success: true,
        data: {
          userId,
          cleared: result.cleared,
          message:
            result.cleared > 0
              ? `Rate limits reset for user ${userId} (${result.cleared} keys cleared)`
              : `No active rate limit counters found for user ${userId}`,
        },
      });
    });
  };
}
