import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { logAuthorizationFailure } from '../utils/auditLogger';
import { logger } from '../utils/logger';
import { getRoleName } from '../utils/roleUtils';

import { AuthRequest } from './auth';

/**
 * Organization membership context attached to the request
 * after validation by requireOrgMembership middleware
 */
export interface OrgMembershipContext {
  organizationId: string;
  role?: string;
  securityLevel?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      orgMembership?: OrgMembershipContext;
    }
  }
}

// UUID pattern for org IDs in URL paths
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ORG_PATH_REGEX = new RegExp(`/organizations/(${UUID_PATTERN})`, 'i');

/**
 * Extract organization ID from the request.
 *
 * Resolution order:
 * 1. req.params.orgId / req.params.organizationId (available when used on individual routes)
 * 2. URL path matching /organizations/:uuid (works at global router level where params aren't populated)
 */
function extractOrgId(req: AuthRequest): string | undefined {
  // Route-level params (available when middleware is applied directly to a route)
  if (req.params.orgId) {
    return req.params.orgId;
  }
  if (req.params.organizationId) {
    return req.params.organizationId;
  }

  // Global-level URL parsing (works when applied via v2Router.use())
  const match = req.path.match(ORG_PATH_REGEX);
  if (match) {
    return match[1];
  }

  return undefined;
}

/**
 * Middleware to validate the authenticated user is a member of the
 * organization specified in the URL params.
 *
 * - If no org param is found in the URL, passes through (route doesn't need org validation)
 * - Admin users bypass the check (consistent with existing authorization patterns)
 * - First checks req.user.organizationIds (fast, in-memory from JWT)
 * - Falls back to DB lookup on OrganizationMembership table
 * - Attaches req.orgMembership for downstream middleware/controllers
 * - Returns 403 and logs if user is not a member
 */
export const requireOrgMembership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const orgId = extractOrgId(req);

  // No org param in URL - route doesn't need org validation
  if (!orgId) {
    return next();
  }

  // No authenticated user – route-level `authenticate` middleware is responsible
  // for enforcing authentication.  We only gate on membership when the user is known.
  if (!req.user) {
    return next();
  }

  // Admin users bypass org membership checks
  if (req.user.role === 'admin') {
    req.orgMembership = { organizationId: orgId };
    return next();
  }

  // Fast path: check JWT organizationIds array
  if (req.user.organizationIds?.includes(orgId)) {
    req.orgMembership = { organizationId: orgId };
    return next();
  }

  // Slow path: DB lookup for membership details (role, securityLevel)
  try {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const membership = await membershipRepo.findOne({
      where: {
        userId: req.user.id,
        organizationId: orgId,
        isActive: true,
      },
      relations: ['role'],
    });

    if (!membership) {
      const ipAddress = req.ip ?? req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      logAuthorizationFailure(
        req.user.id,
        req.user.username,
        req.user.role,
        `organization:${orgId}`,
        req.method,
        ipAddress,
        userAgent
      );

      logger.warn('Org membership check failed', {
        userId: req.user.id,
        orgId,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        message: 'You are not a member of this organization',
        code: 'ORG_MEMBERSHIP_REQUIRED',
      });
      return;
    }

    req.orgMembership = {
      organizationId: orgId,
      role: getRoleName(membership.role),
      securityLevel: membership.securityLevel,
    };

    next();
  } catch (error) {
    logger.error('Error checking org membership', { error, orgId, userId: req.user.id });
    res.status(500).json({ message: 'Error validating organization membership' });
  }
};
