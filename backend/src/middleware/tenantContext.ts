import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { User } from '../models/User';
import { UserPreferencesService } from '../services/user/UserPreferencesService';
import { logger } from '../utils/logger';
import { getRoleName } from '../utils/roleUtils';

import { AuthRequest } from './auth';

// Short-lived in-memory cache for tenant context membership lookups.
// Avoids hitting organization_memberships on every request for the
// same user+org combination. Entries auto-expire after 60 seconds.
const MEMBERSHIP_CACHE_TTL_MS = 60_000;
const membershipCache = new Map<
  string,
  { membership: OrganizationMembership | null; expiresAt: number }
>();

/** Evict expired entries (runs inline, bounded by map size). */
function evictExpiredMemberships(): void {
  if (membershipCache.size < 50) {
    return;
  }
  const now = Date.now();
  for (const [key, entry] of membershipCache) {
    if (entry.expiresAt <= now) {
      membershipCache.delete(key);
    }
  }
}

/** Look up membership with 60s cache. */
async function getCachedMembership(
  userId: string,
  organizationId: string
): Promise<OrganizationMembership | null> {
  const key = `${userId}:${organizationId}`;
  const now = Date.now();

  const cached = membershipCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.membership;
  }

  evictExpiredMemberships();

  const userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
  const membership = await userOrgRepo
    .createQueryBuilder('membership')
    .leftJoinAndSelect('membership.organization', 'organization')
    .where('membership.userId = :userId', { userId })
    .andWhere('membership.organizationId = :organizationId', { organizationId })
    .andWhere('membership.isActive = :isActive', { isActive: true })
    .getOne();

  membershipCache.set(key, { membership, expiresAt: now + MEMBERSHIP_CACHE_TTL_MS });
  return membership;
}

const TENANT_OPTIONAL_EXACT_PATHS = new Set([
  '/users/me',
  '/users/me/preferences',
  '/users/me/organizations',
  '/users/me/ships',
  '/users/me/loadouts',
  '/users/me/activity',
  '/activities', // Activity search/browse (all users)
  '/activities/upcoming',
  '/activities/recommended',
  '/briefings',
  // '/inventory', — removed: inventory requires org context via injectOrgFromContext
  '/recruitments',
  '/gdpr/consent',
  '/gdpr/export',
  '/gdpr/export-request',
  '/gdpr/export-requests',
  '/gdpr/delete-account',
  '/gdpr/cancel-deletion',
  '/gdpr/deletion-status',
  '/gdpr/statistics',
  '/gdpr/dashboard',
  '/directory/federations',
  '/directory/organizations',
  '/directory/contact',
  '/federations', // Federation routes are cross-org by nature
  '/notifications', // Personal notifications
  '/inbox', // Personal inbox / contact requests
  '/messages', // Personal messages
  '/profile', // User profile
  '/bounty', // Bounty profile
  '/bounties', // Bounty board browsing
  '/ships/catalogue', // Ship catalogue (public data)
  '/trading', // Trading routes browsing
  '/organizations', // Org listing/browsing
  '/rsi/verify', // RSI account verification (personal — operates on req.user.id, no active org required)
  '/admin', // Admin portal — platform-level, uses own auth (requireAdmin)
]);

// Prefixes cover both the bare resource and its sub-paths (e.g. `/bounties/:id`).
// These were previously matched by unanchored substring regexes; prefix matching
// preserves that tenant-optional coverage for detail/nested routes.
const TENANT_OPTIONAL_PREFIX_PATHS = [
  '/auth/',
  '/activities/',
  '/trading-routes/',
  '/trading/',
  '/federations/',
  '/directory/',
  '/gdpr/',
  '/briefings/',
  '/recruitments/',
  '/bounty/',
  '/bounties/',
  '/notifications/',
  '/inbox/',
  '/messages/',
  '/organizations/',
  // RSI verification sub-routes (initiate/complete/status + organization/* by-rank/by-code).
  // Personal & org RSI verification authorize via req.user.id and a body orgId, not the
  // caller's active org, so they must not be gated by tenant context (org-less users and the
  // org-creation flow both need these).
  '/rsi/verify/',
  '/admin/', // Admin portal — platform-level, uses own auth (requireAdmin)
];

const TENANT_OPTIONAL_PATTERN_PATHS = [
  /^\/users\/[^/]+\/ships$/,
  /^\/users\/[^/]+\/loadouts$/,
  /^\/users\/[^/]+\/activity$/,
];

