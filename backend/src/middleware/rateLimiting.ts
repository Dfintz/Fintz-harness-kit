/**
 * Rate Limiting Middleware (IPv4 + IPv6 aware)
 *
 * We previously disabled all limiters due to issues with IPv6 key generation in express-rate-limit.
 * This implementation restores critical limiters with a custom keyGenerator that safely normalizes
 * both IPv4 and IPv6 addresses (including X-Forwarded-For chains) while avoiding entropy loss.
 *
 * UPDATED: Progressive enabling of rate limiters for improved security coverage.
 * Now includes: authentication, user operations, fleet operations, and sensitive actions.
 *
 * ENHANCED: Added per-user rate limiting in addition to per-IP rate limiting for authenticated endpoints.
 *
 * REDIS INTEGRATION: Uses Redis-backed store for distributed rate limiting across multiple instances.
 * Falls back to in-memory store if Redis is unavailable.
 */

import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator, RateLimitRequestHandler } from 'express-rate-limit';

import {
  RATE_LIMIT_MAX_REQUESTS as DEFAULT_MAX,
  RATE_LIMIT_WINDOW_MS as DEFAULT_WINDOW_MS,
  getRoleLimitMultiplier,
  isIpWhitelisted,
  isUserWhitelisted,
} from '../config/rateLimitConfig';
import { rateLimitMonitor } from '../services/security/RateLimitMonitorService';
import { normalizeIP } from '../utils/ipWhitelist';
import { logger } from '../utils/logger';
import { createRateLimitStore } from '../utils/rateLimitStore';

// Use req.ip which Express resolves correctly when trust proxy is configured.
// Do NOT manually parse X-Forwarded-For — that bypasses Express's trust proxy
// hop validation and is vulnerable to header spoofing (CWE-346).
// Applies the same normalisation pipeline as getRateLimitKey in security.ts:
// req.ip → ipKeyGenerator (IPv6 handling) → normalizeIP (::ffff: stripping, localhost).
function extractClientIp(req: Request): string {
  // Cache parsed result on request to avoid re-parsing per limiter
  const cached = (req as unknown as Record<string, unknown>)._clientIp as string | undefined;
  if (cached) {
    return cached;
  }

  const raw = req.ip ?? 'unknown';
  const ip = normalizeIP(ipKeyGenerator(raw)) || 'unknown';

  (req as unknown as Record<string, unknown>)._clientIp = ip;
  return ip;
}

/**
 * Extract user ID from authenticated request
 * Falls back to IP if not authenticated
 */
function extractUserKey(req: Request): string {
  // Check for authenticated user (using interface to avoid any type)
  interface AuthUser {
    id?: string;
  }
  const user = (req as Request & { user?: AuthUser }).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  // Fall back to IP-based key for unauthenticated requests
  return `ip:${extractClientIp(req)}`;
}

/**
 * Create a combined key generator that uses both IP and user ID
 * This provides dual-layer rate limiting protection
 */
function extractCombinedKey(req: Request): string {
  const ip = extractClientIp(req);
  interface AuthUser {
    id?: string;
  }
  const user = (req as Request & { user?: AuthUser }).user;
  if (user?.id) {
    return `${ip}:${user.id}`;
  }
  return ip;
}

/**
 * Skip rate limiting for whitelisted users and IPs
 * Returns true if the request should skip rate limiting
 */
function shouldSkipRateLimit(req: Request): boolean {
  // Check IP whitelist
  const ip = extractClientIp(req);
  if (isIpWhitelisted(ip)) {
    logger.debug(`Rate limit bypassed for whitelisted IP: ${ip}`);
    return true;
  }

  // Check user whitelist
  interface AuthUser {
    id?: string;
  }
  const user = (req as Request & { user?: AuthUser }).user;
  if (user?.id && isUserWhitelisted(user.id)) {
    logger.debug(`Rate limit bypassed for whitelisted user: ${user.id}`);
    return true;
  }

  return false;
}

/**
 * Handler called when rate limit is exceeded
 * Logs violation and sends appropriate response
 */
