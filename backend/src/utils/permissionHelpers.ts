/**
 * Permission Middleware and Helpers
 *
 * Utilities for permission checking that automatically throw enriched
 * ForbiddenError exceptions with detailed permission context.
 *
 * Part of R-5: Permission Error Enrichment Sprint
 */

import { ForbiddenError } from './apiErrors';
import { logPermissionDenial } from './auditLogger';

/**
 * Optional context for audit logging permission denials
 *
 * Provides request-level information for audit trails
 */
export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
  username?: string;
}

/**
 * Generic permission service interface
 * Compatible with PermissionManagerService and OrganizationPermissionService
 */
export interface IPermissionService {
  checkPermission(
    userId: string,
    orgId: string,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    missingPermission?: {
      resource: string;
      action: string;
      scope?: string;
      resourceId?: string;
    };
  }>;
}

/**
 * Options for requirePermission function
 */
export interface RequirePermissionOptions {
  /** Optional custom error message */
  customMessage?: string;
  /** Optional specific resource ID */
  resourceId?: string;
  /** Optional audit context for logging */
  auditContext?: AuditContext;
}

/**
 * Check if user has required permission and throw enriched error if not
 *
 * @example
 * ```typescript
 * await requirePermission(
 *   permissionManager,
 *   orgId,
 *   userId,
 *   'fleet',
 *   'edit',
 *   {
 *     resourceId: 'fleet-123',
 *     customMessage: 'You need permission to edit fleets',
 *     auditContext: { ipAddress: req.ip, userAgent: req.headers['user-agent'], username: user.email }
 *   }
 * );
 * ```
 *
 * @param permissionService - Permission service instance
 * @param orgId - Organization ID
 * @param userId - User ID to check
 * @param resource - Resource name (e.g., 'fleet', 'activity')
 * @param action - Action name (e.g., 'view', 'edit', 'delete')
 * @param options - Optional configuration object
 * @throws {ForbiddenError} Enriched error with permission context
 */
export async function requirePermission(
  permissionService: IPermissionService,
  orgId: string,
  userId: string,
  resource: string,
  action: string,
  options?: RequirePermissionOptions
): Promise<void> {
  const { resourceId, customMessage, auditContext } = options ?? {};

  // OrganizationPermissionService signature: (userId, orgId, resource, action, resourceId)
  const result = await permissionService.checkPermission(
    userId,
    orgId,
    resource,
    action,
    resourceId
  );

  if (!result.allowed) {
    // Log permission denial to audit trail
    logPermissionDenial(userId, {
      username: auditContext?.username,
      resource,
      action,
      reason: result.reason,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      resourceId,
      scope: orgId,
    });

    // Build user-friendly error message
    const permissionKey = `${resource}:${action}`;
    const message =
      customMessage ||
      `You need the '${permissionKey}' permission to perform this action. ${
        result.reason || 'Contact your organization administrator for access.'
      }`;

    throw new ForbiddenError(message, result.missingPermission);
  }
}

/**
 * Check if user has ANY of the required permissions
 *
 * @example
 * ```typescript
 * await requireAnyPermission(
 *   permissionService,
 *   orgId,
 *   userId,
 *   [
 *     { resource: 'fleet', action: 'edit' },
 *     { resource: 'fleet', action: 'manage' }
 *   ],
 *   'You need fleet editing or management permissions',
 *   { ipAddress: req.ip, userAgent: req.headers['user-agent'], username: user.email }
 * );
 * ```
 */
export async function requireAnyPermission(
  permissionService: IPermissionService,
  orgId: string,
  userId: string,
  permissions: Array<{ resource: string; action: string; resourceId?: string }>,
  options?: RequirePermissionOptions
): Promise<void> {
  const { customMessage, auditContext } = options ?? {};

  const results = await Promise.all(
    permissions.map(perm =>
      permissionService.checkPermission(userId, orgId, perm.resource, perm.action, perm.resourceId)
    )
  );

  // If any permission is granted, allow access
  if (results.some(r => r.allowed)) {
    return;
  }

  // Log permission denial (first missing permission for audit)
  if (results.length > 0 && results[0]?.missingPermission) {
    logPermissionDenial(userId, {
      username: auditContext?.username,
      resource: results[0].missingPermission.resource,
      action: results[0].missingPermission.action,
      reason: results[0].reason,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      resourceId: results[0].missingPermission.resourceId,
      scope: orgId,
    });
  }

  // Build error message listing all required permissions
  const permissionKeys = permissions.map(p => `${p.resource}:${p.action}`).join(' OR ');
  const message =
    customMessage ||
    `You need one of the following permissions: ${permissionKeys}. Contact your organization administrator.`;

  // Use the first missing permission for context
  throw new ForbiddenError(message, results[0]?.missingPermission);
}

