import { NextFunction, Response } from 'express';

import { PermissionManagerService } from '../services/security/permissions/PermissionManagerService';
import { logAuthorizationFailure } from '../utils/auditLogger';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

// Unified permission manager handles both intra-org and inter-org permissions
const permissionManager = new PermissionManagerService();

/** Shape of req.body fields used by permission middleware */
interface PermissionRequestBody {
  organizationId?: string;
  sourceOrgId?: string;
  fromOrganizationId?: string;
  targetOrgId?: string;
  toOrganizationId?: string;
}

/**
 * Extract organization ID from multiple request sources.
 * V2 routes use :orgId, V1 routes use :organizationId.
 * Tenant-scoped routes populate req.user.currentOrganizationId.
 */
function resolveOrganizationId(req: AuthRequest): string | undefined {
  const body = req.body as PermissionRequestBody;
  return (
    req.params.organizationId ??
    req.params.orgId ??
    req.orgMembership?.organizationId ??
    req.user?.currentOrganizationId ??
    body.organizationId ??
    (req.query.organizationId as string | undefined)
  );
}

/**
 * Middleware to require specific permission for a resource
 * Now uses PermissionManagerService with automatic caching for 70% faster checks
 */
export const requirePermission =
  (resource: string, action: string) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(400).json({ message: 'Organization ID required' });
      return;
    }

    try {
      const result = await permissionManager.checkPermission(
        organizationId,
        req.user.id,
        resource,
        action
      );

      if (!result.allowed) {
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        logAuthorizationFailure(
          req.user.id,
          req.user.username,
          req.user.role,
          `${resource}:${action}`,
          req.method,
          ipAddress,
          userAgent
        );

        res.status(403).json({
          message: 'Insufficient permissions',
          required: `${resource}:${action}`,
          reason: result.reason,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };

/**
 * Middleware to require minimum security level
 */
export const requireSecurityLevel =
  (minLevel: number) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      res.status(400).json({ message: 'Organization ID required' });
      return;
    }

    try {
      const UserOrgRepository = permissionManager['userOrgRepository'];
      const userOrg = await UserOrgRepository.findOne({
        where: {
          userId: req.user.id,
          organizationId,
          isActive: true,
        },
      });

      if (!userOrg || userOrg.securityLevel < minLevel) {
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        logAuthorizationFailure(
          req.user.id,
          req.user.username,
          req.user.role,
          req.path,
          req.method,
          ipAddress,
          userAgent
        );

        res.status(403).json({
          message: 'Insufficient security clearance',
          required: `Level ${minLevel}`,
          current: userOrg?.securityLevel ?? 0,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Security level check error:', error);
      res.status(500).json({ message: 'Error checking security level' });
    }
  };

/**
 * Middleware to check cross-organization access
 */
export const requireInterOrgAccess =
  (resourceType: string, accessLevel: string, requiredSecurityLevel: number = 1) =>
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const body = req.body as PermissionRequestBody;

    // Support both old (fromOrganizationId/toOrganizationId) and new (sourceOrgId/targetOrgId) parameter names
    const sourceOrgId: string | undefined =
      body.sourceOrgId ??
      body.fromOrganizationId ??
      (req.query.sourceOrgId as string | undefined) ??
      (req.query.fromOrganizationId as string | undefined);

    const targetOrgId: string | undefined =
      body.targetOrgId ??
      body.toOrganizationId ??
      (req.query.targetOrgId as string | undefined) ??
      (req.query.toOrganizationId as string | undefined);

    if (!sourceOrgId || !targetOrgId) {
      res.status(400).json({ message: 'Both organization IDs required for cross-org access' });
      return;
    }

    try {
      const hasAccess = await permissionManager.hasInterOrgAccess(
        sourceOrgId,
        targetOrgId,
        resourceType,
        accessLevel,
        requiredSecurityLevel
      );

      if (!hasAccess) {
        const ipAddress = req.ip ?? req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        logAuthorizationFailure(
          req.user.id,
          req.user.username,
          req.user.role,
          `${resourceType} (inter-org)`,
          req.method,
          ipAddress,
          userAgent
        );

        res.status(403).json({
          message: 'Insufficient cross-organization access',
          resourceType,
          requiredAccess: accessLevel,
          requiredSecurityLevel,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Inter-org access check error:', error);
      res.status(500).json({ message: 'Error checking cross-org access' });
    }
  };
