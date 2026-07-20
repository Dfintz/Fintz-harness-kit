"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const Webhook_1 = require("../models/Webhook");
const WebhookService_1 = require("../services/communication/webhooks/WebhookService");
const apiErrors_1 = require("../utils/apiErrors");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const urlValidator_1 = require("../utils/urlValidator");
const BaseController_1 = require("./BaseController");
class WebhookController extends BaseController_1.BaseController {
    webhookService = new WebhookService_1.WebhookService();
    constructor() {
        super();
    }
    validateWebhook = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = this.getOrganizationId(req);
            const dto = {
                ...this.sanitizeWebhookPayload(req.body),
                createdBy: user.id,
            };
            const validation = await this.webhookService.testWebhookConfig(organizationId, dto);
            res.status(200).json(validation);
        });
    };
    createWebhook = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = this.getOrganizationId(req);
            const dto = {
                ...this.sanitizeWebhookPayload(req.body),
                createdBy: user.id,
            };
            const webhook = await this.webhookService.createWebhook(organizationId, dto);
            res.status(201).json(webhook);
        });
    };
    getWebhooks = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.webhookService.getWebhooksByOrganization(organizationId);
        });
    };
    getWebhook = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const organizationId = this.getOrganizationId(req);
            const webhook = await this.webhookService.getWebhookById(id);
            if (!webhook) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (webhook.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            return webhook;
        });
    };
    updateWebhook = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const organizationId = this.getOrganizationId(req);
            const existing = await this.webhookService.getWebhookById(id);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (existing.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            const dto = this.sanitizeWebhookPayload(req.body);
            return this.webhookService.updateWebhook(id, dto);
        });
    };
    deleteWebhook = async (req, res) => {
        await this.execute(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'webhook id');
            const organizationId = this.getOrganizationId(req);
            const existing = await this.webhookService.getWebhookById(id);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (existing.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            await this.webhookService.deleteWebhook(id);
            res.status(200).json({ message: 'Webhook deleted successfully' });
        });
    };
    testWebhook = async (req, res) => {
        await this.execute(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'webhook id');
            const organizationId = this.getOrganizationId(req);
            const existing = await this.webhookService.getWebhookById(id);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (existing.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            if (existing.customConfig?.url) {
                existing.customConfig.url = (0, urlValidator_1.validateWebhookUrl)(existing.customConfig.url).toString();
            }
            if (existing.discordConfig?.webhookUrl) {
                existing.discordConfig.webhookUrl = (0, urlValidator_1.validateWebhookUrl)(existing.discordConfig.webhookUrl).toString();
            }
            const result = await this.webhookService.testWebhook(existing);
            if (result.success) {
                res.status(200).json({
                    message: 'Webhook test successful',
                    success: true,
                    responseTime: result.responseTime,
                    statusCode: result.statusCode,
                });
            }
            else {
                res.status(400).json({
                    message: 'Webhook test failed',
                    success: false,
                    error: result.error,
                });
            }
        });
    };
    triggerEvent = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { data } = req.body;
            const event = this.parseWebhookEvent(req.body.event);
            const webhooks = await this.webhookService.getWebhooksByOrganization(organizationId);
            for (const webhook of webhooks) {
                if (webhook.customConfig?.url) {
                    webhook.customConfig.url = (0, urlValidator_1.validateWebhookUrl)(webhook.customConfig.url).toString();
                }
                if (webhook.discordConfig?.webhookUrl) {
                    webhook.discordConfig.webhookUrl = (0, urlValidator_1.validateWebhookUrl)(webhook.discordConfig.webhookUrl).toString();
                }
            }
            return this.webhookService.triggerEvent(organizationId, event, data || {});
        });
    };
    getStatistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.webhookService.getStatistics(organizationId);
        });
    };
    getDeliveryHistory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const organizationId = this.getOrganizationId(req);
            const webhook = await this.webhookService.getWebhookById(id);
            if (!webhook) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (webhook.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            const { page, limit, offset } = this.getPaginationParams(req);
            const deliveries = webhook.deliveryHistory;
            const paginatedDeliveries = deliveries.slice(offset, offset + limit);
            return this.createPaginatedResponse(paginatedDeliveries, deliveries.length, page, limit);
        });
    };
    getEventTypes = async (req, res) => {
        await this.executeAndReturn(req, res, async () => Object.values(Webhook_1.WebhookEventType).map(event => ({
            value: event,
            label: this.formatEventLabel(event),
            category: this.getEventCategory(event),
        })));
    };
    formatEventLabel(event) {
        return event
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    getEventCategory(event) {
        const [category] = event.split('.');
        return category;
    }
    requireUuid(value, fieldName) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!value || !uuidRegex.test(value)) {
            throw new apiErrors_1.ValidationError(`Invalid ${fieldName}`);
        }
        return value;
    }
    parseWebhookEvent(value) {
        if (typeof value !== 'string') {
            throw new apiErrors_1.ValidationError('Invalid event type');
        }
        const normalizedEventMap = {
            [Webhook_1.WebhookEventType.FLEET_CREATED]: Webhook_1.WebhookEventType.FLEET_CREATED,
            [Webhook_1.WebhookEventType.FLEET_UPDATED]: Webhook_1.WebhookEventType.FLEET_UPDATED,
            [Webhook_1.WebhookEventType.FLEET_DELETED]: Webhook_1.WebhookEventType.FLEET_DELETED,
            [Webhook_1.WebhookEventType.FLEET_MEMBER_JOINED]: Webhook_1.WebhookEventType.FLEET_MEMBER_JOINED,
            [Webhook_1.WebhookEventType.FLEET_MEMBER_LEFT]: Webhook_1.WebhookEventType.FLEET_MEMBER_LEFT,
            [Webhook_1.WebhookEventType.MEMBER_JOINED]: Webhook_1.WebhookEventType.MEMBER_JOINED,
            [Webhook_1.WebhookEventType.MEMBER_LEFT]: Webhook_1.WebhookEventType.MEMBER_LEFT,
            [Webhook_1.WebhookEventType.MEMBER_ROLE_CHANGED]: Webhook_1.WebhookEventType.MEMBER_ROLE_CHANGED,
            [Webhook_1.WebhookEventType.ACTIVITY_CREATED]: Webhook_1.WebhookEventType.ACTIVITY_CREATED,
            [Webhook_1.WebhookEventType.ACTIVITY_STARTED]: Webhook_1.WebhookEventType.ACTIVITY_STARTED,
            [Webhook_1.WebhookEventType.ACTIVITY_COMPLETED]: Webhook_1.WebhookEventType.ACTIVITY_COMPLETED,
            [Webhook_1.WebhookEventType.ACTIVITY_CANCELLED]: Webhook_1.WebhookEventType.ACTIVITY_CANCELLED,
            [Webhook_1.WebhookEventType.ACTIVITY_PARTICIPANT_JOINED]: Webhook_1.WebhookEventType.ACTIVITY_PARTICIPANT_JOINED,
            [Webhook_1.WebhookEventType.ACTIVITY_PARTICIPANT_LEFT]: Webhook_1.WebhookEventType.ACTIVITY_PARTICIPANT_LEFT,
            [Webhook_1.WebhookEventType.ALERT_CREATED]: Webhook_1.WebhookEventType.ALERT_CREATED,
            [Webhook_1.WebhookEventType.ALERT_RESOLVED]: Webhook_1.WebhookEventType.ALERT_RESOLVED,
            [Webhook_1.WebhookEventType.SHIP_ADDED]: Webhook_1.WebhookEventType.SHIP_ADDED,
            [Webhook_1.WebhookEventType.SHIP_REMOVED]: Webhook_1.WebhookEventType.SHIP_REMOVED,
            [Webhook_1.WebhookEventType.SHIP_TRANSFERRED]: Webhook_1.WebhookEventType.SHIP_TRANSFERRED,
            [Webhook_1.WebhookEventType.BATCH]: Webhook_1.WebhookEventType.BATCH,
        };
        const parsedEvent = normalizedEventMap[value];
        if (!parsedEvent) {
            throw new apiErrors_1.ValidationError('Invalid event type');
        }
        return parsedEvent;
    }
    sanitizeWebhookPayload(payload) {
        const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(payload, [
            'name',
            'description',
            'type',
            'events',
            'discordConfig',
            'customConfig',
            'secret',
            'maxRetries',
            'retryDelayMs',
            'timeoutMs',
            'circuitBreakerThreshold',
            'enabled',
            'notes',
        ]);
        const sanitized = { ...safeBody };
        if (safeBody.customConfig?.url) {
            sanitized.customConfig = {
                ...safeBody.customConfig,
                url: this.validateWebhookDestination(safeBody.customConfig.url),
            };
        }
        if (safeBody.discordConfig?.webhookUrl || safeBody.discordConfig?.avatarUrl) {
            sanitized.discordConfig = {
                ...safeBody.discordConfig,
                ...(safeBody.discordConfig?.webhookUrl
                    ? { webhookUrl: this.validateWebhookDestination(safeBody.discordConfig.webhookUrl) }
                    : {}),
                ...(safeBody.discordConfig?.avatarUrl
                    ? { avatarUrl: this.validateWebhookDestination(safeBody.discordConfig.avatarUrl) }
                    : {}),
            };
        }
        return sanitized;
    }
    validateWebhookDestination(url) {
        try {
            return (0, urlValidator_1.validateWebhookUrl)(url).toString();
        }
        catch (error) {
            if (error instanceof urlValidator_1.UrlValidationError) {
                throw new apiErrors_1.ValidationError(`Invalid webhook URL: ${error.message}`);
            }
            throw error;
        }
    }
    assertStoredWebhookDestination(webhook) {
        const { customConfig, discordConfig } = webhook;
        if (customConfig?.url) {
            this.validateWebhookDestination(customConfig.url);
        }
        if (discordConfig?.webhookUrl) {
            this.validateWebhookDestination(discordConfig.webhookUrl);
        }
        if (discordConfig?.avatarUrl) {
            this.validateWebhookDestination(discordConfig.avatarUrl);
        }
    }
    testWebhookCustom = async (req, res) => {
        await this.execute(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'webhook id');
            const organizationId = this.getOrganizationId(req);
            const existing = await this.webhookService.getWebhookById(id);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (existing.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            if (existing.customConfig?.url) {
                existing.customConfig.url = (0, urlValidator_1.validateWebhookUrl)(existing.customConfig.url).toString();
            }
            if (existing.discordConfig?.webhookUrl) {
                existing.discordConfig.webhookUrl = (0, urlValidator_1.validateWebhookUrl)(existing.discordConfig.webhookUrl).toString();
            }
            const { event, data, includeSignature } = req.body;
            const parsedEvent = event ? this.parseWebhookEvent(event) : undefined;
            const result = await this.webhookService.testWebhookWithPayload(existing, {
                event: parsedEvent,
                data,
                includeSignature,
            });
            if (result.success) {
                res.status(200).json({
                    message: 'Custom test webhook delivery successful',
                    success: true,
                    responseTime: result.responseTime,
                    statusCode: result.statusCode,
                    payload: result.payload,
                });
            }
            else {
                res.status(400).json({
                    message: 'Custom test webhook delivery failed',
                    success: false,
                    error: result.error,
                    payload: result.payload,
                });
            }
        });
    };
    getPayloadPreview = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const id = this.requireUuid(req.params.id, 'webhook id');
            const organizationId = this.getOrganizationId(req);
            const existing = await this.webhookService.getWebhookById(id);
            if (!existing) {
                throw new apiErrors_1.NotFoundError('Webhook');
            }
            if (existing.organizationId !== organizationId) {
                throw new apiErrors_1.ForbiddenError('Access denied');
            }
            this.assertStoredWebhookDestination(existing);
            const { event, data } = req.body;
            const parsedEvent = event ? this.parseWebhookEvent(event) : undefined;
            return this.webhookService.getTestPayloadPreview(id, {
                event: parsedEvent,
                data,
            });
        });
    };
    getBatchConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.webhookService.getBatchConfig());
    };
    configureBatch = async (req, res) => {
        await this.execute(req, res, async () => {
            const { maxBatchSize, maxWaitTimeMs, enabled } = req.body;
            this.webhookService.configureBatching({ maxBatchSize, maxWaitTimeMs, enabled });
            res.status(200).json({
                message: 'Batch configuration updated',
                config: this.webhookService.getBatchConfig(),
            });
        });
    };
    queueEventForBatch = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { data } = req.body;
            const event = this.parseWebhookEvent(req.body.event);
            const webhooks = await this.webhookService.getWebhooksByOrganization(organizationId);
            for (const webhook of webhooks) {
                if (webhook.customConfig?.url) {
                    webhook.customConfig.url = (0, urlValidator_1.validateWebhookUrl)(webhook.customConfig.url).toString();
                }
                if (webhook.discordConfig?.webhookUrl) {
                    webhook.discordConfig.webhookUrl = (0, urlValidator_1.validateWebhookUrl)(webhook.discordConfig.webhookUrl).toString();
                }
            }
            return this.webhookService.queueEventForBatch(organizationId, event, data || {});
        });
    };
    getPendingBatches = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.webhookService.getPendingBatches(organizationId);
        });
    };
    flushBatches = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { webhookId } = req.body;
            if (webhookId) {
                const webhook = await this.webhookService.getWebhookById(webhookId);
                if (!webhook) {
                    throw new apiErrors_1.NotFoundError('Webhook');
                }
                if (webhook.organizationId !== organizationId) {
                    throw new apiErrors_1.ForbiddenError('Access denied');
                }
                const result = await this.webhookService.flushBatch(organizationId, webhookId);
                return {
                    flushed: result ? 1 : 0,
                    results: result ? [result] : [],
                };
            }
            return this.webhookService.flushAllBatches(organizationId);
        });
    };
    cancelPendingBatches = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { webhookId } = req.query;
            if (webhookId) {
                const webhook = await this.webhookService.getWebhookById(webhookId);
                if (!webhook) {
                    throw new apiErrors_1.NotFoundError('Webhook');
                }
                if (webhook.organizationId !== organizationId) {
                    throw new apiErrors_1.ForbiddenError('Access denied');
                }
            }
            const cancelled = this.webhookService.cancelPendingBatches(organizationId, webhookId);
            res.status(200).json({
                message: `Cancelled ${cancelled} pending events`,
                cancelled,
            });
        });
    };
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=webhookController.js.map