function onRateLimitExceeded(req: Request, res: Response): void {
  const ip = extractClientIp(req);
  interface AuthUser {
    id?: string;
    role?: string;
  }
  const user = (req as Request & { user?: AuthUser }).user;

  // Determine identifier type
  let identifierType: 'user' | 'ip' | 'combined' = 'ip';
  let identifier = ip;

  if (user?.id) {
    identifierType = 'user';
    identifier = user.id;
  }

  // Extract rate limit values from headers (convert from string to number)
  const limitHeader = res.getHeader('RateLimit-Limit');
  const remainingHeader = res.getHeader('RateLimit-Remaining');

  const limit = typeof limitHeader === 'string' ? Number(limitHeader) : 0;
  const current = typeof remainingHeader === 'string' ? Number(remainingHeader) : 0;

  // Log violation asynchronously without blocking response
  void rateLimitMonitor.logViolation(
    {
      identifier,
      identifierType,
      endpoint: req.path,
      timestamp: Date.now(),
      userAgent: req.headers['user-agent'],
      limit,
      current,
    },
    req
  );
}

interface LimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: 'ip' | 'user' | 'combined';
  skipRoleMultiplier?: boolean; // If true, don't apply role-based multipliers
}

function createLimiter(opts: LimiterOptions = {}): RateLimitRequestHandler {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_MAX,
    message = 'Too many requests, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    keyGenerator = 'ip',
    skipRoleMultiplier = false,
  } = opts;

  // Select key generator based on option
  let keyGen: (req: Request) => string;
  switch (keyGenerator) {
    case 'user':
      keyGen = extractUserKey;
      break;
    case 'combined':
      keyGen = extractCombinedKey;
      break;
    case 'ip':
    default:
      keyGen = extractClientIp;
  }

  // Create Redis store if available
  const store = createRateLimitStore();

  return rateLimit({
    windowMs,
    // Dynamic max based on user role if not skipped
    max: (req: Request) => {
      if (skipRoleMultiplier) {
        return max;
      }

      // Apply role-based multiplier
      interface AuthUser {
        role?: string;
      }
      const user = (req as Request & { user?: AuthUser }).user;
      const multiplier = getRoleLimitMultiplier(user?.role);
      return Math.floor(max * multiplier);
    },
    message,
    standardHeaders,
    legacyHeaders,
    keyGenerator: keyGen,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    // Skip for whitelisted users/IPs
    skip: shouldSkipRateLimit,
    // Handle rate limit exceeded
    handler: (req: Request, res: Response, _next: NextFunction) => {
      onRateLimitExceeded(req, res);

      // Calculate retry after seconds
      const resetTime = res.getHeader('RateLimit-Reset');
      const retryAfter = resetTime
        ? Math.ceil((Number(resetTime) * 1000 - Date.now()) / 1000)
        : Math.ceil(windowMs / 1000);

      // Set Retry-After header
      res.setHeader('Retry-After', retryAfter);

      // Send 429 Too Many Requests
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    },
    // Use Redis store if available, otherwise use default MemoryStore
    store,
    // Disable all validation checks - our extractClientIp is already IPv6-aware
    validate: false,
  });
}

/**
 * Create a per-user rate limiter for authenticated endpoints
 * Uses user ID as the rate limit key instead of IP
 * This prevents a single user from consuming all requests across shared IPs
 */
function createUserRateLimiter(
  opts: Omit<LimiterOptions, 'keyGenerator'> = {}
): RateLimitRequestHandler {
  return createLimiter({ ...opts, keyGenerator: 'user' });
}

/**
 * Create a combined rate limiter that uses both IP and user ID
 * Provides protection against both IP-based and account-based abuse
 */
function createCombinedRateLimiter(
  opts: Omit<LimiterOptions, 'keyGenerator'> = {}
): RateLimitRequestHandler {
  return createLimiter({ ...opts, keyGenerator: 'combined' });
}

// ========================================
// HIGH-VALUE SECURITY ENDPOINTS (ENABLED)
// ========================================
export const loginRateLimiter = createLimiter({
  max: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Too many login attempts.',
});
export const authenticationRateLimiter = createLimiter({ max: 1200 });
export const passwordResetRateLimiter = createLimiter({
  max: 5,
  windowMs: 30 * 60 * 1000,
  message: 'Password reset rate limit exceeded.',
});
export const refreshTokenRateLimiter = createLimiter({ max: 240 });
export const userCreationRateLimiter = createLimiter({
  max: 20,
  windowMs: 60 * 60 * 1000,
  message: 'User creation rate limit exceeded.',
});
export const generalRateLimiter = createLimiter({ max: 2000, windowMs: 60 * 60 * 1000 });