/**
 * Check if user has ALL of the required permissions
 *
 * @example
 * ```typescript
 * await requireAllPermissions(
 *   permissionService,
 *   orgId,
 *   userId,
 *   [
 *     { resource: 'fleet', action: 'view' },
 *     { resource: 'ship', action: 'edit' }
 *   ],
 *   undefined,
 *   { ipAddress: req.ip, userAgent: req.headers['user-agent'], username: user.email }
 * );
 * ```
 */
export async function requireAllPermissions(
  permissionService: IPermissionService,
  orgId: string,
  userId: string,
  permissions: Array<{ resource: string; action: string; resourceId?: string }>,
  options?: RequirePermissionOptions
): Promise<void> {
  const { customMessage, auditContext } = options ?? {};

  const results = await Promise.all(
    permissions.map(perm =>
      permissionService.checkPermission(userId, orgId, perm.resource, perm.action, perm.resourceId)
    )
  );

  // Find first denied permission
  const deniedIndex = results.findIndex(r => !r.allowed);
  if (deniedIndex === -1) {
    return; // All permissions granted
  }

  // Log permission denial
  const deniedPermission = permissions[deniedIndex];
  logPermissionDenial(userId, {
    username: auditContext?.username,
    resource: deniedPermission.resource,
    action: deniedPermission.action,
    reason: results[deniedIndex].reason,
    ipAddress: auditContext?.ipAddress,
    userAgent: auditContext?.userAgent,
    resourceId: deniedPermission.resourceId,
    scope: orgId,
  });

  // Build error message
  const permissionKey = `${deniedPermission.resource}:${deniedPermission.action}`;
  const message =
    customMessage ||
    `You need the '${permissionKey}' permission to perform this action. ${
      results[deniedIndex].reason || 'Contact your organization administrator.'
    }`;

  throw new ForbiddenError(message, results[deniedIndex].missingPermission);
}

/**
 * Create a user-friendly permission error message
 *
 * Converts technical permission keys to human-readable descriptions
 */
export function formatPermissionError(resource: string, action: string): string {
  const actionLabels: Record<string, string> = {
    view: 'view',
    create: 'create',
    edit: 'edit',
    delete: 'delete',
    manage: 'manage',
    approve: 'approve',
    assign: 'assign',
  };

  const resourceLabels: Record<string, string> = {
    fleet: 'fleets',
    ship: 'ships',
    activity: 'activities',
    member: 'members',
    role: 'roles',
    permission: 'permissions',
    invitation: 'invitations',
    application: 'applications',
    intel: 'intelligence',
    logistics: 'logistics',
    operation: 'operations',
  };

  const actionLabel = actionLabels[action] || action;
  const resourceLabel = resourceLabels[resource] || resource;

  return `${actionLabel} ${resourceLabel}`;
}

/**
 * Team-scoped permission service interface.
 * Compatible with PermissionManagerService.checkTeamPermission().
 */
export interface ITeamPermissionService {
  checkTeamPermission(
    orgId: string,
    userId: string,
    teamId: string,
    resource: string,
    action: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    missingPermission?: {
      resource: string;
      action: string;
      scope?: string;
      resourceId?: string;
    };
  }>;
}

/**
 * Check if user has required team-scoped permission and throw enriched error if not.
 *
 * Verifies team membership AND permission in one call.
 *
 * @param permissionService - Service implementing checkTeamPermission
 * @param orgId - Organization ID
 * @param userId - User ID to check
 * @param teamId - Team ID for scoping
 * @param resource - Resource name
 * @param action - Action name
 * @param options - Optional configuration
 * @throws {ForbiddenError} Enriched error with permission context
 */
export async function requireTeamPermission(
  permissionService: ITeamPermissionService,
  orgId: string,
  userId: string,
  teamId: string,
  resource: string,
  action: string,
  options?: RequirePermissionOptions
): Promise<void> {
  const { customMessage, auditContext } = options ?? {};

  const result = await permissionService.checkTeamPermission(
    orgId,
    userId,
    teamId,
    resource,
    action
  );

  if (!result.allowed) {
    logPermissionDenial(userId, {
      username: auditContext?.username,
      resource,
      action,
      reason: result.reason,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
      resourceId: teamId,
      scope: orgId,
    });

    const permissionKey = `${resource}:${action}`;
    const message =
      customMessage ??
      `You need the '${permissionKey}' permission within this team. ${
        result.reason ?? 'Contact your team leader or organization administrator.'
      }`;

    throw new ForbiddenError(message, result.missingPermission);
  }
}
