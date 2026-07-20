"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditCrossTenantAccess = exports.getShipLoadoutOrgId = exports.getActivityOrgId = exports.validateCrossTenantAccess = void 0;
const database_1 = require("../config/database");
const Activity_1 = require("../models/Activity");
const Permission_1 = require("../models/Permission");
const SecurityLevel_1 = require("../models/SecurityLevel");
const ShipLoadout_1 = require("../models/ShipLoadout");
const logger_1 = require("../utils/logger");
const validateCrossTenantAccess = (options) => async (req, res, next) => {
    try {
        const { tenantContext } = req;
        if (!tenantContext) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const resourceOrgId = await options.getResourceOrgId(req);
        if (!resourceOrgId) {
            res.status(404).json({ error: 'Resource not found' });
            return;
        }
        if (options.allowSameOrg !== false && resourceOrgId === tenantContext.organizationId) {
            return next();
        }
        logger_1.logger.info('Cross-tenant access attempt', {
            requestingOrg: tenantContext.organizationId,
            requestingUser: tenantContext.userId,
            resourceOrg: resourceOrgId,
            resourceType: options.resourceType,
            action: options.action,
            path: req.path,
            method: req.method
        });
        const securityLevelRepo = database_1.AppDataSource.getRepository(SecurityLevel_1.SecurityLevel);
        const securityLevel = await securityLevelRepo.findOne({
            where: {
                sourceOrgId: tenantContext.organizationId,
                targetOrgId: resourceOrgId,
                resourceType: options.resourceType
            }
        });
        if (!securityLevel || securityLevel.accessLevel === 'none') {
            logger_1.logger.warn('Cross-tenant access denied: No security relationship', {
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
        const allowedActions = {
            'read': ['read'],
            'write': ['read', 'write'],
            'full': ['read', 'write', 'delete']
        };
        const permitted = allowedActions[securityLevel.accessLevel]?.includes(options.action);
        if (!permitted) {
            logger_1.logger.warn('Cross-tenant access denied: Insufficient access level', {
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
        const permissionRepo = database_1.AppDataSource.getRepository(Permission_1.Permission);
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
            logger_1.logger.warn('Cross-tenant access denied: User lacks permission in own org', {
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
        if (options.requireSharing) {
            const isShared = await checkResourceSharing(options.resourceType, req.params.id || req.params.resourceId, tenantContext.organizationId);
            if (!isShared) {
                logger_1.logger.warn('Cross-tenant access denied: Resource not shared', {
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
        logger_1.logger.info('Cross-tenant access granted', {
            requestingOrg: tenantContext.organizationId,
            requestingUser: tenantContext.userId,
            resourceOrg: resourceOrgId,
            resourceType: options.resourceType,
            action: options.action,
            accessLevel: securityLevel.accessLevel
        });
        req.crossTenantAccess = {
            resourceOrgId,
            accessLevel: securityLevel.accessLevel,
            granted: true
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in cross-tenant access middleware', { error });
        next(error);
    }
};
exports.validateCrossTenantAccess = validateCrossTenantAccess;
async function checkResourceSharing(resourceType, resourceId, requestingOrgId) {
    try {
        const repositories = {
            'activity': database_1.AppDataSource.getRepository(Activity_1.Activity),
            'ship-loadout': database_1.AppDataSource.getRepository(ShipLoadout_1.ShipLoadout),
        };
        const repo = repositories[resourceType];
        if (!repo) {
            logger_1.logger.warn('Unknown resource type for sharing check', { resourceType });
            return false;
        }
        const resource = await repo.findOne({
            where: { id: resourceId },
            select: ['id', 'sharedWithOrgs', 'organizationId']
        });
        if (!resource) {
            return false;
        }
        return resource.sharedWithOrgs?.includes(requestingOrgId) || false;
    }
    catch (error) {
        logger_1.logger.error('Error checking resource sharing', { error, resourceType, resourceId });
        return false;
    }
}
const getActivityOrgId = async (req) => {
    const activityId = req.params.id || req.params.activityId;
    if (!activityId) {
        return null;
    }
    const activity = await database_1.AppDataSource.getRepository(Activity_1.Activity).findOne({
        where: { id: activityId },
        select: ['organizationId']
    });
    return activity?.organizationId || null;
};
exports.getActivityOrgId = getActivityOrgId;
const getShipLoadoutOrgId = async (req) => {
    const loadoutId = req.params.id || req.params.loadoutId;
    if (!loadoutId) {
        return null;
    }
    const loadout = await database_1.AppDataSource.getRepository(ShipLoadout_1.ShipLoadout).findOne({
        where: { id: loadoutId },
        select: ['ownerId']
    });
    return loadout?.ownerId || null;
};
exports.getShipLoadoutOrgId = getShipLoadoutOrgId;
const auditCrossTenantAccess = async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
        if (req.crossTenantAccess && req.tenantContext) {
            logger_1.logger.info('Cross-tenant access completed', {
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
exports.auditCrossTenantAccess = auditCrossTenantAccess;
//# sourceMappingURL=crossTenantAccess.js.map