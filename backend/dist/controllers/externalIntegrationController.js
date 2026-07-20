"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalIntegrationController = void 0;
const external_1 = require("../services/external");
const FleetService_1 = require("../services/fleet/FleetService");
const apiErrors_1 = require("../utils/apiErrors");
const urlValidator_1 = require("../utils/urlValidator");
const BaseController_1 = require("./BaseController");
class ExternalIntegrationController extends BaseController_1.BaseController {
    integrationService = new external_1.ExternalIntegrationService();
    fleetService = new FleetService_1.FleetService();
    constructor() {
        super();
    }
    getOrganizationId(req) {
        const authReq = req;
        const orgId = authReq.user?.currentOrganizationId;
        if (!orgId) {
            throw new apiErrors_1.ForbiddenError('Organization context is required for integration operations');
        }
        return orgId;
    }
    async verifyIntegrationOwnership(integrationId, req) {
        const orgId = this.getOrganizationId(req);
        const integration = await this.integrationService.getIntegrationById(integrationId);
        if (!integration) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        const fleet = await this.fleetService.getFleetById(orgId, integration.fleetId);
        if (!fleet) {
            throw new apiErrors_1.NotFoundError('Integration');
        }
        return integration;
    }
    createIntegration = async (req, res) => {
        await this.execute(req, res, async () => {
            this.getOrganizationId(req);
            const dto = this.sanitizeIntegrationUrls(req.body);
            const integration = await this.integrationService.createIntegration(dto);
            res.status(201).json(integration);
        });
    };
    getIntegrations = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            const orgId = this.getOrganizationId(req);
            const fleet = await this.fleetService.getFleetById(orgId, fleetId);
            if (!fleet) {
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            return this.integrationService.getIntegrations(fleetId);
        });
    };
    getIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const integration = await this.verifyIntegrationOwnership(id, req);
            return integration;
        });
    };
    updateIntegration = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            await this.verifyIntegrationOwnership(id, req);
            const dto = this.sanitizeIntegrationUrls(req.body);
            return this.integrationService.updateIntegration(id, dto);
        });
    };
    deleteIntegration = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            await this.verifyIntegrationOwnership(id, req);
            await this.integrationService.deleteIntegration(id);
            res.status(200).json({ message: 'Integration deleted successfully' });
        });
    };
    testConnection = async (req, res) => {
        await this.execute(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'integration id');
            const integration = await this.verifyIntegrationOwnership(id, req);
            if (integration.apiConfig?.baseUrl) {
                (0, urlValidator_1.validateExternalIntegrationUrl)(integration.apiConfig.baseUrl);
            }
            if (integration.webhookConfig?.url) {
                (0, urlValidator_1.validateExternalIntegrationUrl)(integration.webhookConfig.url);
            }
            const result = await this.integrationService.testConnection(id);
            if (result.success) {
                res.status(200).json({
                    message: 'Connection successful',
                    success: true,
                    responseTime: result.responseTime,
                });
            }
            else {
                res.status(400).json({
                    message: 'Connection failed',
                    success: false,
                    error: result.error,
                });
            }
        });
    };
    syncInventory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'integration id');
            const integration = await this.verifyIntegrationOwnership(id, req);
            if (integration.apiConfig?.baseUrl) {
                (0, urlValidator_1.validateExternalIntegrationUrl)(integration.apiConfig.baseUrl);
            }
            if (integration.webhookConfig?.url) {
                (0, urlValidator_1.validateExternalIntegrationUrl)(integration.webhookConfig.url);
            }
            const syncRequest = {
                integrationId: id,
                categories: req.body.categories,
                fullSync: req.body.fullSync || false,
                dryRun: req.body.dryRun || false,
            };
            return this.integrationService.syncInventory(syncRequest);
        });
    };
    sendWebhook = async (req, res) => {
        await this.execute(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'integration id');
            const integration = await this.verifyIntegrationOwnership(id, req);
            if (integration.webhookConfig?.url) {
                (0, urlValidator_1.validateExternalIntegrationUrl)(integration.webhookConfig.url);
            }
            const { event, data } = req.body;
            const result = await this.integrationService.sendWebhook(id, { event, data });
            if (result.success) {
                res.status(200).json({
                    message: 'Webhook sent successfully',
                    success: true,
                    statusCode: result.statusCode,
                });
            }
            else {
                res.status(400).json({
                    message: 'Webhook not sent',
                    success: false,
                    error: result.error,
                });
            }
        });
    };
    sanitizeIntegrationUrls(payload) {
        const normalizeUrl = (url) => {
            if (!url) {
                return url;
            }
            try {
                return (0, urlValidator_1.validateExternalIntegrationUrl)(url).toString();
            }
            catch (error) {
                if (error instanceof urlValidator_1.UrlValidationError) {
                    throw new apiErrors_1.ValidationError(`Invalid integration URL: ${error.message}`);
                }
                throw error;
            }
        };
        const sanitized = { ...payload };
        if (sanitized.webhookConfig?.url) {
            sanitized.webhookConfig = {
                ...sanitized.webhookConfig,
                url: normalizeUrl(sanitized.webhookConfig.url),
            };
        }
        if (sanitized.apiConfig) {
            const sanitizedEndpoints = {};
            const endpoints = sanitized.apiConfig.endpoints || {};
            Object.entries(endpoints).forEach(([key, url]) => {
                sanitizedEndpoints[key] = url ? normalizeUrl(url) : url;
            });
            const baseUrl = sanitized.apiConfig.baseUrl
                ? normalizeUrl(sanitized.apiConfig.baseUrl)
                : sanitized.apiConfig.baseUrl;
            sanitized.apiConfig = {
                ...sanitized.apiConfig,
                ...(baseUrl ? { baseUrl } : {}),
                endpoints: sanitizedEndpoints,
            };
        }
        return sanitized;
    }
    requireUuid(value, fieldName) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!value || !uuidRegex.test(value)) {
            throw new apiErrors_1.ValidationError(`Invalid ${fieldName}`);
        }
        return value;
    }
}
exports.ExternalIntegrationController = ExternalIntegrationController;
//# sourceMappingURL=externalIntegrationController.js.map