// Lazily instantiated to avoid creating a repository at module import time
// (which would couple this middleware's import to DataSource initialization).
let userPreferencesServiceInstance: UserPreferencesService | null = null;
function getUserPreferencesService(): UserPreferencesService {
  userPreferencesServiceInstance ??= new UserPreferencesService();
  return userPreferencesServiceInstance;
}

function normalizePathForMatch(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return '/';
  }

  const withoutQuery = trimmed.split('?')[0] || '/';
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

function stripApiPrefix(path: string): string {
  return path.replace(/^\/api(?:\/v\d+)?/, '') || '/';
}

function resolvePathCandidates(path: string, originalUrl: string): string[] {
  const candidates = new Set<string>();

  for (const rawPath of [path, originalUrl]) {
    if (typeof rawPath !== 'string' || rawPath.length === 0) {
      continue;
    }

    const normalized = normalizePathForMatch(rawPath);
    candidates.add(normalized);
    candidates.add(stripApiPrefix(normalized));
  }

  return Array.from(candidates);
}

function isTenantOptionalPath(path: string): boolean {
  if (TENANT_OPTIONAL_EXACT_PATHS.has(path)) {
    return true;
  }

  if (TENANT_OPTIONAL_PREFIX_PATHS.some(prefix => path.startsWith(prefix))) {
    return true;
  }

  return TENANT_OPTIONAL_PATTERN_PATHS.some(pattern => pattern.test(path));
}

function requiresOrganization(path: string, originalUrl: string): boolean {
  const candidates = resolvePathCandidates(path, originalUrl);
  return !candidates.some(candidate => isTenantOptionalPath(candidate));
}

async function handleStaleActiveOrganization(args: {
  req: TenantAuthRequest;
  res: Response;
  next: NextFunction;
  dbUser: User;
  userOrg: OrganizationMembership | null;
  overrideOrgId?: string;
  organizationId: string;
  pathRequiresOrg: boolean;
}): Promise<boolean> {
  const { req, res, next, dbUser, userOrg, overrideOrgId, organizationId, pathRequiresOrg } = args;

  if (userOrg || overrideOrgId) {
    return false;
  }

  logger.warn('Active organization membership missing; clearing stale active org', {
    userId: dbUser.id,
    staleOrganizationId: organizationId,
    path: req.path,
  });

  await getUserPreferencesService().clearStaleActiveOrganization(dbUser, {
    staleOrganizationId: organizationId,
    path: req.path,
  });
  membershipCache.delete(`${dbUser.id}:${organizationId}`);

  // Defensive: these fields are normally populated later in this middleware
  // (skipped on the stale-org path), so clear any value a prior middleware may
  // have set so no downstream handler in this request observes a stale org.
  if (req.user) {
    delete req.user.currentOrganizationId;
    delete req.user.currentOrganizationName;
  }

  if (pathRequiresOrg) {
    res.status(400).json({
      error: 'No active organization selected',
      message:
        'Your active organization is no longer available. Please select an organization to continue',
      requiresOrgSelection: true,
    });
    return true;
  }

  next();
  return true;
}

/**
 * Tenant context for the current request
 * Contains organization and user information
 */
export interface TenantContext {
  organizationId: string;
  userId: string;
  userRole: string;
  securityLevel?: number;
  organizationRole?: string;
}

// Extended AuthRequest interface to include tenant context
export interface TenantAuthRequest extends AuthRequest {
  tenantContext?: TenantContext;
}

/**
 * Extend Express Request with tenant context
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      crossTenantAccess?: {
        resourceOrgId: string;
        accessLevel: string;
        granted: boolean;
      };
    }
  }
}

/**
 * Middleware to set up tenant context for multi-tenant operations
 */