// Stricter limiter for public endpoints (directory, sitemap, stats) to prevent scraping/DoS
export const publicEndpointRateLimiter = createLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Too many requests to public endpoints. Please try again later.',
});

// ========================================
// USER/ACCOUNT OPERATIONS (NOW ENABLED)
// ========================================
export const registrationRateLimiter = createLimiter({
  max: 5,
  windowMs: 60 * 60 * 1000,
  message: 'Too many registration attempts. Try again later.',
});
export const twoFactorRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: '2FA rate limit exceeded. Please wait a few minutes before trying again.',
  keyGenerator: 'user',
});
export const profileUpdateRateLimiter = createLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Profile update rate limit exceeded.',
});
export const avatarUploadRateLimiter = createLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Avatar upload rate limit exceeded.',
});
export const accountDeletionRateLimiter = createLimiter({
  max: 3,
  windowMs: 60 * 60 * 1000,
  message: 'Account deletion rate limit exceeded.',
});
export const emailVerificationRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Email verification rate limit exceeded.',
});
export const userSearchRateLimiter = createLimiter({
  max: 120,
  windowMs: 15 * 60 * 1000,
  message: 'User search rate limit exceeded.',
});

// ========================================
// ORGANIZATION OPERATIONS (NOW ENABLED)
// ========================================
export const organizationCreationRateLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Organization creation rate limit exceeded.',
});
export const organizationUpdateRateLimiter = createLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Organization update rate limit exceeded.',
});
export const organizationInvitationRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Invitation rate limit exceeded.',
});
export const hierarchyOperationsRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Hierarchy operations rate limit exceeded.',
});
export const permissionOperationsRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Permission operations rate limit exceeded.',
});
export const organizationBulkOperationsRateLimiter = createUserRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Organization bulk operations rate limit exceeded.',
});
export const organizationBulkMemberOperationsRateLimiter = createUserRateLimiter({
  max: 15,
  windowMs: 15 * 60 * 1000,
  message: 'Organization bulk member operations rate limit exceeded.',
});

// ========================================
// FLEET/SHIP OPERATIONS (NOW ENABLED)
// ========================================
export const fleetReadRateLimiter = createLimiter({
  max: 400,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet read rate limit exceeded.',
});
export const fleetWriteRateLimiter = createLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet write rate limit exceeded.',
});
export const fleetSharingRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet sharing rate limit exceeded.',
});
export const fleetExportRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet export rate limit exceeded.',
});
export const shipCreationRateLimiter = createLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Ship creation rate limit exceeded.',
});
export const fleetBulkOperationsRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Bulk operations rate limit exceeded.',
});
export const fleetMemberOperationsRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet member operations rate limit exceeded.',
});
export const fleetQueryRateLimiter = createLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet query rate limit exceeded.',
});
export const fleetAnalyticsRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Fleet analytics rate limit exceeded.',
});
export const shipReadRateLimiter = createLimiter({
  max: 400,
  windowMs: 15 * 60 * 1000,
  message: 'Ship read rate limit exceeded.',
});
export const shipWriteRateLimiter = createLimiter({
  max: 300,
  windowMs: 15 * 60 * 1000,
  message: 'Ship write rate limit exceeded.',
});
export const shipImageUploadRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Ship image upload rate limit exceeded.',
});
export const shipMassActionRateLimiter = createLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Ship mass action rate limit exceeded.',
});

// ========================================
// COMMUNICATION OPERATIONS (NOW ENABLED)
// ========================================
export const chatRateLimiter = createLimiter({
  max: 100,
  windowMs: 5 * 60 * 1000,
  message: 'Chat rate limit exceeded.',
});
export const messageCreationRateLimiter = createLimiter({
  max: 60,
  windowMs: 5 * 60 * 1000,
  message: 'Message creation rate limit exceeded.',
});
export const bulkMessageRateLimiter = createLimiter({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Bulk message rate limit exceeded.',
});
export const channelCreationRateLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Channel creation rate limit exceeded.',
});
export const reactionRateLimiter = createLimiter({
  max: 100,
  windowMs: 5 * 60 * 1000,
  message: 'Reaction rate limit exceeded.',
});

