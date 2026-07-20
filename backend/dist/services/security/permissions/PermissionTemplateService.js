"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionTemplateService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../../data-source");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const Permission_1 = require("../../../models/Permission");
const types_1 = require("../../../types");
const auditLogger_1 = require("../../../utils/auditLogger");
const logger_1 = require("../../../utils/logger");
const PermissionManagerService_1 = require("./PermissionManagerService");
class PermissionTemplateService {
    permissionManager;
    permissionRepository = data_source_1.AppDataSource.getRepository(Permission_1.Permission);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    templates = new Map();
    auditLog = [];
    constructor() {
        this.permissionManager = new PermissionManagerService_1.PermissionManagerService();
        this.initializeSystemTemplates();
    }
    initializeSystemTemplates() {
        const systemTemplates = [
            {
                id: 'system-admin',
                name: 'Administrator',
                type: types_1.PermissionTemplateType.ADMIN,
                description: 'Full administrative access to all organization resources',
                permissions: [
                    { resource: 'fleet', action: 'manage', description: 'Full fleet management' },
                    { resource: 'events', action: 'manage', description: 'Full event management' },
                    { resource: 'members', action: 'manage', description: 'Member management' },
                    { resource: 'permissions', action: 'manage', description: 'Permission management' },
                    { resource: 'settings', action: 'manage', description: 'Organization settings' },
                    { resource: 'finance', action: 'manage', description: 'Financial management' },
                    { resource: 'recruitment', action: 'manage', description: 'Recruitment management' },
                    { resource: 'logistics', action: 'manage', description: 'Logistics management' },
                ],
                securityLevel: 5,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-moderator',
                name: 'Moderator',
                type: types_1.PermissionTemplateType.MODERATOR,
                description: 'Moderate content and manage day-to-day operations',
                permissions: [
                    { resource: 'fleet', action: 'read', description: 'View fleet information' },
                    { resource: 'fleet', action: 'edit', description: 'Edit fleet details' },
                    { resource: 'events', action: 'create', description: 'Create events' },
                    { resource: 'events', action: 'edit', description: 'Edit events' },
                    { resource: 'events', action: 'delete', description: 'Delete events' },
                    { resource: 'members', action: 'read', description: 'View members' },
                    { resource: 'members', action: 'moderate', description: 'Moderate member actions' },
                ],
                securityLevel: 3,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-member',
                name: 'Regular Member',
                type: types_1.PermissionTemplateType.MEMBER,
                description: 'Standard member access to organization resources',
                permissions: [
                    { resource: 'fleet', action: 'read', description: 'View fleet information' },
                    { resource: 'events', action: 'read', description: 'View events' },
                    { resource: 'events', action: 'rsvp', description: 'RSVP to events' },
                    { resource: 'members', action: 'read', description: 'View members' },
                ],
                securityLevel: 1,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-recruiter',
                name: 'Recruiter',
                type: types_1.PermissionTemplateType.RECRUITER,
                description: 'Manage recruitment and onboarding',
                permissions: [
                    { resource: 'recruitment', action: 'manage', description: 'Manage recruitment' },
                    { resource: 'members', action: 'read', description: 'View members' },
                    { resource: 'members', action: 'invite', description: 'Invite new members' },
                    { resource: 'events', action: 'read', description: 'View events' },
                    { resource: 'fleet', action: 'read', description: 'View fleet information' },
                ],
                securityLevel: 2,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-fleet-commander',
                name: 'Fleet Commander',
                type: types_1.PermissionTemplateType.FLEET_COMMANDER,
                description: 'Lead fleet operations and tactical missions',
                permissions: [
                    { resource: 'fleet', action: 'manage', description: 'Full fleet management' },
                    { resource: 'events', action: 'create', description: 'Create tactical events' },
                    { resource: 'events', action: 'edit', description: 'Edit tactical events' },
                    { resource: 'events', action: 'manage', description: 'Manage event roles' },
                    { resource: 'logistics', action: 'read', description: 'View logistics' },
                    { resource: 'members', action: 'read', description: 'View members' },
                ],
                securityLevel: 3,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-event-coordinator',
                name: 'Event Coordinator',
                type: types_1.PermissionTemplateType.EVENT_COORDINATOR,
                description: 'Organize and manage organization events',
                permissions: [
                    { resource: 'events', action: 'create', description: 'Create events' },
                    { resource: 'events', action: 'edit', description: 'Edit events' },
                    { resource: 'events', action: 'delete', description: 'Delete events' },
                    { resource: 'events', action: 'manage', description: 'Manage attendees' },
                    { resource: 'members', action: 'read', description: 'View members' },
                    { resource: 'fleet', action: 'read', description: 'View fleet information' },
                ],
                securityLevel: 2,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-finance-manager',
                name: 'Finance Manager',
                type: types_1.PermissionTemplateType.FINANCE_MANAGER,
                description: 'Manage organization finances and resources',
                permissions: [
                    { resource: 'finance', action: 'manage', description: 'Full financial management' },
                    { resource: 'logistics', action: 'read', description: 'View logistics' },
                    { resource: 'fleet', action: 'read', description: 'View fleet information' },
                    { resource: 'members', action: 'read', description: 'View members' },
                ],
                securityLevel: 3,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            {
                id: 'system-guest',
                name: 'Guest',
                type: types_1.PermissionTemplateType.GUEST,
                description: 'Limited read-only access for temporary guests',
                permissions: [
                    { resource: 'events', action: 'read', description: 'View public events' },
                    { resource: 'members', action: 'read', description: 'View member list' },
                ],
                securityLevel: 0,
                isSystemTemplate: true,
                createdBy: 'system',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];
        systemTemplates.forEach(template => {
            this.templates.set(template.id, template);
        });
        logger_1.logger.info(`Initialized ${systemTemplates.length} system permission templates`);
    }
    listTemplates(organizationId) {
        const templates = Array.from(this.templates.values());
        if (organizationId) {
            return templates.filter(t => t.isSystemTemplate || t.organizationId === organizationId);
        }
        return templates.filter(t => t.isSystemTemplate);
    }
    getTemplate(templateId) {
        return this.templates.get(templateId);
    }
    createTemplate(name, description, permissions, securityLevel, organizationId, createdBy) {
        const template = {
            id: `custom-${(0, uuid_1.v4)()}`,
            name,
            type: types_1.PermissionTemplateType.CUSTOM,
            description,
            permissions,
            securityLevel,
            isSystemTemplate: false,
            organizationId,
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.templates.set(template.id, template);
        logger_1.logger.info(`Created custom permission template: ${template.name} (${template.id})`);
        return template;
    }
    updateTemplate(templateId, updates) {
        const template = this.templates.get(templateId);
        if (!template) {
            return null;
        }
        if (template.isSystemTemplate) {
            throw new Error('Cannot modify system templates');
        }
        Object.assign(template, updates, { updatedAt: new Date() });
        this.templates.set(templateId, template);
        logger_1.logger.info(`Updated permission template: ${template.name} (${templateId})`);
        return template;
    }
    deleteTemplate(templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            return false;
        }
        if (template.isSystemTemplate) {
            throw new Error('Cannot delete system templates');
        }
        this.templates.delete(templateId);
        logger_1.logger.info(`Deleted permission template: ${template.name} (${templateId})`);
        return true;
    }
    async applyTemplate(templateId, userId, organizationId, appliedBy, reason) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        const userOrg = await this.userOrgRepository.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if (!userOrg) {
            throw new Error('User not member of organization');
        }
        const previousSecurityLevel = userOrg.securityLevel;
        userOrg.securityLevel = template.securityLevel;
        await this.userOrgRepository.save(userOrg);
        for (const perm of template.permissions) {
            await this.permissionManager.grantPermission(organizationId, userId, perm.resource, perm.action, appliedBy);
        }
        const auditEntry = {
            id: (0, uuid_1.v4)(),
            eventType: 'TEMPLATE_APPLY',
            userId: appliedBy,
            username: 'Unknown',
            organizationId,
            targetUserId: userId,
            targetUsername: 'Unknown',
            previousValue: previousSecurityLevel,
            newValue: template.securityLevel,
            reason,
            performedBy: appliedBy,
            performedByUsername: 'Unknown',
            timestamp: new Date(),
            metadata: {
                templateId,
                templateName: template.name,
                permissionsGranted: template.permissions.length,
            },
        };
        this.auditLog.push(auditEntry);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.PERMISSION_GRANTED,
            userId,
            actorId: appliedBy,
            organizationId,
            description: `Applied permission template: ${template.name}`,
            metadata: { templateId, reason },
        });
        logger_1.logger.info(`Applied template ${template.name} to user ${userId} in org ${organizationId}`);
    }
    async getUserPermissionStats(userId, organizationId) {
        const permissions = await this.permissionRepository.find({
            where: { userId, organizationId },
        });
        if (permissions.length === 0) {
            return null;
        }
        const now = new Date();
        const activePermissions = permissions.filter(p => !p.expiresAt || p.expiresAt > now);
        const expiredPermissions = permissions.filter(p => p.expiresAt && p.expiresAt <= now);
        const permissionCounts = new Map();
        permissions.forEach(p => {
            const key = `${p.resource}:${p.action}`;
            permissionCounts.set(key, (permissionCounts.get(key) || 0) + 1);
        });
        const mostUsedPermissions = Array.from(permissionCounts.entries())
            .map(([key, count]) => {
            const [resource, action] = key.split(':');
            return { resource: resource || '', action: action || '', usageCount: count };
        })
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, 5);
        return {
            userId,
            username: 'Unknown',
            organizationId,
            organizationName: 'Unknown',
            totalPermissions: permissions.length,
            activePermissions: activePermissions.length,
            expiredPermissions: expiredPermissions.length,
            lastUsed: permissions.length > 0
                ? permissions[0].grantedAt || permissions[0]?.granted
                : undefined,
            mostUsedPermissions,
        };
    }
    async generateUsageReport(organizationId) {
        const allPermissions = await this.permissionRepository.find({
            where: { organizationId },
        });
        const userOrgs = await this.userOrgRepository.find({
            where: { organizationId, isActive: true },
        });
        const now = new Date();
        const activePermissions = allPermissions.filter(p => !p.expiresAt || p.expiresAt > now);
        const expiredPermissions = allPermissions.filter(p => p.expiresAt && p.expiresAt <= now);
        const permissionsByType = {};
        allPermissions.forEach(p => {
            const key = `${p.resource}:${p.action}`;
            permissionsByType[key] = (permissionsByType[key] || 0) + 1;
        });
        const securityLevelDistribution = {};
        userOrgs.forEach(uo => {
            const level = uo.securityLevel || 0;
            securityLevelDistribution[level] = (securityLevelDistribution[level] || 0) + 1;
        });
        const userPermissionCounts = new Map();
        allPermissions.forEach(p => {
            userPermissionCounts.set(p.userId, (userPermissionCounts.get(p.userId) || 0) + 1);
        });
        const topUserIds = Array.from(userPermissionCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([userId]) => userId);
        const topUsers = [];
        for (const userId of topUserIds) {
            const stats = await this.getUserPermissionStats(userId, organizationId);
            if (stats) {
                topUsers.push(stats);
            }
        }
        const templatesUsed = {};
        const recentChanges = this.auditLog
            .filter(entry => entry.organizationId === organizationId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 20);
        return {
            organizationId,
            organizationName: 'Unknown',
            reportDate: new Date(),
            totalUsers: userOrgs.length,
            totalPermissions: allPermissions.length,
            activePermissions: activePermissions.length,
            expiredPermissions: expiredPermissions.length,
            permissionsByType,
            topUsers,
            recentChanges,
            securityLevelDistribution,
            templatesUsed,
        };
    }
    getAuditLog(organizationId, userId, startDate, endDate, limit = 100) {
        let filtered = this.auditLog;
        if (organizationId) {
            filtered = filtered.filter(entry => entry.organizationId === organizationId);
        }
        if (userId) {
            filtered = filtered.filter(entry => entry.userId === userId || entry.targetUserId === userId);
        }
        if (startDate) {
            filtered = filtered.filter(entry => entry.timestamp >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(entry => entry.timestamp <= endDate);
        }
        return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
    }
    logPermissionChange(eventType, userId, organizationId, performedBy, details) {
        const entry = {
            id: (0, uuid_1.v4)(),
            eventType,
            userId,
            username: 'Unknown',
            organizationId,
            performedBy,
            performedByUsername: 'Unknown',
            timestamp: new Date(),
            ...details,
        };
        this.auditLog.push(entry);
        logger_1.logger.info(`Permission audit: ${eventType} for user ${userId} in org ${organizationId}`);
    }
    getServiceStats() {
        const templates = Array.from(this.templates.values());
        return {
            totalTemplates: templates.length,
            systemTemplates: templates.filter(t => t.isSystemTemplate).length,
            customTemplates: templates.filter(t => !t.isSystemTemplate).length,
            auditLogEntries: this.auditLog.length,
        };
    }
}
exports.PermissionTemplateService = PermissionTemplateService;
//# sourceMappingURL=PermissionTemplateService.js.map