"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.requireAllPermissions = requireAllPermissions;
exports.formatPermissionError = formatPermissionError;
exports.requireTeamPermission = requireTeamPermission;
const apiErrors_1 = require("./apiErrors");
const auditLogger_1 = require("./auditLogger");
async function requirePermission(permissionService, orgId, userId, resource, action, options) {
    const { resourceId, customMessage, auditContext } = options ?? {};
    const result = await permissionService.checkPermission(userId, orgId, resource, action, resourceId);
    if (!result.allowed) {
        (0, auditLogger_1.logPermissionDenial)(userId, {
            username: auditContext?.username,
            resource,
            action,
            reason: result.reason,
            ipAddress: auditContext?.ipAddress,
            userAgent: auditContext?.userAgent,
            resourceId,
            scope: orgId,
        });
        const permissionKey = `${resource}:${action}`;
        const message = customMessage ||
            `You need the '${permissionKey}' permission to perform this action. ${result.reason || 'Contact your organization administrator for access.'}`;
        throw new apiErrors_1.ForbiddenError(message, result.missingPermission);
    }
}
async function requireAnyPermission(permissionService, orgId, userId, permissions, options) {
    const { customMessage, auditContext } = options ?? {};
    const results = await Promise.all(permissions.map(perm => permissionService.checkPermission(userId, orgId, perm.resource, perm.action, perm.resourceId)));
    if (results.some(r => r.allowed)) {
        return;
    }
    if (results.length > 0 && results[0]?.missingPermission) {
        (0, auditLogger_1.logPermissionDenial)(userId, {
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
    const permissionKeys = permissions.map(p => `${p.resource}:${p.action}`).join(' OR ');
    const message = customMessage ||
        `You need one of the following permissions: ${permissionKeys}. Contact your organization administrator.`;
    throw new apiErrors_1.ForbiddenError(message, results[0]?.missingPermission);
}
async function requireAllPermissions(permissionService, orgId, userId, permissions, options) {
    const { customMessage, auditContext } = options ?? {};
    const results = await Promise.all(permissions.map(perm => permissionService.checkPermission(userId, orgId, perm.resource, perm.action, perm.resourceId)));
    const deniedIndex = results.findIndex(r => !r.allowed);
    if (deniedIndex === -1) {
        return;
    }
    const deniedPermission = permissions[deniedIndex];
    (0, auditLogger_1.logPermissionDenial)(userId, {
        username: auditContext?.username,
        resource: deniedPermission.resource,
        action: deniedPermission.action,
        reason: results[deniedIndex].reason,
        ipAddress: auditContext?.ipAddress,
        userAgent: auditContext?.userAgent,
        resourceId: deniedPermission.resourceId,
        scope: orgId,
    });
    const permissionKey = `${deniedPermission.resource}:${deniedPermission.action}`;
    const message = customMessage ||
        `You need the '${permissionKey}' permission to perform this action. ${results[deniedIndex].reason || 'Contact your organization administrator.'}`;
    throw new apiErrors_1.ForbiddenError(message, results[deniedIndex].missingPermission);
}
function formatPermissionError(resource, action) {
    const actionLabels = {
        view: 'view',
        create: 'create',
        edit: 'edit',
        delete: 'delete',
        manage: 'manage',
        approve: 'approve',
        assign: 'assign',
    };
    const resourceLabels = {
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
async function requireTeamPermission(permissionService, orgId, userId, teamId, resource, action, options) {
    const { customMessage, auditContext } = options ?? {};
    const result = await permissionService.checkTeamPermission(orgId, userId, teamId, resource, action);
    if (!result.allowed) {
        (0, auditLogger_1.logPermissionDenial)(userId, {
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
        const message = customMessage ??
            `You need the '${permissionKey}' permission within this team. ${result.reason ?? 'Contact your team leader or organization administrator.'}`;
        throw new apiErrors_1.ForbiddenError(message, result.missingPermission);
    }
}
//# sourceMappingURL=permissionHelpers.js.map