// ========================================
// EXTERNAL INTEGRATIONS (NOW ENABLED)
// ========================================
export const integrationSyncRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Integration sync rate limit exceeded.',
});
export const webhookCreationRateLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Webhook creation rate limit exceeded.',
});
export const rsiApiRateLimiter = createLimiter({
  max: 30,
  windowMs: 5 * 60 * 1000,
  message: 'RSI API rate limit exceeded.',
});
export const discordWebhookRateLimiter = createLimiter({
  max: 30,
  windowMs: 5 * 60 * 1000,
  message: 'Discord webhook rate limit exceeded.',
});
export const integrationOperationsRateLimiter = createLimiter({
  max: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Integration operations rate limit exceeded.',
});

// ========================================
// RESOURCE INTENSIVE OPERATIONS (NOW ENABLED)
// ========================================
export const imageProcessingRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Image processing rate limit exceeded.',
});
export const fileUploadRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'File upload rate limit exceeded.',
});
export const exportOperationsRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Export operations rate limit exceeded.',
});

// ========================================
// GAME-SPECIFIC OPERATIONS (NOW ENABLED)
// ========================================
export const intelOperationsRateLimiter = createLimiter({
  max: 200,
  windowMs: 15 * 60 * 1000,
  message: 'Intel operations rate limit exceeded.',
});
export const intelWriteRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Intel write rate limit exceeded.',
});
export const intelDeleteRateLimiter = createLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Intel delete rate limit exceeded.',
});
export const intelOfficerManagementRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Intel officer management rate limit exceeded.',
});
export const tradingOperationsRateLimiter = createLimiter({
  max: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Trading operations rate limit exceeded.',
});
export const resourceHarvestingRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Resource harvesting rate limit exceeded.',
});
export const tournamentOperationsRateLimiter = createLimiter({
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Tournament operations rate limit exceeded.',
});
export const leaderboardQueriesRateLimiter = createLimiter({
  max: 60,
  windowMs: 15 * 60 * 1000,
  message: 'Leaderboard query rate limit exceeded.',
});
export const inventoryOperationsRateLimiter = createLimiter({
  max: 50,
  windowMs: 15 * 60 * 1000,
  message: 'Inventory operations rate limit exceeded.',
});
export const alertOperationsRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Alert operations rate limit exceeded.',
});
export const dashboardQueriesRateLimiter = createLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Dashboard query rate limit exceeded.',
});

// ========================================
// RECRUITMENT OPERATIONS (NOW ENABLED)
// ========================================
export const applicationSubmissionRateLimiter = createLimiter({
  max: 10,
  windowMs: 60 * 60 * 1000,
  message: 'Application submission rate limit exceeded.',
});
export const recruitmentOperationsRateLimiter = createLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Recruitment operations rate limit exceeded.',
});

// ========================================
// PER-USER RATE LIMITERS (Security Hardening)
// These limiters track requests per user ID instead of per IP
// Useful for preventing account-based abuse on shared networks
// ========================================
export const userApiRateLimiter = createUserRateLimiter({
  max: 1000,
  windowMs: 15 * 60 * 1000,
  message: 'User API rate limit exceeded.',
});
export const userWriteOperationsRateLimiter = createUserRateLimiter({
  max: 200,
  windowMs: 15 * 60 * 1000,
  message: 'User write operations rate limit exceeded.',
});
export const userSensitiveOperationsRateLimiter = createUserRateLimiter({
  max: 40,
  windowMs: 15 * 60 * 1000,
  message: 'User sensitive operations rate limit exceeded.',
});

// ========================================
// ADMIN OPERATIONS
// ========================================
export const adminReadRateLimiter = createUserRateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Admin read rate limit exceeded.',
});
export const adminWriteRateLimiter = createUserRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Admin write rate limit exceeded.',
});

// ========================================
// COMBINED RATE LIMITERS (IP + User)
// Double protection for critical endpoints
// ========================================
export const criticalOperationsRateLimiter = createCombinedRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Critical operation rate limit exceeded.',
});
export const sensitiveDataAccessRateLimiter = createCombinedRateLimiter({
  max: 30,
  windowMs: 15 * 60 * 1000,
  message: 'Sensitive data access rate limit exceeded.',
});

// Helper: expose factories for custom rate limiter creation
export const createCustomRateLimiter = createLimiter;
export const createCustomUserRateLimiter = createUserRateLimiter;
export const createCustomCombinedRateLimiter = createCombinedRateLimiter;
