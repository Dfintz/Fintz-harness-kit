/**
 * V1 API Deprecation Middleware
 *
 * Adds deprecation headers and warnings to mapped V1 API responses.
 * Helps clients migrate to mapped V2 successors before V1 is removed.
 */

import { NextFunction, Request, Response } from 'express';

import { logger } from '../utils/logger';

/**
 * API Version Tracking Middleware
 *
 * Tags every request with its API version (`req.apiVersion`) and stamps v2
 * responses with `X-API-Version` / `X-API-Deprecation: false`. The companion
 * `v1DeprecationMiddleware` below stamps v1 responses with the deprecation
 * counterparts — both files co-own the version/deprecation header contract,
 * which is why they live together.
 */
export const trackApiVersion = (req: Request, res: Response, next: NextFunction): void => {
  const isV2 = req.path.startsWith('/api/v2');
  const isV1 = req.path.startsWith('/api') && !isV2;

  let version: 'v1' | 'v2' | 'unknown';
  if (isV2) {
    version = 'v2';
  } else if (isV1) {
    version = 'v1';
  } else {
    version = 'unknown';
  }
  req.apiVersion = version;

  if (isV2) {
    res.setHeader('X-API-Version', '2.0.0');
    res.setHeader('X-API-Deprecation', 'false');
  }

  next();
};

// V1 API sunset date (6 months from now as example)
const SUNSET_DATE = new Date('2026-08-01T00:00:00Z');

// V2 equivalent paths mapping
const V1_TO_V2_PATHS: Record<string, string> = {
  '/api/activities': '/api/v2/activities',
  '/api/admin': '/api/v2/admin',
  '/api/alliance-diplomacy': '/api/v2/alliance-diplomacy',
  '/api/auth': '/api/v2/auth',
  '/api/bounties': '/api/v2/bounties',
  '/api/briefings': '/api/v2/briefings',
  '/api/contacts': '/api/v2/contacts',
  '/api/crews': '/api/v2/crew-assignments',
  '/api/discord': '/api/v2/discord',
  '/api/events': '/api/v2/activities', // Events migrated to activities
  '/api/fleets': '/api/v2/fleets',
  '/api/jobs': '/api/v2/jobs',
  '/api/logistics': '/api/v2/logistics',
  '/api/notifications': '/api/v2/notifications',
  '/api/organizations': '/api/v2/organizations',
  '/api/permissions': '/api/v2/permissions',
  '/api/roles': '/api/v2/roles',
  '/api/rsi': '/api/v2/rsi',
  '/api/ships': '/api/v2/ships',
  '/api/squadrons': '/api/v2/squadrons',
  '/api/tickets': '/api/v2/tickets',
  '/api/trading': '/api/v2/trading',
  '/api/users': '/api/v2/users',
  '/api/webhooks': '/api/v2/webhooks',
};

/**
 * Get V2 equivalent path for a V1 path
 */
function getV2Path(v1Path: string): string | null {
  // Try exact match first
  for (const [v1Pattern, v2Path] of Object.entries(V1_TO_V2_PATHS)) {
    if (v1Path.startsWith(v1Pattern)) {
      return v1Path.replace(v1Pattern, v2Path);
    }
  }
  return null;
}

/**
 * Deprecation severity levels
 */
enum DeprecationLevel {
  INFO = 'info', // V1 works fine, V2 available
  WARNING = 'warning', // V1 will be removed soon
  CRITICAL = 'critical', // V1 being removed imminently
}

/**
 * Get deprecation level based on current date
 */
