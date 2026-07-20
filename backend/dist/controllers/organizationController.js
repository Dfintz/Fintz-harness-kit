"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const OrganizationActivity_1 = require("../models/OrganizationActivity");
const OrganizationAnalytics_1 = require("../models/OrganizationAnalytics");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const OrganizationActivityService_1 = require("../services/organization/OrganizationActivityService");
const OrganizationAnalyticsService_1 = require("../services/organization/OrganizationAnalyticsService");
const OrganizationBulkService_1 = require("../services/organization/OrganizationBulkService");
const OrganizationHierarchyService_1 = require("../services/organization/OrganizationHierarchyService");
const OrganizationMemberService_1 = require("../services/organization/OrganizationMemberService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const OrganizationService_1 = require("../services/organization/OrganizationService");
const OrganizationSettingsService_1 = require("../services/organization/OrganizationSettingsService");
const OrganizationTemplateService_1 = require("../services/organization/OrganizationTemplateService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
class OrganizationController extends BaseController_1.BaseController {
    organizationService = new OrganizationService_1.OrganizationService();
    hierarchyService = new OrganizationHierarchyService_1.OrganizationHierarchyService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    memberService = new OrganizationMemberService_1.OrganizationMemberService();
    activityService = new OrganizationActivityService_1.OrganizationActivityService();
    settingsService = new OrganizationSettingsService_1.OrganizationSettingsService();
    analyticsService = new OrganizationAnalyticsService_1.OrganizationAnalyticsService();
    templateService = new OrganizationTemplateService_1.OrganizationTemplateService();
    bulkService = new OrganizationBulkService_1.OrganizationBulkService();
    requireAdmin(req) {
        if (req.user?.role !== 'admin') {
            throw new apiErrors_1.ForbiddenError('Admin access required');
        }
    }
    createOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const orgData = req.body;
            const organization = await this.organizationService.createOrganization(orgData, userId);
            res.status(201).json({
                success: true,
                message: 'Organization created successfully',
                data: organization,
            });
        });
    };
    getOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { includeHierarchy } = req.query;
            let organization;
            if (includeHierarchy === 'true') {
                organization = await this.organizationService.getOrganizationWithHierarchy(id);
            }
            else {
                organization = await this.organizationService.getOrganizationById(id);
            }
            if (!organization) {
                throw new apiErrors_1.NotFoundError('Organization');
            }
            res.json({
                success: true,
                data: organization,
            });
        });
    };
    listOrganizations = async (req, res) => {
        await this.execute(req, res, async () => {
            const { page, limit, sortBy, sortOrder } = req.query;
            const result = await this.organizationService.getOrganizations({}, {
                page: Number.parseInt(page, 10) || 1,
                limit: Math.min(Number.parseInt(limit, 10) || 20, 200),
                sortBy: sortBy,
                sortOrder: sortOrder,
            });
            res.json({
                success: true,
                ...result,
            });
        });
    };
    searchOrganizations = async (req, res) => {
        await this.execute(req, res, async () => {
            const { name, type, status, parentOrgId, level, tags, page, limit } = req.query;
            const filters = {};
            if (name) {
                filters.name = name;
            }
            if (type) {
                filters.type = type;
            }
            if (status) {
                filters.status = status;
            }
            if (parentOrgId !== undefined) {
                filters.parentOrgId = parentOrgId === 'null' ? null : parentOrgId;
            }
            if (level) {
                const parsedLevel = Number.parseInt(level, 10);
                if (!Number.isNaN(parsedLevel)) {
                    filters.level = parsedLevel;
                }
            }
            if (typeof tags === 'string') {
                filters.tags = tags.split(',');
            }
            const pagination = {
                page: Number.parseInt(page, 10) || 1,
                limit: Math.min(Number.parseInt(limit, 10) || 20, 200),
            };
            const result = await this.organizationService.searchOrganizations(name || '', filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    updateOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const updates = req.body;
            const organization = await this.organizationService.updateOrganization(id, updates, userId);
            if (!organization) {
                throw new apiErrors_1.NotFoundError('Organization');
            }
            res.json({
                success: true,
                message: 'Organization updated successfully',
                data: organization,
            });
        });
    };
    renameOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { name } = req.body;
            const organization = await this.organizationService.renameOrganization(id, name, userId);
            res.json({
                success: true,
                message: 'Organization renamed successfully',
                data: organization,
            });
        });
    };
    syncNameFromRsi = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const result = await this.organizationService.syncNameFromRsi(id, userId);
            res.json({
                success: true,
                message: result.organization.name === result.rsiName
                    ? 'Organization name is already up to date with RSI'
                    : `Organization name updated to "${result.rsiName}" from RSI`,
                data: result.organization,
                rsiName: result.rsiName,
            });
        });
    };
    deleteOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { deleteDescendants, reason, gracePeriodDays } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const isOwnerOrAdmin = await this.permissionService.isOwnerOrAdmin(userId, id);
            if (!isOwnerOrAdmin) {
                throw new apiErrors_1.ForbiddenError('Only organization owner or admin can delete organization');
            }
            const result = await this.organizationService.deleteOrganization(id, userId, deleteDescendants === 'true', {
                reason: reason,
                gracePeriodDays: gracePeriodDays
                    ? Number.parseInt(gracePeriodDays, 10) || undefined
                    : undefined,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
            });
            res.json({
                success: true,
                message: result.message,
                data: {
                    requestId: result.requestId,
                    scheduledFor: result.scheduledFor,
                },
            });
        });
    };
    createSubOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: parentId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, parentId, OrganizationPermission_1.ResourceType.HIERARCHY, OrganizationPermission_1.PermissionAction.CREATE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to create sub-organization');
            }
            const orgData = req.body;
            const subOrg = await this.hierarchyService.createSubOrganization(parentId, {
                ...orgData,
                ownerId: userId,
            });
            res.status(201).json({
                success: true,
                message: 'Sub-organization created successfully',
                data: subOrg,
            });
        });
    };
    moveOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { newParentId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermissionSource = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.HIERARCHY, OrganizationPermission_1.PermissionAction.EDIT);
            if (newParentId) {
                const hasPermissionTarget = await this.permissionService.checkPermission(userId, newParentId, OrganizationPermission_1.ResourceType.HIERARCHY, OrganizationPermission_1.PermissionAction.EDIT);
                if (!hasPermissionSource.allowed || !hasPermissionTarget.allowed) {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions to move organization');
                }
            }
            else if (!hasPermissionSource.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to move organization');
            }
            const result = await this.hierarchyService.moveOrganization(id, newParentId);
            res.json({
                success: true,
                message: 'Organization moved successfully',
                data: result,
            });
        });
    };
    detachOrganization = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const isOwnerOrAdmin = await this.permissionService.isOwnerOrAdmin(userId, id);
            if (!isOwnerOrAdmin) {
                throw new apiErrors_1.ForbiddenError('Only organization owner or admin can detach organization');
            }
            const result = await this.hierarchyService.detachFromParent(id);
            res.json({
                success: true,
                message: 'Organization detached successfully',
                data: result,
            });
        });
    };
    getOrganizationTree = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const tree = await this.hierarchyService.getTree(id);
            res.json({
                success: true,
                data: tree,
            });
        });
    };
    getAncestors = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const ancestors = await this.hierarchyService.getAncestors(id);
            res.json({
                success: true,
                data: ancestors,
            });
        });
    };
    getDescendants = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { maxDepth } = req.query;
            const descendants = await this.hierarchyService.getDescendants(id, maxDepth ? Number.parseInt(maxDepth, 10) || undefined : undefined);
            res.json({
                success: true,
                data: descendants,
            });
        });
    };
    getSiblings = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { includeSelf } = req.query;
            const siblings = await this.hierarchyService.getSiblings(id, includeSelf === 'true');
            res.json({
                success: true,
                data: siblings,
            });
        });
    };
    validateHierarchy = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const validation = await this.hierarchyService.validateHierarchy(id);
            res.json({
                success: true,
                data: validation,
            });
        });
    };
    getHierarchyStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const stats = await this.hierarchyService.getHierarchyStats(id);
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    addMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { userId: targetUserId, role } = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            await this.memberService.addMember(orgId, targetUserId, role, undefined, { addedBy: actorId }, undefined, { acquisitionSource: 'manual' });
            res.status(201).json({
                success: true,
                message: 'Member added successfully',
            });
        });
    };
    removeMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId, userId: targetUserId } = req.params;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            await this.memberService.removeMember(orgId, targetUserId, false);
            res.json({
                success: true,
                message: 'Member removed successfully',
            });
        });
    };
    updateMemberRole = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId, userId: targetUserId } = req.params;
            const { role: newRole } = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            await this.memberService.updateMemberRole(orgId, targetUserId, newRole);
            res.json({
                success: true,
                message: 'Member role updated successfully',
            });
        });
    };
    transferMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: fromOrgId, userId: targetUserId } = req.params;
            const { toOrgId } = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            await this.memberService.transferMember(fromOrgId, toOrgId, targetUserId, actorId);
            res.json({
                success: true,
                message: 'Member transferred successfully',
            });
        });
    };
    grantPermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { userId: targetUserId, resource, actions, scope, ...permissionData } = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(actorId, orgId, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to grant permissions');
            }
            const permission = await this.permissionService.grantPermission(orgId, targetUserId, { resource, actions, scope, ...permissionData }, actorId);
            res.status(201).json({
                success: true,
                message: 'Permission granted successfully',
                data: permission,
            });
        });
    };
    revokePermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId, permissionId } = req.params;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(actorId, orgId, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to revoke permissions');
            }
            await this.permissionService.revokePermission(permissionId);
            res.json({
                success: true,
                message: 'Permission revoked successfully',
            });
        });
    };
    updatePermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId, permissionId } = req.params;
            const updates = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(actorId, orgId, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update permissions');
            }
            const permission = await this.permissionService.updatePermission(permissionId, updates);
            res.json({
                success: true,
                message: 'Permission updated successfully',
                data: permission,
            });
        });
    };
    listPermissions = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const userId = req.user?.id;
            let permissions;
            if (userId) {
                permissions = await this.permissionService.getUserPermissions(userId, orgId);
            }
            else {
                permissions = await this.permissionService.getOrganizationPermissions(orgId);
            }
            res.json({
                success: true,
                data: permissions,
            });
        });
    };
    checkPermission = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { resource, action, resourceId } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const result = await this.permissionService.checkPermission(userId, orgId, resource, action, resourceId);
            res.json({
                success: true,
                data: result,
            });
        });
    };
    applyPermissionTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { userId: targetUserId, templateName } = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(actorId, orgId, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to apply template');
            }
            const permissions = await this.permissionService.applyPermissionTemplate(orgId, targetUserId, templateName, actorId);
            res.status(201).json({
                success: true,
                message: 'Permission template applied successfully',
                data: permissions,
            });
        });
    };
    getPermissionStats = async (req, res) => {
        try {
            const { id: orgId } = req.params;
            const stats = await this.permissionService.getPermissionStats(orgId);
            res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching permission stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch permission stats',
                details: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    };
    getActivity = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { action, actorId, severity, startDate, endDate, page, limit } = req.query;
            const filters = {};
            if (action) {
                filters.action = action;
            }
            if (actorId) {
                filters.actorId = actorId;
            }
            if (severity) {
                filters.severity = severity;
            }
            if (startDate) {
                filters.startDate = new Date(startDate);
            }
            if (endDate) {
                filters.endDate = new Date(endDate);
            }
            const pagination = {
                page: page ? Number.parseInt(page, 10) : 1,
                limit: Math.min(limit ? Number.parseInt(limit, 10) : 50, 200),
            };
            const result = await this.activityService.getOrganizationActivities(orgId, filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getActivityStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const { startDate, endDate } = req.query;
            const filters = {};
            if (startDate) {
                filters.startDate = new Date(startDate);
            }
            if (endDate) {
                filters.endDate = new Date(endDate);
            }
            const result = await this.activityService.getOrganizationActivities(orgId, filters);
            const resultData = result;
            const stats = {
                totalActivities: resultData.total || resultData.pagination?.total || 0,
                bySeverity: {},
                byAction: {},
                recentActivities: (resultData.items || resultData.data || []).slice(0, 10),
            };
            const activities = (resultData.items || resultData.data || []);
            for (const activity of activities) {
                stats.bySeverity[activity.severity] = (stats.bySeverity[activity.severity] || 0) + 1;
                stats.byAction[activity.action] = (stats.byAction[activity.action] || 0) + 1;
            }
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    updateSettings = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: orgId } = req.params;
            const settings = req.body;
            const actorId = req.user?.id;
            if (!actorId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(actorId, orgId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update settings');
            }
            const organization = await this.settingsService.updateSettings(orgId, settings, true);
            if (!organization) {
                throw new apiErrors_1.NotFoundError('Organization');
            }
            res.json({
                success: true,
                message: 'Settings updated successfully',
                data: organization,
            });
        });
    };
    getAnalyticsDashboard = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { period, refresh } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view analytics');
            }
            const dashboard = await this.analyticsService.getDashboard(id, period || OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY, refresh === 'true');
            res.json({
                success: true,
                data: dashboard,
            });
        });
    };
    getMemberStatistics = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { period } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view analytics');
            }
            const analytics = await this.analyticsService.generateAnalytics(id, period || OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY);
            res.json({
                success: true,
                data: analytics.memberStats,
            });
        });
    };
    getActivityMetrics = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { period } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view analytics');
            }
            const analytics = await this.analyticsService.generateAnalytics(id, period || OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY);
            res.json({
                success: true,
                data: analytics.activityMetrics,
            });
        });
    };
    getGrowthTrends = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { period } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view analytics');
            }
            const analytics = await this.analyticsService.generateAnalytics(id, period || OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY);
            res.json({
                success: true,
                data: analytics.growthMetrics,
            });
        });
    };
    exportAnalytics = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { period, format } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to export analytics');
            }
            const data = await this.analyticsService.exportAnalytics(id, period || OrganizationAnalytics_1.AnalyticsPeriod.WEEKLY, format || 'json');
            res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-${id}-${period || 'weekly'}.${format || 'json'}"`);
            res.send(data);
        });
    };
    createTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const template = await this.templateService.createTemplate(req.body, userId);
            res.status(201).json({
                success: true,
                message: 'Template created successfully',
                data: template,
            });
        });
    };
    searchMarketplace = async (req, res) => {
        await this.execute(req, res, async () => {
            const { search, category, tags, minRating, sortBy, sortOrder, limit, offset } = req.query;
            const result = await this.templateService.searchMarketplace({
                search: search,
                category: category,
                tags: typeof tags === 'string' ? tags.split(',') : undefined,
                minRating: minRating ? Number.parseFloat(minRating) : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
                limit: Math.min(limit ? Number.parseInt(limit, 10) : 20, 200),
                offset: offset ? Number.parseInt(offset, 10) : 0,
            });
            res.json({
                success: true,
                data: result.templates,
                total: result.total,
            });
        });
    };
    listTemplates = async (req, res) => {
        await this.execute(req, res, async () => {
            const { category, visibility } = req.query;
            const templates = await this.templateService.getTemplatesByCategory(category, visibility);
            res.json({
                success: true,
                data: templates,
            });
        });
    };
    getPopularTemplates = async (req, res) => {
        await this.execute(req, res, async () => {
            const { limit } = req.query;
            const templates = await this.templateService.getPopularTemplates(Math.min(limit ? Number.parseInt(limit, 10) : 10, 200));
            res.json({
                success: true,
                data: templates,
            });
        });
    };
    getTopRatedTemplates = async (req, res) => {
        await this.execute(req, res, async () => {
            const { limit } = req.query;
            const templates = await this.templateService.getTopRatedTemplates(Math.min(limit ? Number.parseInt(limit, 10) : 10, 200));
            res.json({
                success: true,
                data: templates,
            });
        });
    };
    getTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const template = await this.templateService.getTemplateById(id);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Template');
            }
            res.json({
                success: true,
                data: template,
            });
        });
    };
    updateTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const template = await this.templateService.updateTemplate(id, userId, req.body);
            res.json({
                success: true,
                message: 'Template updated successfully',
                data: template,
            });
        });
    };
    deleteTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            await this.templateService.deleteTemplate(id, userId);
            res.json({
                success: true,
                message: 'Template deleted successfully',
            });
        });
    };
    applyTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            if (req.body.organizationId) {
                const hasPermission = await this.permissionService.checkPermission(userId, req.body.organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
                if (!hasPermission.allowed) {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions to apply template');
                }
            }
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'name',
                'description',
                'settings',
                'customizations',
            ]);
            const organization = await this.templateService.applyTemplate(id, {
                ...safeBody,
                ownerId: userId,
            });
            res.status(201).json({
                success: true,
                message: 'Template applied successfully',
                data: organization,
            });
        });
    };
    forkTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const template = await this.templateService.forkTemplate(id, userId, req.body);
            res.status(201).json({
                success: true,
                message: 'Template forked successfully',
                data: template,
            });
        });
    };
    rateTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { rating } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const template = await this.templateService.rateTemplate(id, userId, rating);
            res.json({
                success: true,
                message: 'Template rated successfully',
                data: template,
            });
        });
    };
    exportTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const data = await this.templateService.exportTemplate(id);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="template-${id}.json"`);
            res.json(data);
        });
    };
    importTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const template = await this.templateService.importTemplate(req.body, userId);
            res.status(201).json({
                success: true,
                message: 'Template imported successfully',
                data: template,
            });
        });
    };
    bulkAddMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { members } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to add members');
            }
            const result = await this.bulkService.bulkAddMembers(id, members, userId);
            res.json({
                success: true,
                message: `Successfully added ${result.successful} members, ${result.failed} failed`,
                data: result,
            });
        });
    };
    bulkRemoveMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { userIds } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to remove members');
            }
            const result = await this.bulkService.bulkRemoveMembers(id, userIds, userId);
            res.json({
                success: true,
                message: `Successfully removed ${result.successful} members, ${result.failed} failed`,
                data: result,
            });
        });
    };
    bulkUpdateRoles = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { updates } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update roles');
            }
            const result = await this.bulkService.bulkUpdateRoles(id, updates, userId);
            res.json({
                success: true,
                message: `Successfully updated ${result.successful} roles, ${result.failed} failed`,
                data: result,
            });
        });
    };
    bulkGrantPermissions = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { grants } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to grant permissions');
            }
            const result = await this.bulkService.bulkGrantPermissions(id, grants, userId);
            res.json({
                success: true,
                message: `Successfully granted permissions to ${result.successful} members, ${result.failed} failed`,
                data: result,
            });
        });
    };
    bulkRevokePermissions = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { revocations } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.PERMISSIONS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to revoke permissions');
            }
            const result = await this.bulkService.bulkRevokePermissions(id, revocations, userId);
            res.json({
                success: true,
                message: `Successfully revoked permissions from ${result.successful} members, ${result.failed} failed`,
                data: result,
            });
        });
    };
    importMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { csvContent } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.MANAGE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to import members');
            }
            const result = await this.bulkService.importMembersFromCSV(id, csvContent, userId);
            res.json({
                success: true,
                message: `Successfully imported ${result.successful} members, ${result.failed} failed`,
                data: result,
            });
        });
    };
    exportMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.MEMBERS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to export members');
            }
            const csv = await this.bulkService.exportMembersToCSV(id);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="members-${id}.csv"`);
            res.send(csv);
        });
    };
    getBulkStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.ANALYTICS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view stats');
            }
            const stats = await this.bulkService.getBulkOperationStats(id);
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    connectDiscordGuild = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { guildId, guildName } = req.body;
            if (!guildId) {
                throw new Error('Guild ID is required');
            }
            let hasPermission = false;
            try {
                const permResult = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
                hasPermission = permResult.allowed;
            }
            catch (permError) {
                logger_1.logger.warn('Permission check failed, falling back to membership role', {
                    error: permError instanceof Error ? permError.message : String(permError),
                });
                const membership = await this.memberService.getMember(id, userId);
                const roleName = (0, roleUtils_1.getRoleName)(membership?.role);
                hasPermission = ['owner', 'founder', 'admin'].includes(roleName);
            }
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to connect Discord guild');
            }
            const organization = await this.organizationService.getOrganizationById(id);
            if (!organization) {
                throw new apiErrors_1.NotFoundError('Organization');
            }
            const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../services/discord/GuildOrganizationService')));
            const guildOrgService = GuildOrganizationService.getInstance();
            const guildInfo = await guildOrgService.fetchGuildInfo(guildId);
            const resolvedGuildName = guildInfo?.name ?? guildName ?? `Guild ${guildId}`;
            const mapping = await guildOrgService.syncOnDiscordConnection(guildId, id, resolvedGuildName, userId);
            if (guildInfo?.iconUrl) {
                const { discordSettingsService } = await Promise.resolve().then(() => __importStar(require('../services/discord/DiscordSettingsService')));
                const settings = await discordSettingsService.getOrCreateSettings(id, guildId, resolvedGuildName, guildInfo.iconUrl);
                if (settings && !settings.guildIconUrl) {
                    settings.guildIconUrl = guildInfo.iconUrl;
                    await discordSettingsService.saveSettings(settings);
                }
            }
            await this.activityService.logActivity({
                organizationId: id,
                actorId: userId,
                actorType: 'user',
                action: OrganizationActivity_1.OrgActivityAction.SETTINGS_UPDATED,
                description: `Discord guild ${guildId} connected`,
                severity: OrganizationActivity_1.ActivitySeverity.INFO,
                metadata: {
                    setting: 'discord_guild',
                    guildId,
                    guildName: mapping.guildName,
                    isPrimary: mapping.isPrimary,
                },
            });
            res.json({
                success: true,
                message: 'Discord guild connected successfully',
                data: {
                    guildId: mapping.guildId,
                    organizationId: mapping.organizationId,
                    guildName: mapping.guildName,
                    isPrimary: mapping.isPrimary,
                    isActive: mapping.isActive,
                },
            });
        });
    };
    disconnectDiscordGuild = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id, guildId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to disconnect Discord guild');
            }
            const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../services/discord/GuildOrganizationService')));
            const guildOrgService = GuildOrganizationService.getInstance();
            const success = await guildOrgService.deactivateMapping(guildId, userId);
            if (!success) {
                throw new apiErrors_1.NotFoundError('Guild mapping');
            }
            await this.activityService.logActivity({
                organizationId: id,
                actorId: userId,
                actorType: 'user',
                action: OrganizationActivity_1.OrgActivityAction.SETTINGS_UPDATED,
                description: `Discord guild ${guildId} disconnected`,
                severity: OrganizationActivity_1.ActivitySeverity.INFO,
                metadata: {
                    setting: 'discord_guild',
                    action: 'disconnect',
                    guildId,
                },
            });
            res.json({
                success: true,
                message: 'Discord guild disconnected successfully',
            });
        });
    };
    getDiscordGuilds = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            let hasPermission = false;
            try {
                const permResult = await this.permissionService.checkPermission(userId, id, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
                hasPermission = permResult.allowed;
            }
            catch (permError) {
                logger_1.logger.warn('Permission check failed for getDiscordGuilds, falling back to membership', {
                    error: permError instanceof Error ? permError.message : String(permError),
                });
                const membership = await this.memberService.getMember(id, userId);
                hasPermission = !!membership;
            }
            if (!hasPermission) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view Discord guilds');
            }
            const { GuildOrganizationService } = await Promise.resolve().then(() => __importStar(require('../services/discord/GuildOrganizationService')));
            const guildOrgService = GuildOrganizationService.getInstance();
            const guilds = await guildOrgService.getGuildsForOrganization(id);
            const enrichedGuilds = await Promise.all(guilds.map(async (g) => {
                let name = g.guildName;
                let iconUrl = null;
                const guildInfo = await guildOrgService.fetchGuildInfo(g.guildId);
                if (guildInfo) {
                    iconUrl = guildInfo.iconUrl;
                    if (!name || name.startsWith('Guild ')) {
                        if (guildInfo.name !== name) {
                            name = guildInfo.name;
                            await guildOrgService.createOrUpdateMapping(g.guildId, g.organizationId, guildInfo.name, g.isPrimary);
                        }
                    }
                }
                return {
                    guildId: g.guildId,
                    guildName: name,
                    guildIconUrl: iconUrl,
                    isPrimary: g.isPrimary,
                    isActive: g.isActive,
                    createdAt: g.createdAt,
                };
            }));
            res.json({
                success: true,
                data: enrichedGuilds,
            });
        });
    };
    getPendingDeletionRequests = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            this.requireAdmin(req);
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const requests = await deletionService.getPendingRequests();
            res.json({
                success: true,
                data: requests,
            });
        });
    };
    getDeletionRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const request = await deletionService.getRequestById(requestId);
            if (!request) {
                throw new apiErrors_1.NotFoundError('Deletion request');
            }
            res.json({
                success: true,
                data: request,
            });
        });
    };
    approveDeletionRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { requestId } = req.params;
            const { notes, generateExport } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            this.requireAdmin(req);
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const request = await deletionService.approveDeletionRequest(requestId, userId, {
                notes,
                generateExport: generateExport !== false,
            });
            res.json({
                success: true,
                message: 'Deletion request approved successfully',
                data: request,
            });
        });
    };
    rejectDeletionRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { requestId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            if (!reason) {
                throw new Error('Rejection reason is required');
            }
            this.requireAdmin(req);
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const request = await deletionService.rejectDeletionRequest(requestId, userId, reason);
            res.json({
                success: true,
                message: 'Deletion request rejected successfully',
                data: request,
            });
        });
    };
    cancelDeletionRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { requestId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const request = await deletionService.cancelDeletionRequest(requestId, userId, reason);
            res.json({
                success: true,
                message: 'Deletion request cancelled successfully',
                data: request,
            });
        });
    };
    getDeletionPreview = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { deleteDescendants } = req.query;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, id, 'ORGANIZATION', 'DELETE');
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const preview = await deletionService.generateDeletionPreview(id, deleteDescendants === 'true');
            res.json({
                success: true,
                data: preview,
            });
        });
    };
    getLatestDeletionRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { OrganizationDeletionService } = await Promise.resolve().then(() => __importStar(require('../services/organization/OrganizationDeletionService')));
            const deletionService = new OrganizationDeletionService();
            const requests = await deletionService.getRequestsForOrganization(id);
            const latestRequest = requests.find(r => !['completed', 'failed', 'rejected', 'cancelled'].includes(r.status));
            if (!latestRequest) {
                throw new apiErrors_1.NotFoundError('No active deletion request found');
            }
            res.json({
                success: true,
                data: latestRequest,
            });
        });
    };
    getOrganizations = async (req, res) => this.listOrganizations(req, res);
    addOrganization = async (req, res) => this.createOrganization(req, res);
    removeOrganization = async (req, res) => this.deleteOrganization(req, res);
}
exports.OrganizationController = OrganizationController;
//# sourceMappingURL=organizationController.js.map