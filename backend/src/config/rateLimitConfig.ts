/**
 * Rate Limiting Configuration
 *
 * Centralized configuration for all rate limiting settings.
 * Environment variables allow per-deployment customization.
 *
 * Configuration Hierarchy:
 * 1. Environment variables (highest priority)
 * 2. Role-based overrides (if user has specific role)
 * 3. Default values (fallback)
 */

import { logger } from '../utils/logger';

/**
 * Rate limit window duration in milliseconds
 * Default: 15 minutes
 */
export const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);

/**
 * Default maximum requests per window
 * Default: 100 requests per 15 minutes
 */
export const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 200);

/**
 * Enable Redis-backed rate limiting (distributed)
 * Default: true (use Redis if available)
 */
export const RATE_LIMIT_REDIS_ENABLED = process.env.RATE_LIMIT_REDIS_ENABLED !== 'false';

/**
 * Prefix for Redis rate limit keys
 * Helps prevent key collisions with other Redis data
 */
export const RATE_LIMIT_REDIS_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX ?? 'ratelimit:';

/**
 * Skip rate limiting for these User IDs (whitelist)
 * Comma-separated list of user IDs to bypass rate limiting
 * Use sparingly and only for trusted service accounts
 */
export const RATE_LIMIT_WHITELIST_USERS =
  process.env.RATE_LIMIT_WHITELIST_USERS?.split(',')
    .map(id => id.trim())
    .filter(Boolean) ?? [];

/**
 * Skip rate limiting for these IP addresses (whitelist)
 * Comma-separated list of IPs to bypass rate limiting
 * Useful for internal services, health checks, or trusted partners
 */
export const RATE_LIMIT_WHITELIST_IPS =
  process.env.RATE_LIMIT_WHITELIST_IPS?.split(',')
    .map(ip => ip.trim())
    .filter(Boolean) ?? [];

/**
 * Enable rate limit violation logging
 * Default: true
 */
export const RATE_LIMIT_LOGGING_ENABLED = process.env.RATE_LIMIT_LOGGING_ENABLED !== 'false';

/**
 * Alert threshold: notify admins after N violations from same user/IP
 * Default: 5 violations
 */
export const RATE_LIMIT_ALERT_THRESHOLD = Number(process.env.RATE_LIMIT_ALERT_THRESHOLD ?? 5);

/**
 * Role-based rate limit multipliers
 * Allows different rate limits based on user role
 * Premium users can make more requests than free users
 */
export const ROLE_RATE_LIMIT_MULTIPLIERS: Record<string, number> = {
  admin: Number(process.env.RATE_LIMIT_ADMIN_MULTIPLIER || 5), // 5x normal limit
  premium: Number(process.env.RATE_LIMIT_PREMIUM_MULTIPLIER || 3), // 3x normal limit
  user: Number(process.env.RATE_LIMIT_USER_MULTIPLIER || 1), // 1x normal limit (default)
  guest: Number(process.env.RATE_LIMIT_GUEST_MULTIPLIER || 0.5), // 0.5x normal limit
};

/**
 * Get rate limit multiplier for a user role
 * Returns 1.0 if role not found (default rate limit)
 */
export function getRoleLimitMultiplier(role?: string): number {
  if (!role) {
    return 1.0;
  }
  return ROLE_RATE_LIMIT_MULTIPLIERS[role.toLowerCase()] || 1.0;
}

/**
 * Check if a user ID is whitelisted
 */
export function isUserWhitelisted(userId: string): boolean {
  return RATE_LIMIT_WHITELIST_USERS.includes(userId);
}

/**
 * Check if an IP address is whitelisted
 */
export function isIpWhitelisted(ip: string): boolean {
  return RATE_LIMIT_WHITELIST_IPS.includes(ip);
}

/**
 * Log rate limiting configuration on startup
 */
export function logRateLimitConfig(): void {
  logger.info('Rate Limiting Configuration:');
  logger.info(`  Window: ${RATE_LIMIT_WINDOW_MS}ms (${RATE_LIMIT_WINDOW_MS / 1000 / 60} minutes)`);
  logger.info(`  Max Requests: ${RATE_LIMIT_MAX_REQUESTS}`);
  logger.info(`  Redis Enabled: ${RATE_LIMIT_REDIS_ENABLED}`);
  logger.info(`  Redis Prefix: ${RATE_LIMIT_REDIS_PREFIX}`);
  logger.info(`  Logging Enabled: ${RATE_LIMIT_LOGGING_ENABLED}`);
  logger.info(`  Alert Threshold: ${RATE_LIMIT_ALERT_THRESHOLD} violations`);

  if (RATE_LIMIT_WHITELIST_USERS.length > 0) {
    logger.info(`  Whitelisted Users: ${RATE_LIMIT_WHITELIST_USERS.length} user(s)`);
  }

  if (RATE_LIMIT_WHITELIST_IPS.length > 0) {
    logger.info(`  Whitelisted IPs: ${RATE_LIMIT_WHITELIST_IPS.length} IP(s)`);
  }

  logger.info('  Role Multipliers:');
  Object.entries(ROLE_RATE_LIMIT_MULTIPLIERS).forEach(([role, multiplier]) => {
    logger.info(`    ${role}: ${multiplier}x`);
  });
}