function getDeprecationLevel(): DeprecationLevel {
  const now = new Date();
  const daysUntilSunset = Math.floor(
    (SUNSET_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilSunset <= 30) {
    return DeprecationLevel.CRITICAL;
  } else if (daysUntilSunset <= 90) {
    return DeprecationLevel.WARNING;
  } else {
    return DeprecationLevel.INFO;
  }
}

/**
 * V1 Deprecation Middleware
 *
 * Adds standard deprecation headers to mapped V1 API responses:
 * - Deprecation: true
 * - Sunset: <date>
 * - Link: <v2-url>; rel="successor-version"
 * - X-API-Warn: Deprecation message
 */
export const v1DeprecationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Only apply to /api paths (not /api/v2)
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/v2/')) {
    return next();
  }

  const v2Path = getV2Path(req.path);
  // If no v2 successor is mapped, do not emit stale v1 deprecation warnings.
  // This keeps deprecation signaling focused on explicitly tracked migration paths.
  if (!v2Path) {
    return next();
  }
  const deprecationLevel = getDeprecationLevel();

  // Add standard deprecation headers (RFC 8594)
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', SUNSET_DATE.toUTCString());

  // Add Link header pointing to V2 equivalent
  if (v2Path) {
    res.setHeader('Link', `<${v2Path}>; rel="successor-version"`);
  }

  // Add custom warning header
  const warningMessage = getWarningMessage(deprecationLevel, v2Path);
  res.setHeader('X-API-Warn', warningMessage);

  // Log V1 API usage for monitoring
  logV1Usage(req, deprecationLevel);

  next();
};

/**
 * Get deprecation warning message based on severity
 */
function getWarningMessage(level: DeprecationLevel, v2Path: string | null): string {
  const baseMessage = `API v1 is deprecated and will be removed on ${SUNSET_DATE.toISOString().split('T')[0]}.`;
  const migrationMessage = v2Path
    ? ` Please migrate to ${v2Path}`
    : ' Please migrate to v2. See /api/v2/health for details.';

  switch (level) {
    case DeprecationLevel.CRITICAL:
      return `CRITICAL: ${baseMessage}${migrationMessage}`;
    case DeprecationLevel.WARNING:
      return `WARNING: ${baseMessage}${migrationMessage}`;
    case DeprecationLevel.INFO:
    default:
      return `${baseMessage}${migrationMessage}`;
  }
}

/**
 * Log V1 API usage for monitoring migration progress
 */
function logV1Usage(req: Request, level: DeprecationLevel): void {
  // Only log warnings and critical to reduce noise
  if (level === DeprecationLevel.INFO) {
    return;
  }

  logger.warn('V1 API usage detected', {
    deprecationLevel: level,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userId: (req as any).user?.id,
  });
}

/**
 * V1 Complete Shutdown Middleware
 *
 * Use this to disable mapped V1 API endpoints after sunset date.
 * Returns 410 Gone for mapped V1 requests with explicit v2 successors.
 */
export const v1ShutdownMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Only apply to /api paths (not /api/v2)
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/v2/')) {
    return next();
  }

  // Exempt public discovery endpoints — these remain accessible after v1 sunset
  const publicPrefixes = [
    '/api/public-directory',
    '/api/public-job-listings',
    '/api/contact-requests',
  ];
  if (publicPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  const now = new Date();
  if (now >= SUNSET_DATE) {
    const v2Path = getV2Path(req.path);

    // Only enforce shutdown for endpoints with an explicit v2 migration path.
    // Unmapped /api routes are handled by their own route policies.
    if (!v2Path) {
      return next();
    }

    res.status(410).json({
      error: 'API Version Discontinued',
      message: `API v1 was discontinued on ${SUNSET_DATE.toISOString()}. Please use API v2.`,
      v2Endpoint: v2Path || '/api/v2',
      documentation: '/api/v2/health',
    });
    return;
  }

  next();
};

/**
 * Get V1 API usage statistics
 * Useful for monitoring migration progress
 */
export async function getV1UsageStats(): Promise<{
  totalRequests: number;
  uniqueEndpoints: string[];
  topEndpoints: Array<{ path: string; count: number }>;
  uniqueUsers: number;
}> {
  // This would integrate with your analytics/metrics system
  // Placeholder implementation
  return {
    totalRequests: 0,
    uniqueEndpoints: [],
    topEndpoints: [],
    uniqueUsers: 0,
  };
}
