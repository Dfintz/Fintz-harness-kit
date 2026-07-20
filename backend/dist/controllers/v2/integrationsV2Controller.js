"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsV2Controller = void 0;
const ExternalIntegration_1 = require("../../models/ExternalIntegration");
const external_1 = require("../../services/external");
const FleetService_1 = require("../../services/fleet/FleetService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class IntegrationsV2Controller extends BaseController_1.BaseController {
    integrationService = new external_1.ExternalIntegrationService();
    fleetService = new FleetService_1.FleetService();
    listIntegrations = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const orgId = this.getOrganizationIdFromRequest(req);
            const fleetId = this.requireUuid(req.query.fleetId, 'fleetId');
            const fleet = await this.fleetService.getFleetById(orgId, fleetId);
            if (!fleet) {
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            const typeFilter = req.query.type;
            const integrations = await this.integrationService.getIntegrations(fleetId);
            return integrations.filter(integration => typeFilter ? integration.type === typeFilter : true);
        });
    };
    createIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const orgId = this.getOrganizationIdFromRequest(req);
            const dto = req.body;
            const fleet = await this.fleetService.getFleetById(orgId, dto.fleetId);
            if (!fleet) {
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            dto.createdBy = this.getUserId(req);
            const integration = await this.integrationService.createIntegration(dto);
            return integration;
        }, 201);
    };
    getIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integration = await this.verifyIntegrationOwnership(req.params.integrationId, req);
            return integration;
        });
    };
    updateIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
            await this.verifyIntegrationOwnership(integrationId, req);
            const dto = req.body;
            return this.integrationService.updateIntegration(integrationId, dto);
        });
    };
    deleteIntegration = async (req, res) => {
        await this.execute(req, res, async () => {
            const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
            await this.verifyIntegrationOwnership(integrationId, req);
            await this.integrationService.deleteIntegration(integrationId);
            res.status(200).json({ message: 'Integration deleted successfully' });
        });
    };
    testConnection = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
            await this.verifyIntegrationOwnership(integrationId, req);
            return this.integrationService.testConnection(integrationId);
        });
    };
    syncIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
            await this.verifyIntegrationOwnership(integrationId, req);
            const syncRequest = {
                integrationId,
                categories: req.body.categories,
                fullSync: req.body.fullSync || false,
                dryRun: req.body.dryRun || false,
            };
            return this.integrationService.syncInventory(syncRequest);
        });
    };
    getLogs = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integration = await this.verifyIntegrationOwnership(req.params.integrationId, req);
            const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
            const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;
            return (integration.syncHistory || []).filter((log) => {
                if (startDate && log.timestamp < startDate) {
                    return false;
                }
                if (endDate && log.timestamp > endDate) {
                    return false;
                }
                return true;
            });
        });
    };
    getAvailableIntegrationTypes = async (_req, res) => {
        res.status(200).json({
            types: Object.values(ExternalIntegration_1.IntegrationType),
        });
    };
    async verifyIntegrationOwnership(integrationId, req) {
        const normalizedId = this.requireUuid(integrationId, 'integrationId');
        const orgId = this.getOrganizationIdFromRequest(req);
        const integration = await this.integrationService.getIntegrationById(normalizedId);
        if (!integration) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        const fleet = await this.fleetService.getFleetById(orgId, integration.fleetId);
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        return integration;
    }
    getOrganizationIdFromRequest(req) {
        const authReq = req;
        const orgId = authReq.user?.currentOrganizationId;
        if (!orgId) {
            throw new apiErrors_1.ForbiddenError('Organization context is required for integration operations');
        }
        return orgId;
    }
    getUserId(req) {
        const authReq = req;
        const userId = authReq.user?.id;
        if (!userId) {
            throw new apiErrors_1.ForbiddenError('Authentication required');
        }
        return userId;
    }
    requireUuid(value, fieldName) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!value || !uuidRegex.test(value)) {
            throw new apiErrors_1.ValidationError(`Invalid ${fieldName}`);
        }
        return value;
    }
}
exports.IntegrationsV2Controller = IntegrationsV2Controller;
//# sourceMappingURL=integrationsV2Controller.js.map