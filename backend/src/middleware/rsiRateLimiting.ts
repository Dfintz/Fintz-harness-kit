/**
 * RSI Verification Rate Limiting Middleware
 *
 * Provides per-user rate limiting for RSI verification endpoints
 * to prevent brute force attacks and API abuse.
 *
 * Uses Redis-backed rate tracking when available for distributed deployments.
 * Falls back to in-memory store when Redis is unavailable.
 */

import { NextFunction, Request, Response } from 'express';

import { RATE_LIMIT_REDIS_ENABLED } from '../config/rateLimitConfig';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

import { AuthRequest } from './auth';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store (fallback when Redis is unavailable)
 * Key: "limiterName:userId" or "limiterName:ip"
 */
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired in-memory entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
).unref();

const REDIS_KEY_PREFIX = 'rsi-ratelimit:';

/**
 * Check if Redis is available for rate limiting
 */
function isRedisAvailable(): boolean {
  if (!RATE_LIMIT_REDIS_ENABLED) {return false;}
  const status = redisClient.getStatus();
  return status.enabled && status.connected;
}

/**
 * Get rate limit entry from store (Redis or memory)
 */
async function getEntry(key: string): Promise<RateLimitEntry | null> {
  if (isRedisAvailable()) {
    const entry = await redisClient.get<RateLimitEntry>(`${REDIS_KEY_PREFIX}${key}`);
    return entry;
  }
  return memoryStore.get(key) ?? null;
}

/**
 * Set rate limit entry in store (Redis or memory)
 */
async function setEntry(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
  if (isRedisAvailable()) {
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await redisClient.set(`${REDIS_KEY_PREFIX}${key}`, entry, ttlSeconds);
  } else {
    memoryStore.set(key, entry);
  }
}

/**
 * Create a per-user rate limiter middleware
 * @param name - Name for this limiter (used as prefix in store)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param skipAdmin - Whether to skip rate limiting for admin users
 */
function createUserRateLimiter(
  name: string,
  maxRequests: number,
  windowMs: number,
  skipAdmin = true
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    const userRole = authReq.user?.role;

    // Skip rate limiting for admins if configured
    if (skipAdmin && userRole === 'admin') {
      next();
      return;
    }

    // Key by user ID (preferred) or IP (fallback)
    const key = `${name}:${userId || req.ip || 'unknown'}`;
    const now = Date.now();

    // Handle async rate limit check
    (async () => {
      let entry = await getEntry(key);

      // Reset if window has passed
      if (!entry || entry.resetAt <= now) {
        entry = {
          count: 0,
          resetAt: now + windowMs,
        };
      }

      entry.count++;
      const ttlMs = entry.resetAt - now;
      await setEntry(key, entry, ttlMs);

      // Set standard rate limit headers
      const remaining = Math.max(0, maxRequests - entry.count);
      const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetSeconds.toString());

      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter.toString());

        logger.warn(
          `RSI rate limit exceeded for ${key}: ${entry.count}/${maxRequests} in ${windowMs}ms window`
        );

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please try again in ${retryAfter} seconds.`,
            retryAfter,
          },
        });
        return;
      }

      next();
    })().catch(err => {
      // On store failure, allow the request through (fail open for availability)
      logger.error('Rate limit check failed, allowing request:', err);
      next();
    });
  };
}

/**
 * Rate limiter for starting RSI verification
 * 3 attempts per hour per user - prevents abuse of code generation
 */
export const rsiVerificationStartLimiter = createUserRateLimiter(
  'rsi-start',
  3, // 3 requests
  60 * 60 * 1000 // per hour
);

/**
 * Rate limiter for completing RSI verification
 * 10 attempts per 10 minutes per user - allows retries but prevents brute force
 */
export const rsiVerificationCompleteLimiter = createUserRateLimiter(
  'rsi-complete',
  10, // 10 requests
  10 * 60 * 1000 // per 10 minutes
);

/**
 * Rate limiter for checking RSI verification status
 * 30 requests per minute per user - allows reasonable polling
 */
export const rsiVerificationStatusLimiter = createUserRateLimiter(
  'rsi-status',
  30, // 30 requests
  60 * 1000 // per minute
);