export const tenantContext = async (
  req: TenantAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if tenant context was already populated upstream (e.g. by
    // handleBotRequest in botOrUserAuth).  The synthetic bot user does not
    // exist in the users table, so looking it up would 401 with
    // "User not found".  This also avoids a redundant DB query when the
    // context is already fully resolved.
    if (req.tenantContext) {
      return next();
    }

    const userId = req.user?.id;

    // Skip if no authenticated user (for public routes)
    if (!userId) {
      return next();
    }

    // Allow explicit org override via header (for admin/support)
    // This requires admin privileges
    const overrideOrgId = req.headers['x-organization-id'] as string;

    const userRepo = AppDataSource.getRepository(User);
    const dbUser = await userRepo
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!dbUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const activeOrganizationId = dbUser.activeOrgId;

    // Check if user has an active organization
    // Use regex pattern matching to handle both exact paths and UUID patterns
    // Check both req.path (relative to sub-router) and req.originalUrl (full path)
    // to handle middleware applied inside nested routers
    const pathRequiresOrg = requiresOrganization(req.path, req.originalUrl);

    if (!activeOrganizationId && !overrideOrgId && pathRequiresOrg) {
      logger.debug(
        '[DEBUG] tenantContext blocking request - path:',
        req.path,
        'user:',
        userId,
        'activeOrgId:',
        activeOrganizationId
      );
      res.status(400).json({
        error: 'No active organization selected',
        message: 'Please select an organization to continue',
        requiresOrgSelection: true,
      });
      return;
    }

    // Determine organization ID
    // At this point, either user.activeOrgId or overrideOrgId must be set (validated above)
    let organizationId: string = activeOrganizationId || overrideOrgId || '';

    // Validate and apply override if provided
    if (overrideOrgId) {
      // Only allow admins to override
      if (dbUser.role !== 'admin') {
        res.status(403).json({
          error: 'Insufficient permissions to override organization context',
        });
        return;
      }

      logger.warn('Admin organization override', {
        adminId: dbUser.id,
        originalOrg: activeOrganizationId,
        overrideOrg: overrideOrgId,
      });

      organizationId = overrideOrgId;
    }

    // Get user's role and security level in the organization
    const userOrg = await getCachedMembership(dbUser.id, organizationId);

    if (
      await handleStaleActiveOrganization({
        req,
        res,
        next,
        dbUser,
        userOrg,
        overrideOrgId,
        organizationId,
        pathRequiresOrg,
      })
    ) {
      return;
    }

    // Set tenant context
    req.tenantContext = {
      organizationId,
      userId: dbUser.id,
      userRole: dbUser.role,
      securityLevel: userOrg?.securityLevel,
      organizationRole: getRoleName(userOrg?.role),
    };

    // Populate req.user.currentOrganizationId so controllers that read it get the value.
    // Many controllers use req.user?.currentOrganizationId instead of req.tenantContext.
    if (req.user && organizationId) {
      req.user.currentOrganizationId = organizationId;

      // Populate org name from already-loaded relation to avoid extra DB query
      if (userOrg?.organization?.name) {
        req.user.currentOrganizationName = userOrg.organization.name;
      }
    }

    logger.debug('Tenant context established', {
      organizationId,
      userId: dbUser.id,
      userRole: dbUser.role,
      orgRole: getRoleName(userOrg?.role),
      securityLevel: userOrg?.securityLevel,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Error in tenant context middleware', { error });
    next(error);
  }
};

/**
 * Middleware to require tenant context
 * Use this on routes that must have a tenant context
 *
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export const requireTenantContext = (
  req: TenantAuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.tenantContext) {
    res.status(401).json({
      error: 'Tenant context required',
      message: 'Authentication and organization selection required',
    });
    return;
  }
  next();
};

/**
 * Middleware to require specific organization role
 *
 * @param requiredRoles - Array of allowed roles ('owner', 'admin', 'member')
 * @returns Middleware function
 */
export const requireOrganizationRole =
  (allowedRoles: string[]) =>
  (req: TenantAuthRequest, res: Response, next: NextFunction): void => {
    if (!req.tenantContext) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.tenantContext.organizationRole;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        required: allowedRoles,
        current: userRole,
      });
      return;
    }

    next();
  };

/**
 * Middleware to require minimum security level
 *
 * @param minimumLevel - Minimum security level (1-5)
 * @returns Middleware function
 */
export const requireSecurityLevel =
  (minLevel: number) =>
  async (req: TenantAuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenantContext) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userLevel = req.tenantContext.securityLevel || 1;
    if (userLevel < minLevel) {
      logger.warn('Security level check failed', {
        userId: req.tenantContext.userId,
        requiredLevel: minLevel,
        userLevel,
        path: req.path,
      });

      res.status(403).json({
        error: 'Insufficient security clearance',
        message: `This action requires security level ${minLevel} or higher`,
        required: minLevel,
        current: userLevel,
      });
      return;
    }

    next();
  };

/**
 * Get tenant context from request (helper function)
 *
 * @param req - Express request
 * @returns Tenant context or null
 */
export const getTenantContext = (req: TenantAuthRequest): TenantContext | null =>
  req.tenantContext || null;

/**
 * Get organization ID from request (helper function)
 *
 * @param req - Express request
 * @returns Organization ID or null
 */
export const getOrganizationId = (req: TenantAuthRequest): string | null =>
  req.tenantContext?.organizationId || null;

// Backwards compatibility alias
export const tenantContextMiddleware = tenantContext;
