"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireInterOrgAccess = exports.requireSecurityLevel = exports.requirePermission = void 0;
const PermissionManagerService_1 = require("../services/security/permissions/PermissionManagerService");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const permissionManager = new PermissionManagerService_1.PermissionManagerService();
function resolveOrganizationId(req) {
    const body = req.body;
    return (req.params.organizationId ??
        req.params.orgId ??
        req.orgMembership?.organizationId ??
        req.user?.currentOrganizationId ??
        body.organizationId ??
        req.query.organizationId);
}
const requirePermission = (resource, action) => async (req, res, next) => {
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
        const result = await permissionManager.checkPermission(organizationId, req.user.id, resource, action);
        if (!result.allowed) {
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `${resource}:${action}`, req.method, ipAddress, userAgent);
            res.status(403).json({
                message: 'Insufficient permissions',
                required: `${resource}:${action}`,
                reason: result.reason,
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Permission check error:', error);
        res.status(500).json({ message: 'Error checking permissions' });
    }
};
exports.requirePermission = requirePermission;
const requireSecurityLevel = (minLevel) => async (req, res, next) => {
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
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, req.path, req.method, ipAddress, userAgent);
            res.status(403).json({
                message: 'Insufficient security clearance',
                required: `Level ${minLevel}`,
                current: userOrg?.securityLevel ?? 0,
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Security level check error:', error);
        res.status(500).json({ message: 'Error checking security level' });
    }
};
exports.requireSecurityLevel = requireSecurityLevel;
const requireInterOrgAccess = (resourceType, accessLevel, requiredSecurityLevel = 1) => async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    const body = req.body;
    const sourceOrgId = body.sourceOrgId ??
        body.fromOrganizationId ??
        req.query.sourceOrgId ??
        req.query.fromOrganizationId;
    const targetOrgId = body.targetOrgId ??
        body.toOrganizationId ??
        req.query.targetOrgId ??
        req.query.toOrganizationId;
    if (!sourceOrgId || !targetOrgId) {
        res.status(400).json({ message: 'Both organization IDs required for cross-org access' });
        return;
    }
    try {
        const hasAccess = await permissionManager.hasInterOrgAccess(sourceOrgId, targetOrgId, resourceType, accessLevel, requiredSecurityLevel);
        if (!hasAccess) {
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `${resourceType} (inter-org)`, req.method, ipAddress, userAgent);
            res.status(403).json({
                message: 'Insufficient cross-organization access',
                resourceType,
                requiredAccess: accessLevel,
                requiredSecurityLevel,
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Inter-org access check error:', error);
        res.status(500).json({ message: 'Error checking cross-org access' });
    }
};
exports.requireInterOrgAccess = requireInterOrgAccess;
//# sourceMappingURL=permissionMiddleware.js.map