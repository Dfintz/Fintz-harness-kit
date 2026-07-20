"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsReadController = void 0;
const ExternalIntegration_1 = require("../../models/ExternalIntegration");
const starcomms_1 = require("../../services/communication/starcomms");
const external_1 = require("../../services/external");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class StarCommsReadController extends BaseController_1.BaseController {
    integrationService = new external_1.ExternalIntegrationService();
    accessService = new starcomms_1.StarCommsAccessService();
    starCommsAdapter = new starcomms_1.StarCommsAdapter();
    getStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integration = await this.verifyStarCommsIntegration(req.params.integrationId, req);
            const config = this.starCommsAdapter.buildConnectionConfig(integration);
            return this.starCommsAdapter.getShardStatus(config);
        });
    };
    getMetrics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const integration = await this.verifyStarCommsIntegration(req.params.integrationId, req);
            const config = this.starCommsAdapter.buildConnectionConfig(integration);
            const window = {
                startDate: req.query.startDate ? String(req.query.startDate) : undefined,
                endDate: req.query.endDate ? String(req.query.endDate) : undefined,
                windowMinutes: req.query.windowMinutes ? Number(req.query.windowMinutes) : undefined,
            };
            return this.starCommsAdapter.getMetricsWindow(config, window);
        });
    };
    async verifyStarCommsIntegration(integrationId, req) {
        const normalizedId = this.requireUuid(integrationId, 'integrationId');
        const authReq = req;
        const userId = authReq.user?.id;
        if (!userId) {
            throw new apiErrors_1.ForbiddenError('Authentication is required for integration operations');
        }
        const orgId = this.getOrganizationIdFromRequest(req);
        const integration = await this.integrationService.getIntegrationById(normalizedId);
        if (!integration) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        if (integration.type !== ExternalIntegration_1.IntegrationType.STARCOMMS) {
            throw new apiErrors_1.ValidationError('Integration is not configured as StarComms');
        }
        await this.accessService.ensureIntegrationAccess(userId, orgId, integration);
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
    requireUuid(value, fieldName) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!value || !uuidRegex.test(value)) {
            throw new apiErrors_1.ValidationError(`Invalid ${fieldName}`);
        }
        return value;
    }
}
exports.StarCommsReadController = StarCommsReadController;
//# sourceMappingURL=starCommsReadController.js.map