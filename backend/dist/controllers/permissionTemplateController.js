"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionTemplateController = void 0;
const security_1 = require("../services/security");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class PermissionTemplateController extends BaseController_1.BaseController {
    templateService = new security_1.PermissionTemplateService();
    permissionService = new security_1.PermissionService();
    listTemplates = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.query.organizationId;
            const templates = this.templateService.listTemplates(organizationId);
            return {
                templates,
                count: templates.length,
            };
        });
    };
    getTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { templateId } = req.params;
            const template = this.templateService.getTemplate(templateId);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Template');
            }
            return template;
        });
    };
    createTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const { name, description, permissions, securityLevel, organizationId } = req.body;
            const user = this.getAuthUser(req);
            this.validateRequired({ name, description, permissions, organizationId }, 'name', 'description', 'permissions', 'organizationId');
            if (securityLevel === undefined) {
                throw new apiErrors_1.ValidationError('Security level is required');
            }
            const hasPermission = await this.permissionService.hasPermission(user.id, organizationId, 'permissions', 'manage');
            if (!hasPermission && user.role !== 'admin') {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to create templates');
            }
            const template = this.templateService.createTemplate(name, description, permissions, securityLevel, organizationId, user.id);
            res.status(201).json(template);
        });
    };
    updateTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { templateId } = req.params;
            const updates = req.body;
            const user = this.getAuthUser(req);
            const template = this.templateService.getTemplate(templateId);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Template');
            }
            if (template.organizationId) {
                const hasPermission = await this.permissionService.hasPermission(user.id, template.organizationId, 'permissions', 'manage');
                if (!hasPermission && user.role !== 'admin') {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions to update template');
                }
            }
            try {
                const updated = this.templateService.updateTemplate(templateId, updates);
                if (!updated) {
                    throw new apiErrors_1.ValidationError('Failed to update template');
                }
                return updated;
            }
            catch (error) {
                if (error instanceof Error && error.message === 'Cannot modify system templates') {
                    throw new apiErrors_1.ForbiddenError('Cannot modify system templates');
                }
                throw error;
            }
        });
    };
    deleteTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { templateId } = req.params;
            const user = this.getAuthUser(req);
            const template = this.templateService.getTemplate(templateId);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Template');
            }
            if (template.organizationId) {
                const hasPermission = await this.permissionService.hasPermission(user.id, template.organizationId, 'permissions', 'manage');
                if (!hasPermission && user.role !== 'admin') {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions to delete template');
                }
            }
            try {
                const deleted = this.templateService.deleteTemplate(templateId);
                if (!deleted) {
                    throw new apiErrors_1.ValidationError('Failed to delete template');
                }
                return { message: 'Template deleted successfully' };
            }
            catch (error) {
                if (error instanceof Error && error.message === 'Cannot delete system templates') {
                    throw new apiErrors_1.ForbiddenError('Cannot delete system templates');
                }
                throw error;
            }
        });
    };
    applyTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { templateId } = req.params;
            const { userId, organizationId, reason } = req.body;
            const user = this.getAuthUser(req);
            this.validateRequired({ userId, organizationId }, 'userId', 'organizationId');
            const hasPermission = await this.permissionService.hasPermission(user.id, organizationId, 'permissions', 'manage');
            if (!hasPermission && user.role !== 'admin') {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to apply template');
            }
            await this.templateService.applyTemplate(templateId, userId, organizationId, user.id, reason);
            return {
                message: 'Template applied successfully',
                userId,
                organizationId,
                templateId,
            };
        });
    };
    getUserStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { userId } = req.params;
            const { organizationId } = req.query;
            const user = this.getAuthUser(req);
            this.validateRequired({ organizationId }, 'organizationId');
            const hasPermission = await this.permissionService.hasPermission(user.id, organizationId, 'permissions', 'read');
            if (!hasPermission && user.role !== 'admin' && user.id !== userId) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view stats');
            }
            const stats = await this.templateService.getUserPermissionStats(userId, organizationId);
            if (!stats) {
                throw new apiErrors_1.NotFoundError('Permission data');
            }
            return stats;
        });
    };
    generateReport = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { organizationId } = req.params;
            const user = this.getAuthUser(req);
            const hasPermission = await this.permissionService.hasPermission(user.id, organizationId, 'permissions', 'read');
            if (!hasPermission && user.role !== 'admin') {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view reports');
            }
            return this.templateService.generateUsageReport(organizationId);
        });
    };
    getAuditLog = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { organizationId, userId, startDate, endDate, limit } = req.query;
            const user = this.getAuthUser(req);
            if (organizationId) {
                const hasPermission = await this.permissionService.hasPermission(user.id, organizationId, 'permissions', 'read');
                if (!hasPermission && user.role !== 'admin') {
                    throw new apiErrors_1.ForbiddenError('Insufficient permissions to view audit logs');
                }
            }
            else if (user.role !== 'admin') {
                throw new apiErrors_1.ForbiddenError('Admin access required for cross-organization audit logs');
            }
            const auditLog = this.templateService.getAuditLog(organizationId, userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined, Math.min(limit ? parseInt(limit) : 100, 200));
            return {
                entries: auditLog,
                count: auditLog.length,
            };
        });
    };
    getServiceStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.requireRole(req, 'admin');
            return this.templateService.getServiceStats();
        });
    };
}
exports.PermissionTemplateController = PermissionTemplateController;
//# sourceMappingURL=permissionTemplateController.js.map