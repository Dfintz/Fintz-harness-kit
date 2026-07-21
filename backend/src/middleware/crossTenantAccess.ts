import { NextFunction, Request, Response } from 'express';

import { AppDataSource } from '../config/database';
import { Activity } from '../models/Activity';
import { Permission } from '../models/Permission';
import { SecurityLevel } from '../models/SecurityLevel';
import { ShipLoadout } from '../models/ShipLoadout';
import { logger } from '../utils/logger';

/**
 * Options for cross-tenant access validation
 */
export interface CrossTenantAccessOptions {
    /** Resource type (e.g., 'activity', 'ship-loadout') */
    resourceType: string;
    
    /** Action being performed ('read' | 'write' | 'delete') */
    action: 'read' | 'write' | 'delete';
    
    /** Function to get the organization ID that owns the resource */
    getResourceOrgId: (req: Request) => Promise<string | null>;
    
    /** Whether the resource must be explicitly shared (via sharedWithOrgs field) */
    requireSharing?: boolean;
    
    /** Allow same-org access without additional checks (default: true) */
    allowSameOrg?: boolean;
}

/**
 * Middleware to validate cross-tenant (cross-organization) access
 * 
 * This middleware enforces multi-tenancy boundaries and controlled sharing:
 * 1. Checks if resource belongs to requesting org (same-org access)
 * 2. For cross-org access:
 *    - Validates inter-org security level exists
 *    - Checks security level grants required access
 *    - Verifies user has permission in their own org
 *    - Optionally checks if resource is explicitly shared
 * 3. Logs all cross-tenant access attempts
 * 
 * @param options - Cross-tenant access options
 * @returns Express middleware function
 */
export const validateCrossTenantAccess = (options: CrossTenantAccessOptions) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { tenantContext } = req;
            
            // Require authentication and tenant context
            if (!tenantContext) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            // Get the organization that owns the resource
            const resourceOrgId = await options.getResourceOrgId(req);
            
            if (!resourceOrgId) {
                res.status(404).json({ error: 'Resource not found' });
                return;
            }

            // Same org access - allow by default (will be checked by regular permissions)
            if (options.allowSameOrg !== false && resourceOrgId === tenantContext.organizationId) {
                return next();
            }

            // Different org - check cross-tenant permissions
            logger.info('Cross-tenant access attempt', {
                requestingOrg: tenantContext.organizationId,
                requestingUser: tenantContext.userId,
                resourceOrg: resourceOrgId,
                resourceType: options.resourceType,
                action: options.action,
                path: req.path,
                method: req.method
            });

            // Step 1: Check inter-org security level
            const securityLevelRepo = AppDataSource.getRepository(SecurityLevel);
            const securityLevel = await securityLevelRepo.findOne({
                where: {
                    sourceOrgId: tenantContext.organizationId,
                    targetOrgId: resourceOrgId,
                    resourceType: options.resourceType
                }
            });

            if (!securityLevel || securityLevel.accessLevel === 'none') {
                logger.warn('Cross-tenant access denied: No security relationship', {
                    requestingOrg: tenantContext.organizationId,
                    resourceOrg: resourceOrgId,
                    resourceType: options.resourceType
                });

                res.status(403).json({ 
                    error: 'Cross-organization access denied',
                    message: 'No security relationship exists between organizations',
                    code: 'NO_SECURITY_LEVEL'
                });
                return;
            }

            // Step 2: Check if action is permitted by access level
            const allowedActions: Record<string, string[]> = {
                'read': ['read'],
                'write': ['read', 'write'],
                'full': ['read', 'write', 'delete']
            };

            const permitted = allowedActions[securityLevel.accessLevel]?.includes(options.action);
            
            if (!permitted) {
                logger.warn('Cross-tenant access denied: Insufficient access level', {
                    requestingOrg: tenantContext.organizationId,
                    resourceOrg: resourceOrgId,
                    resourceType: options.resourceType,
                    action: options.action,
                    accessLevel: securityLevel.accessLevel
                });

                res.status(403).json({ 
                    error: 'Cross-organization access denied',
                    message: `Action '${options.action}' not permitted. Access level: ${securityLevel.accessLevel}`,
                    code: 'INSUFFICIENT_ACCESS_LEVEL',
                    currentLevel: securityLevel.accessLevel,
                    requiredAction: options.action
                });
                return;
            }

            // Step 3: Check user permissions in their own organization
            const permissionRepo = AppDataSource.getRepository(Permission);
            const userPermission = await permissionRepo.findOne({
                where: {
                    userId: tenantContext.userId,
                    organizationId: tenantContext.organizationId,
                    resource: options.resourceType,
                    action: options.action,
                    granted: true
                }
            });

            if (!userPermission) {
                logger.warn('Cross-tenant access denied: User lacks permission in own org', {
                    requestingOrg: tenantContext.organizationId,
                    requestingUser: tenantContext.userId,
                    resourceType: options.resourceType,
                    action: options.action
                });

                res.status(403).json({ 
                    error: 'Insufficient permissions',
                    message: `You do not have '${options.action}' permission for '${options.resourceType}' in your organization`,
                    code: 'USER_PERMISSION_DENIED'
                });
                return;
            }

            // Step 4: Check if resource is explicitly shared (if required)
            if (options.requireSharing) {
                const isShared = await checkResourceSharing(
                    options.resourceType,
                    req.params.id || req.params.resourceId,
                    tenantContext.organizationId
                );

                if (!isShared) {
                    logger.warn('Cross-tenant access denied: Resource not shared', {
                        requestingOrg: tenantContext.organizationId,
                        resourceOrg: resourceOrgId,
                        resourceType: options.resourceType,
                        resourceId: req.params.id || req.params.resourceId
                    });

                    res.status(403).json({ 
                        error: 'Access denied',
                        message: 'Resource is not shared with your organization',
                        code: 'NOT_SHARED'
                    });
                    return;
                }
            }

            // All checks passed - grant access and log
            logger.info('Cross-tenant access granted', {
                requestingOrg: tenantContext.organizationId,
                requestingUser: tenantContext.userId,
                resourceOrg: resourceOrgId,
                resourceType: options.resourceType,
                action: options.action,
                accessLevel: securityLevel.accessLevel
            });

            // Attach cross-tenant access info for audit logging
            req.crossTenantAccess = {
                resourceOrgId,
                accessLevel: securityLevel.accessLevel,
                granted: true
            };

            next();
        } catch (error) {
            logger.error('Error in cross-tenant access middleware', { error });
            next(error);
        }
    };

