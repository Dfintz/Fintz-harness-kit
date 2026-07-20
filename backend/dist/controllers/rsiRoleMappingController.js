"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiRoleMappingController = void 0;
const data_source_1 = require("../data-source");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const rsi_1 = require("../services/rsi");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class RsiRoleMappingController extends BaseController_1.BaseController {
    roleMappingService;
    constructor() {
        super();
        this.roleMappingService = rsi_1.rsiRoleMappingService;
    }
    getMappings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.organizationId;
            const includeInactive = (0, queryUtils_1.parseBooleanQuery)(req.query.includeInactive);
            const mappings = await this.roleMappingService.getMappingsByOrganization(organizationId, includeInactive);
            return {
                mappings: mappings.map(m => ({
                    id: m.id,
                    rsiRank: m.rsiRank,
                    discordRoleId: m.discordRoleId,
                    internalRoleId: m.internalRoleId,
                    rbacPermissions: m.rbacPermissions,
                    isActive: m.isActive,
                    priority: m.priority,
                    description: m.description,
                    createdAt: m.createdAt,
                    updatedAt: m.updatedAt,
                    summary: m.getSummary(),
                })),
                count: mappings.length,
            };
        });
    };
    getDiscoveredRanks = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.organizationId;
            return this.roleMappingService.getDiscoveredRanks(organizationId);
        });
    };
    getSyncPreview = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.organizationId;
            const user = this.getAuthUser(req);
            const membership = await data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership).findOne({
                where: { userId: user.id, organizationId, isActive: true },
            });
            if (!membership) {
                throw new apiErrors_1.ForbiddenError('You are not an active member of this organization');
            }
            return this.roleMappingService.buildSyncPreview(organizationId);
        });
    };
    getMapping = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { organizationId, id } = req.params;
            const mapping = await this.roleMappingService.getMappingById(id, organizationId);
            if (!mapping) {
                throw new apiErrors_1.NotFoundError('Role mapping');
            }
            return {
                id: mapping.id,
                rsiRank: mapping.rsiRank,
                discordRoleId: mapping.discordRoleId,
                internalRoleId: mapping.internalRoleId,
                rbacPermissions: mapping.rbacPermissions,
                isActive: mapping.isActive,
                priority: mapping.priority,
                description: mapping.description,
                createdAt: mapping.createdAt,
                updatedAt: mapping.updatedAt,
                enabledPermissions: mapping.getEnabledPermissions(),
            };
        });
    };
    createMapping = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = req.params.organizationId;
            const body = req.body;
            const mapping = await this.roleMappingService.createMapping({
                organizationId,
                rsiRank: body.rsiRank,
                discordRoleId: body.discordRoleId,
                rbacPermissions: body.rbacPermissions,
                isActive: body.isActive,
                priority: body.priority,
                description: body.description,
                internalRoleId: body.internalRoleId,
            });
            logger_1.logger.info(`Role mapping created by user ${user.id}`, {
                mappingId: mapping.id,
                organizationId,
                rsiRank: body.rsiRank,
            });
            return {
                message: 'Role mapping created successfully',
                mapping: {
                    id: mapping.id,
                    rsiRank: mapping.rsiRank,
                    discordRoleId: mapping.discordRoleId,
                    internalRoleId: mapping.internalRoleId,
                    rbacPermissions: mapping.rbacPermissions,
                    isActive: mapping.isActive,
                    priority: mapping.priority,
                    description: mapping.description,
                    createdAt: mapping.createdAt,
                },
            };
        }, 201);
    };
    updateMapping = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { organizationId, id } = req.params;
            const body = req.body;
            const mapping = await this.roleMappingService.updateMapping(id, {
                discordRoleId: body.discordRoleId,
                rbacPermissions: body.rbacPermissions,
                isActive: body.isActive,
                priority: body.priority,
                description: body.description,
                internalRoleId: body.internalRoleId,
            }, organizationId);
            if (!mapping) {
                throw new apiErrors_1.NotFoundError('Role mapping');
            }
            logger_1.logger.info(`Role mapping updated by user ${user.id}`, {
                mappingId: id,
            });
            return {
                message: 'Role mapping updated successfully',
                mapping: {
                    id: mapping.id,
                    rsiRank: mapping.rsiRank,
                    discordRoleId: mapping.discordRoleId,
                    internalRoleId: mapping.internalRoleId,
                    rbacPermissions: mapping.rbacPermissions,
                    isActive: mapping.isActive,
                    priority: mapping.priority,
                    description: mapping.description,
                    updatedAt: mapping.updatedAt,
                },
            };
        });
    };
    deleteMapping = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { organizationId, id } = req.params;
            const deleted = await this.roleMappingService.deleteMapping(id, user.id, organizationId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Role mapping');
            }
            logger_1.logger.info(`Role mapping deleted by user ${user.id}`, {
                mappingId: id,
            });
            return {
                message: 'Role mapping deleted successfully',
            };
        });
    };
    getTemplates = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const templates = this.roleMappingService.getAvailableTemplates();
            return {
                templates,
            };
        });
    };
    getTemplateDetails = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { templateName } = req.params;
            const template = this.roleMappingService.getTemplateDetails(templateName);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Template');
            }
            return {
                name: template.name,
                description: template.description,
                mappings: template.mappings,
            };
        });
    };
    applyTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = req.params.organizationId;
            const body = req.body;
            const result = await this.roleMappingService.applyTemplate(organizationId, body.templateName, body.discordRoleMappings);
            logger_1.logger.info(`Template "${body.templateName}" applied by user ${user.id}`, {
                organizationId,
                result,
            });
            return {
                message: `Template "${body.templateName}" applied successfully`,
                result,
            };
        });
    };
    bulkUpsert = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = req.params.organizationId;
            const body = req.body;
            const result = await this.roleMappingService.upsertMappings(organizationId, body.mappings);
            logger_1.logger.info(`Bulk upsert performed by user ${user.id}`, {
                organizationId,
                result,
            });
            return {
                message: 'Bulk operation completed',
                result,
            };
        });
    };
    cloneMappings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = req.params.organizationId;
            const body = req.body;
            const result = await this.roleMappingService.cloneMappings(body.sourceOrgId, organizationId, body.includeDiscordRoles ?? false);
            logger_1.logger.info(`Mappings cloned by user ${user.id}`, {
                sourceOrgId: body.sourceOrgId,
                targetOrgId: organizationId,
                result,
            });
            return {
                message: 'Mappings cloned successfully',
                result,
            };
        });
    };
    getSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.organizationId;
            const summary = await this.roleMappingService.getOrganizationMappingSummary(organizationId);
            return summary;
        });
    };
    deleteAllMappings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = req.params.organizationId;
            const deletedCount = await this.roleMappingService.deleteAllMappings(organizationId, user.id);
            logger_1.logger.info(`All mappings deleted by user ${user.id}`, {
                organizationId,
                deletedCount,
            });
            return {
                message: 'All mappings deleted successfully',
                deletedCount,
            };
        });
    };
}
exports.RsiRoleMappingController = RsiRoleMappingController;
//# sourceMappingURL=rsiRoleMappingController.js.map