/**
 * Check if a resource is shared with a specific organization
 * 
 * @param resourceType - Type of resource
 * @param resourceId - ID of the resource
 * @param requestingOrgId - Organization requesting access
 * @returns true if shared, false otherwise
 */
async function checkResourceSharing(
    resourceType: string,
    resourceId: string,
    requestingOrgId: string
): Promise<boolean> {
    try {
        // Map resource types to repositories
        const repositories: Record<string, unknown> = {
            'activity': AppDataSource.getRepository(Activity),
            'ship-loadout': AppDataSource.getRepository(ShipLoadout),
            // Add more resource types as they are implemented
        };

        const repo = repositories[resourceType] as { findOne: (options: unknown) => Promise<{ id: string; sharedWithOrgs?: string[]; organizationId: string } | null> } | undefined;
        if (!repo) {
            logger.warn('Unknown resource type for sharing check', { resourceType });
            return false;
        }

        const resource = await repo.findOne({ 
            where: { id: resourceId },
            select: ['id', 'sharedWithOrgs', 'organizationId']
        });

        if (!resource) {
            return false;
        }

        // Check if sharedWithOrgs includes the requesting org
        return resource.sharedWithOrgs?.includes(requestingOrgId) || false;
    } catch (error) {
        logger.error('Error checking resource sharing', { error, resourceType, resourceId });
        return false;
    }
}

/**
 * Helper to get resource organization ID from Activity
 * Use this with validateCrossTenantAccess for Activity resources
 */
export const getActivityOrgId = async (req: Request): Promise<string | null> => {
    const activityId = req.params.id || req.params.activityId;
    if (!activityId) {return null;}

    const activity = await AppDataSource.getRepository(Activity).findOne({
        where: { id: activityId },
        select: ['organizationId']
    });

    return activity?.organizationId || null;
};

/**
 * Helper to get resource organization ID from ShipLoadout
 * Use this with validateCrossTenantAccess for ShipLoadout resources
 */
export const getShipLoadoutOrgId = async (req: Request): Promise<string | null> => {
    const loadoutId = req.params.id || req.params.loadoutId;
    if (!loadoutId) {return null;}

    const loadout = await AppDataSource.getRepository(ShipLoadout).findOne({
        where: { id: loadoutId },
        select: ['ownerId'] // ShipLoadout uses ownerId, not organizationId
    });

    return loadout?.ownerId || null; // Return owner ID as organization context
};

/**
 * Middleware to log cross-tenant access in audit trail
 * Use this after validateCrossTenantAccess to log successful access
 */
export const auditCrossTenantAccess = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // This will be called after the route handler
    // Log the access if it was cross-tenant
    const originalJson = res.json.bind(res);

    res.json = function(data: unknown) {
        if (req.crossTenantAccess && req.tenantContext) {
            logger.info('Cross-tenant access completed', {
                requestingOrg: req.tenantContext.organizationId,
                requestingUser: req.tenantContext.userId,
                resourceOrg: req.crossTenantAccess.resourceOrgId,
                accessLevel: req.crossTenantAccess.accessLevel,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                success: res.statusCode < 400
            });
        }
        return originalJson(data);
    };

    next();
};
