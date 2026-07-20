"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const axios_1 = __importDefault(require("axios"));
const data_source_1 = require("../../../data-source");
const Webhook_1 = require("../../../models/Webhook");
const apiErrors_1 = require("../../../utils/apiErrors");
const joiValidators_1 = require("../../../utils/joiValidators");
const logger_1 = require("../../../utils/logger");
const NotificationDispatcher_1 = require("../../notification/NotificationDispatcher");
class WebhookService {
    webhookRepository;
    axiosInstances = new Map();
    constructor(webhookRepository) {
        this.webhookRepository = webhookRepository || data_source_1.AppDataSource.getRepository(Webhook_1.Webhook);
    }
    async createWebhook(organizationId, dto) {
        try {
            this.validateWebhookConfig(dto);
            const secret = dto.secret || (dto.type === Webhook_1.WebhookType.CUSTOM ? this.generateSecret() : undefined);
            const webhook = this.webhookRepository.create({
                organizationId,
                name: dto.name,
                description: dto.description,
                type: dto.type,
                status: Webhook_1.WebhookStatus.PENDING,
                events: dto.events,
                discordConfig: dto.discordConfig,
                customConfig: dto.customConfig,
                secret,
                maxRetries: dto.maxRetries ?? 3,
                retryDelayMs: dto.retryDelayMs ?? 1000,
                timeoutMs: dto.timeoutMs ?? 30000,
                circuitBreakerThreshold: dto.circuitBreakerThreshold ?? 5,
                consecutiveFailures: 0,
                circuitBreakerOpen: false,
                adminNotifiedOfFailure: false,
                createdBy: dto.createdBy,
                notes: dto.notes,
                enabled: true,
                deliveryHistory: [],
                totalDeliveries: 0,
                successfulDeliveries: 0,
                failedDeliveries: 0,
            });
            const saved = await this.webhookRepository.save(webhook);
            await this.testWebhook(saved);
            logger_1.logger.info(`Webhook created: ${saved.id} (${saved.type}) for org ${organizationId}`);
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error creating webhook:', error);
            throw error;
        }
    }
    async getWebhookById(id) {
        try {
            return await this.webhookRepository.findOne({ where: { id } });
        }
        catch (error) {
            logger_1.logger.error(`Error getting webhook ${id}:`, error);
            throw error;
        }
    }
    async getWebhook(id) {
        return this.getWebhookById(id);
    }
    async getWebhooksByOrganization(organizationId) {
        try {
            return await this.webhookRepository.find({
                where: { organizationId },
                order: { createdAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting webhooks:', error);
            throw error;
        }
    }
    async listWebhooks(organizationId, status) {
        try {
            const where = { organizationId };
            if (status) {
                where.status = status;
            }
            return await this.webhookRepository.find({
                where,
                order: { createdAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error listing webhooks:', error);
            throw error;
        }
    }
    async updateWebhook(id, dto) {
        try {
            const webhook = await this.webhookRepository.findOne({ where: { id } });
            if (!webhook) {
                throw new Error(`Webhook ${id} not found`);
            }
            this.applySimpleFieldUpdates(webhook, dto);
            this.applyConfigUpdates(webhook, dto);
            this.axiosInstances.delete(id);
            const updated = await this.webhookRepository.save(webhook);
            logger_1.logger.info(`Webhook updated: ${id}`);
            return updated;
        }
        catch (error) {
            logger_1.logger.error(`Error updating webhook ${id}:`, error);
            throw error;
        }
    }
    applySimpleFieldUpdates(webhook, dto) {
        const simpleFields = [
            'name',
            'description',
            'events',
            'secret',
            'maxRetries',
            'retryDelayMs',
            'timeoutMs',
            'enabled',
            'notes',
        ];
        for (const field of simpleFields) {
            if (dto[field] !== undefined) {
                webhook[field] = dto[field];
            }
        }
    }
    applyConfigUpdates(webhook, dto) {
        if (dto.discordConfig !== undefined) {
            this.validateDiscordConfigUrl(dto.discordConfig);
            webhook.discordConfig = dto.discordConfig;
        }
        if (dto.customConfig !== undefined) {
            if (dto.customConfig.url) {
                this.validateUrlForSSRF(dto.customConfig.url);
            }
            webhook.customConfig = dto.customConfig;
        }
    }
    validateDiscordConfigUrl(config) {
        if (config.webhookUrl) {
            const discordUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
            if (!discordUrlPattern.test(config.webhookUrl)) {
                throw new apiErrors_1.ValidationError('Invalid Discord webhook URL format - must be a valid Discord webhook URL');
            }
            this.validateUrlForSSRF(config.webhookUrl);
        }
    }
    async deleteWebhook(id) {
        try {
            const result = await this.webhookRepository.delete(id);
            if (result.affected === 0) {
                throw new Error(`Webhook ${id} not found`);
            }
            this.axiosInstances.delete(id);
            logger_1.logger.info(`Webhook deleted: ${id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error deleting webhook ${id}:`, error);
            throw error;
        }
    }
    async testWebhook(idOrWebhook) {
        try {
            let webhook;
            if (typeof idOrWebhook === 'string') {
                const found = await this.webhookRepository.findOne({ where: { id: idOrWebhook } });
                if (!found) {
                    throw new Error(`Webhook ${idOrWebhook} not found`);
                }
                webhook = found;
            }
            else {
                webhook = idOrWebhook;
                if (!webhook.id) {
                    throw new apiErrors_1.ValidationError('Cannot test webhook without an id. Please save the webhook first.');
                }
            }
            const testPayload = {
                id: `test-${Date.now()}`,
                timestamp: new Date().toISOString(),
                event: Webhook_1.WebhookEventType.FLEET_CREATED,
                organizationId: webhook.organizationId,
                data: {
                    test: true,
                    message: 'This is a test webhook delivery',
                },
                retryCount: 0,
            };
            const result = await this.deliverWebhook(webhook, testPayload);
            webhook.status = result.success ? Webhook_1.WebhookStatus.ACTIVE : Webhook_1.WebhookStatus.ERROR;
            if (!result.success) {
                webhook.lastError = result.error;
            }
            await this.webhookRepository.save(webhook);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error testing webhook:`, error);
            throw error;
        }
    }
    async triggerEvent(organizationId, event, data) {
        const results = [];
        let success = 0;
        let failed = 0;
        let skipped = 0;
        try {
            const webhooks = await this.webhookRepository
                .createQueryBuilder('webhook')
                .where('webhook.organizationId = :organizationId', { organizationId })
                .andWhere('webhook.enabled = :enabled', { enabled: true })
                .andWhere('webhook.status != :errorStatus', { errorStatus: Webhook_1.WebhookStatus.ERROR })
                .getMany();
            const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));
            logger_1.logger.info(`Triggering event ${event} for ${subscribedWebhooks.length} webhooks in org ${organizationId}`);
            for (const webhook of subscribedWebhooks) {
                if (webhook.circuitBreakerOpen) {
                    logger_1.logger.warn(`Skipping webhook ${webhook.id} - circuit breaker is open`);
                    skipped++;
                    results.push({
                        success: false,
                        error: 'Circuit breaker is open',
                        deliveryId: this.generateDeliveryId(),
                        skipped: true,
                    });
                    continue;
                }
                const payload = {
                    id: this.generateDeliveryId(),
                    timestamp: new Date().toISOString(),
                    event,
                    organizationId,
                    data,
                    retryCount: 0,
                };
                if (webhook.type === Webhook_1.WebhookType.CUSTOM && webhook.secret) {
                    payload.signature = this.generateSignature(payload, webhook.secret);
                }
                const result = await this.deliverWithRetry(webhook, payload);
                results.push(result);
                if (result.success) {
                    success++;
                }
                else {
                    failed++;
                }
            }
            return { success, failed, skipped, results };
        }
        catch (error) {
            logger_1.logger.error(`Error triggering event ${event}:`, error);
            throw error;
        }
    }
    async deliverWithRetry(webhook, payload) {
        let lastResult = {
            success: false,
            error: 'No delivery attempted',
            deliveryId: payload.id,
        };
        for (let attempt = 0; attempt <= webhook.maxRetries; attempt++) {
            const attemptPayload = { ...payload, retryCount: attempt };
            if (attempt > 0) {
                const delay = webhook.retryDelayMs * Math.pow(2, attempt - 1);
                await this.delay(delay);
            }
            lastResult = await this.deliverWebhook(webhook, attemptPayload);
            await this.recordDelivery(webhook, attemptPayload, lastResult, attempt);
            if (lastResult.success) {
                break;
            }
            logger_1.logger.warn(`Webhook delivery attempt ${attempt + 1}/${webhook.maxRetries + 1} failed for ${webhook.id}: ${lastResult.error}`);
        }
        return lastResult;
    }
    async deliverWebhook(webhook, payload) {
        const startTime = Date.now();
        const deliveryId = payload.id;
        try {
            if (webhook.customConfig?.url) {
                this.validateUrlForSSRF(webhook.customConfig.url);
            }
            if (webhook.discordConfig?.webhookUrl) {
                this.validateUrlForSSRF(webhook.discordConfig.webhookUrl);
            }
            if (webhook.type === Webhook_1.WebhookType.DISCORD) {
                return await this.deliverDiscordWebhook(webhook, payload, startTime);
            }
            else {
                return await this.deliverCustomWebhook(webhook, payload, startTime);
            }
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error(`Webhook delivery failed for ${webhook.id}:`, error);
            return {
                success: false,
                error: errorMessage,
                responseTime,
                deliveryId,
            };
        }
    }
    async deliverDiscordWebhook(webhook, payload, startTime) {
        if (!webhook.discordConfig?.webhookUrl) {
            throw new Error('Discord webhook URL not configured');
        }
        const discordUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
        if (!discordUrlPattern.test(webhook.discordConfig.webhookUrl)) {
            throw new Error('Invalid Discord webhook URL format - must be a valid Discord webhook URL');
        }
        const discordMessage = this.formatDiscordMessage(payload, webhook);
        try {
            const url = webhook.discordConfig.threadId
                ? `${webhook.discordConfig.webhookUrl}?thread_id=${webhook.discordConfig.threadId}`
                : webhook.discordConfig.webhookUrl;
            const response = await axios_1.default.post(url, discordMessage, {
                timeout: webhook.timeoutMs,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const responseTime = Date.now() - startTime;
            return {
                success: true,
                statusCode: response.status,
                responseTime,
                deliveryId: payload.id,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const axiosError = error;
            return {
                success: false,
                statusCode: axiosError.response?.status,
                responseTime,
                error: axiosError.message,
                deliveryId: payload.id,
            };
        }
    }
    async deliverCustomWebhook(webhook, payload, startTime) {
        if (!webhook.customConfig?.url) {
            throw new Error('Custom webhook URL not configured');
        }
        this.validateUrlForSSRF(webhook.customConfig.url);
        const client = this.getAxiosClient();
        const headers = {
            'Content-Type': 'application/json',
            'X-Webhook-Event': payload.event,
            'X-Webhook-Delivery': payload.id,
            'X-Webhook-Timestamp': payload.timestamp,
        };
        const requestAuth = this.buildWebhookAuthConfig(webhook, headers);
        if (webhook.secret && payload.signature) {
            headers['X-Webhook-Signature'] = `sha256=${payload.signature}`;
        }
        if (webhook.customConfig.headers) {
            Object.assign(headers, webhook.customConfig.headers);
        }
        try {
            const response = await client.request({
                url: webhook.customConfig.url,
                method: webhook.customConfig.method,
                headers,
                auth: requestAuth,
                data: payload,
                timeout: webhook.timeoutMs,
            });
            const responseTime = Date.now() - startTime;
            return {
                success: true,
                statusCode: response.status,
                responseTime,
                deliveryId: payload.id,
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            const axiosError = error;
            return {
                success: false,
                statusCode: axiosError.response?.status,
                responseTime,
                error: axiosError.message,
                deliveryId: payload.id,
            };
        }
    }
    formatDiscordMessage(payload, webhook) {
        const embed = this.createDiscordEmbed(payload);
        return {
            username: webhook.discordConfig?.username || 'Fleet Manager',
            avatar_url: webhook.discordConfig?.avatarUrl,
            embeds: [embed],
        };
    }
    createDiscordEmbed(payload) {
        const eventColors = {
            'fleet.created': 0x3498db,
            'fleet.updated': 0x3498db,
            'fleet.deleted': 0xe74c3c,
            'fleet.member.joined': 0x2ecc71,
            'fleet.member.left': 0xe67e22,
            'member.joined': 0x2ecc71,
            'member.left': 0xe67e22,
            'member.role.changed': 0x9b59b6,
            'activity.created': 0x9b59b6,
            'activity.started': 0x1abc9c,
            'activity.completed': 0x2ecc71,
            'activity.cancelled': 0xe74c3c,
            'activity.participant.joined': 0x2ecc71,
            'activity.participant.left': 0xe67e22,
            'alert.created': 0xe74c3c,
            'alert.resolved': 0x2ecc71,
            'ship.added': 0x1abc9c,
            'ship.removed': 0xe74c3c,
            'ship.transferred': 0xf39c12,
        };
        const eventTitles = {
            'fleet.created': '🚀 New Fleet Created',
            'fleet.updated': '✏️ Fleet Updated',
            'fleet.deleted': '🗑️ Fleet Deleted',
            'fleet.member.joined': '👋 Member Joined Fleet',
            'fleet.member.left': '👋 Member Left Fleet',
            'member.joined': '🎉 New Member Joined',
            'member.left': '👋 Member Left',
            'member.role.changed': '🔄 Member Role Changed',
            'activity.created': '📋 New Activity Created',
            'activity.started': '▶️ Activity Started',
            'activity.completed': '✅ Activity Completed',
            'activity.cancelled': '❌ Activity Cancelled',
            'activity.participant.joined': '👥 Participant Joined',
            'activity.participant.left': '👥 Participant Left',
            'alert.created': '🚨 New Alert',
            'alert.resolved': '✅ Alert Resolved',
            'ship.added': '🛸 Ship Added',
            'ship.removed': '🛸 Ship Removed',
            'ship.transferred': '🔄 Ship Transferred',
        };
        const embed = {
            title: eventTitles[payload.event] || `Event: ${payload.event}`,
            color: eventColors[payload.event] || 0x7289da,
            timestamp: payload.timestamp,
            footer: {
                text: 'Star Citizen Fleet Manager',
            },
            fields: [],
        };
        const data = payload.data;
        if (data) {
            const fields = this.formatDataAsFields(data);
            embed.fields = fields.slice(0, 25);
        }
        return embed;
    }
    formatDataAsFields(data) {
        const fields = [];
        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                continue;
            }
            const name = this.formatFieldName(key);
            let valueStr;
            if (typeof value === 'object') {
                valueStr = JSON.stringify(value, null, 2);
                if (valueStr.length > 1024) {
                    valueStr = `${valueStr.substring(0, 1021)}...`;
                }
            }
            else {
                valueStr = String(value);
                if (valueStr.length > 1024) {
                    valueStr = `${valueStr.substring(0, 1021)}...`;
                }
            }
            fields.push({
                name,
                value: valueStr || '(empty)',
                inline: valueStr.length < 50,
            });
        }
        return fields;
    }
    formatFieldName(key) {
        return key
            .replaceAll(/([A-Z])/g, ' $1')
            .replaceAll('_', ' ')
            .replace(/^\w/, (c) => c.toUpperCase())
            .trim();
    }
    getAxiosClient() {
        const cacheKey = '__default__';
        if (this.axiosInstances.has(cacheKey)) {
            return this.axiosInstances.get(cacheKey);
        }
        const config = {
            timeout: 30000,
            headers: {},
        };
        const client = axios_1.default.create(config);
        client.interceptors.request.use(requestConfig => {
            const requestUrl = requestConfig.url || requestConfig.baseURL || '';
            if (requestUrl) {
                this.validateUrlForSSRF(requestUrl);
            }
            return requestConfig;
        });
        this.axiosInstances.set(cacheKey, client);
        return client;
    }
    buildWebhookAuthConfig(webhook, headers) {
        const auth = webhook.customConfig?.authentication;
        if (!auth) {
            return undefined;
        }
        switch (auth.type) {
            case 'basic':
                return {
                    username: auth.username || '',
                    password: auth.password || '',
                };
            case 'bearer':
                headers.Authorization = `Bearer ${auth.token}`;
                return undefined;
            case 'apiKey': {
                const header = auth.apiKeyHeader || 'X-API-Key';
                headers[header] = auth.apiKey || '';
                return undefined;
            }
            default:
                return undefined;
        }
    }
    validateUrlForSSRF(url) {
        try {
            const parsedUrl = new URL(url);
            const hostname = parsedUrl.hostname.toLowerCase();
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new apiErrors_1.ValidationError(`Invalid protocol: ${parsedUrl.protocol}. Only HTTP(S) is allowed.`);
            }
            if ((0, joiValidators_1.isLocalhost)(hostname)) {
                throw new apiErrors_1.ValidationError('Webhook URL cannot target localhost or loopback addresses');
            }
            if ((0, joiValidators_1.isPrivateIP)(hostname)) {
                throw new apiErrors_1.ValidationError('Webhook URL cannot target private network addresses');
            }
            const blockedHostnames = [
                '169.254.169.254',
                'metadata.google.internal',
                'metadata.gke.internal',
                'host.docker.internal',
            ];
            if (blockedHostnames.includes(hostname)) {
                throw new apiErrors_1.ValidationError('Webhook URL cannot target cloud metadata endpoints');
            }
            if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
                throw new apiErrors_1.ValidationError('HTTPS is required for webhooks in production');
            }
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('Invalid URL')) {
                    throw new apiErrors_1.ValidationError('Invalid webhook URL format');
                }
                throw error;
            }
            throw new apiErrors_1.ValidationError('Invalid webhook URL');
        }
    }
    async recordDelivery(webhook, payload, result, retryCount) {
        try {
            const deliveryLog = {
                deliveryId: result.deliveryId,
                timestamp: new Date(),
                event: payload.event,
                status: result.success ? 'success' : 'failed',
                statusCode: result.statusCode,
                responseTime: result.responseTime,
                error: result.error,
                retryCount,
            };
            webhook.deliveryHistory = [deliveryLog, ...webhook.deliveryHistory.slice(0, 99)];
            webhook.totalDeliveries++;
            webhook.lastDeliveryAt = new Date();
            if (result.success) {
                webhook.successfulDeliveries++;
                webhook.lastSuccessAt = new Date();
                webhook.status = Webhook_1.WebhookStatus.ACTIVE;
                webhook.lastError = undefined;
                if (webhook.consecutiveFailures > 0 || webhook.circuitBreakerOpen) {
                    logger_1.logger.info(`Resetting circuit breaker for webhook ${webhook.id} after successful delivery`);
                    webhook.consecutiveFailures = 0;
                    webhook.circuitBreakerOpen = false;
                    webhook.circuitOpenedAt = undefined;
                }
            }
            else {
                webhook.failedDeliveries++;
                webhook.lastFailureAt = new Date();
                webhook.lastError = result.error;
                webhook.consecutiveFailures++;
                if (webhook.consecutiveFailures >= webhook.circuitBreakerThreshold &&
                    !webhook.circuitBreakerOpen) {
                    logger_1.logger.error(`Circuit breaker opened for webhook ${webhook.id} after ${webhook.consecutiveFailures} consecutive failures`);
                    webhook.circuitBreakerOpen = true;
                    webhook.circuitOpenedAt = new Date();
                    webhook.status = Webhook_1.WebhookStatus.ERROR;
                    if (!webhook.adminNotifiedOfFailure) {
                        await this.notifyAdminsOfCircuitBreakerOpen(webhook);
                    }
                }
            }
            await this.webhookRepository.save(webhook);
        }
        catch (error) {
            logger_1.logger.error('Error recording webhook delivery:', error);
        }
    }
    generateSignature(payload, secret) {
        let normalizedPayload;
        if (typeof payload === 'string') {
            try {
                const parsed = JSON.parse(payload);
                normalizedPayload = JSON.stringify(parsed);
            }
            catch {
                normalizedPayload = payload;
            }
        }
        else {
            normalizedPayload = JSON.stringify(payload);
        }
        return node_crypto_1.default.createHmac('sha256', secret).update(normalizedPayload).digest('hex');
    }
    verifySignature(payload, signature, secret) {
        const expectedSignature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
        if (signature.length !== expectedSignature.length) {
            return false;
        }
        try {
            return node_crypto_1.default.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'));
        }
        catch {
            return false;
        }
    }
    generateSecret() {
        return node_crypto_1.default.randomBytes(32).toString('hex');
    }
    generateDeliveryId() {
        return `del_${Date.now()}_${node_crypto_1.default.randomBytes(8).toString('hex')}`;
    }
    validateWebhookConfig(dto) {
        this.validateWebhookTypeConfig(dto);
        if (!dto.events || dto.events.length === 0) {
            throw new apiErrors_1.ValidationError('At least one event must be selected');
        }
    }
    validateWebhookTypeConfig(dto) {
        if (dto.type === Webhook_1.WebhookType.DISCORD) {
            if (!dto.discordConfig?.webhookUrl) {
                throw new apiErrors_1.ValidationError('Discord webhook URL is required');
            }
            this.validateDiscordConfigUrl(dto.discordConfig);
        }
        else if (dto.type === Webhook_1.WebhookType.CUSTOM) {
            if (!dto.customConfig?.url) {
                throw new apiErrors_1.ValidationError('Custom webhook URL is required');
            }
            this.validateUrlForSSRF(dto.customConfig.url);
        }
    }
    async testWebhookConfig(organizationId, dto) {
        const errors = [];
        const warnings = [];
        try {
            this.validateWebhookConfig(dto);
        }
        catch (error) {
            if (error instanceof Error) {
                errors.push(error.message);
            }
            else {
                errors.push('Invalid webhook configuration');
            }
        }
        if (errors.length > 0) {
            return { valid: false, errors, warnings };
        }
        let testResult;
        try {
            const tempWebhook = {
                id: `temp-${Date.now()}`,
                organizationId,
                type: dto.type,
                discordConfig: dto.discordConfig,
                customConfig: dto.customConfig,
                secret: dto.secret,
                maxRetries: 0,
                timeoutMs: dto.timeoutMs ?? 10000,
                retryDelayMs: 0,
            };
            const testPayload = {
                id: `validation-${Date.now()}`,
                timestamp: new Date().toISOString(),
                event: Webhook_1.WebhookEventType.FLEET_CREATED,
                organizationId,
                data: {
                    test: true,
                    validation: true,
                    message: 'Webhook validation test - you can ignore this message',
                },
                retryCount: 0,
            };
            testResult = await this.deliverWebhook(tempWebhook, testPayload);
            if (!testResult.success) {
                warnings.push(`Webhook test delivery failed: ${testResult.error}`, 'The webhook configuration is valid but the endpoint may not be reachable');
            }
        }
        catch (error) {
            warnings.push(`Could not test webhook endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
            testResult,
        };
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async getStatistics(organizationId) {
        try {
            const webhooks = await this.webhookRepository.find({
                where: { organizationId },
            });
            const totalWebhooks = webhooks.length;
            const activeWebhooks = webhooks.filter(w => w.status === Webhook_1.WebhookStatus.ACTIVE).length;
            const errorWebhooks = webhooks.filter(w => w.status === Webhook_1.WebhookStatus.ERROR).length;
            const totalDeliveries = webhooks.reduce((sum, w) => sum + w.totalDeliveries, 0);
            const successfulDeliveries = webhooks.reduce((sum, w) => sum + w.successfulDeliveries, 0);
            const successRate = totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 100;
            const recentDeliveries = webhooks
                .flatMap(w => w.deliveryHistory)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 50);
            return {
                totalWebhooks,
                activeWebhooks,
                errorWebhooks,
                totalDeliveries,
                successRate,
                recentDeliveries,
            };
        }
        catch (error) {
            logger_1.logger.error('Error getting webhook statistics:', error);
            throw error;
        }
    }
    async testWebhookWithPayload(idOrWebhook, options = {}) {
        try {
            let webhook;
            if (typeof idOrWebhook === 'string') {
                const found = await this.webhookRepository.findOne({ where: { id: idOrWebhook } });
                if (!found) {
                    throw new Error(`Webhook ${idOrWebhook} not found`);
                }
                webhook = found;
            }
            else {
                webhook = idOrWebhook;
                if (!webhook.id) {
                    throw new apiErrors_1.ValidationError('Cannot test webhook without an id. Please save the webhook first.');
                }
            }
            const testPayload = {
                id: `test-custom-${Date.now()}`,
                timestamp: new Date().toISOString(),
                event: options.event || Webhook_1.WebhookEventType.FLEET_CREATED,
                organizationId: webhook.organizationId,
                data: {
                    test: true,
                    message: 'This is a custom test webhook delivery',
                    ...options.data,
                },
                retryCount: 0,
            };
            if (webhook.type === Webhook_1.WebhookType.CUSTOM &&
                webhook.secret &&
                options.includeSignature !== false) {
                testPayload.signature = this.generateSignature(testPayload, webhook.secret);
            }
            const result = await this.deliverWebhook(webhook, testPayload);
            webhook.status = result.success ? Webhook_1.WebhookStatus.ACTIVE : Webhook_1.WebhookStatus.ERROR;
            if (!result.success) {
                webhook.lastError = result.error;
            }
            await this.webhookRepository.save(webhook);
            logger_1.logger.info(`Custom test webhook delivery for ${webhook.id}: ${result.success ? 'success' : 'failed'}`);
            return {
                ...result,
                payload: testPayload,
            };
        }
        catch (error) {
            const webhookId = typeof idOrWebhook === 'string' ? idOrWebhook : idOrWebhook?.id;
            logger_1.logger.error(`Error testing webhook ${webhookId} with custom payload:`, error);
            throw error;
        }
    }
    async getTestPayloadPreview(id, options = {}) {
        try {
            const webhook = await this.webhookRepository.findOne({ where: { id } });
            if (!webhook) {
                throw new Error(`Webhook ${id} not found`);
            }
            const testPayload = {
                id: `preview-${Date.now()}`,
                timestamp: new Date().toISOString(),
                event: options.event || Webhook_1.WebhookEventType.FLEET_CREATED,
                organizationId: webhook.organizationId,
                data: {
                    test: true,
                    message: 'This is a preview payload',
                    ...options.data,
                },
                retryCount: 0,
            };
            if (webhook.type === Webhook_1.WebhookType.CUSTOM && webhook.secret) {
                testPayload.signature = this.generateSignature(testPayload, webhook.secret);
            }
            const headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Event': testPayload.event,
                'X-Webhook-Delivery': testPayload.id,
                'X-Webhook-Timestamp': testPayload.timestamp,
            };
            if (webhook.secret && testPayload.signature) {
                headers['X-Webhook-Signature'] = `sha256=${testPayload.signature}`;
            }
            const result = {
                webhook: {
                    id: webhook.id,
                    name: webhook.name,
                    type: webhook.type,
                    events: webhook.events,
                },
                payload: testPayload,
                headers,
            };
            if (webhook.type === Webhook_1.WebhookType.DISCORD) {
                result.discordMessage = this.formatDiscordMessage(testPayload, webhook);
            }
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Error getting test payload preview for webhook ${id}:`, error);
            throw error;
        }
    }
    batchQueues = new Map();
    batchConfig = {
        maxBatchSize: 10,
        maxWaitTimeMs: 5000,
        enabled: true,
    };
    configureBatching(config) {
        if (config.maxBatchSize !== undefined) {
            this.batchConfig.maxBatchSize = Math.max(1, Math.min(100, config.maxBatchSize));
        }
        if (config.maxWaitTimeMs !== undefined) {
            this.batchConfig.maxWaitTimeMs = Math.max(1000, Math.min(60000, config.maxWaitTimeMs));
        }
        if (config.enabled !== undefined) {
            this.batchConfig.enabled = config.enabled;
        }
        logger_1.logger.info('Webhook batching configured:', this.batchConfig);
    }
    getBatchConfig() {
        return { ...this.batchConfig };
    }
    async queueEventForBatch(organizationId, event, data) {
        if (!this.batchConfig.enabled) {
            const webhooks = await this.webhookRepository
                .createQueryBuilder('webhook')
                .where('webhook.organizationId = :organizationId', { organizationId })
                .andWhere('webhook.enabled = :enabled', { enabled: true })
                .andWhere('webhook.status != :errorStatus', { errorStatus: Webhook_1.WebhookStatus.ERROR })
                .getMany();
            const subscribedWebhookIds = webhooks.filter(w => w.events.includes(event)).map(w => w.id);
            await this.triggerEvent(organizationId, event, data);
            return {
                queued: false,
                webhookIds: subscribedWebhookIds,
            };
        }
        try {
            const webhooks = await this.webhookRepository
                .createQueryBuilder('webhook')
                .where('webhook.organizationId = :organizationId', { organizationId })
                .andWhere('webhook.enabled = :enabled', { enabled: true })
                .andWhere('webhook.status != :errorStatus', { errorStatus: Webhook_1.WebhookStatus.ERROR })
                .getMany();
            const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));
            if (subscribedWebhooks.length === 0) {
                return { queued: false, webhookIds: [] };
            }
            const webhookIds = [];
            for (const webhook of subscribedWebhooks) {
                this.addToBatchQueue(organizationId, webhook.id, event, data);
                webhookIds.push(webhook.id);
            }
            logger_1.logger.debug(`Queued event ${event} for ${webhookIds.length} webhooks in org ${organizationId}`);
            return { queued: true, webhookIds };
        }
        catch (error) {
            logger_1.logger.error(`Error queuing event for batch:`, error);
            throw error;
        }
    }
    addToBatchQueue(organizationId, webhookId, event, data) {
        if (!this.batchQueues.has(organizationId)) {
            this.batchQueues.set(organizationId, []);
        }
        const orgQueue = this.batchQueues.get(organizationId);
        let webhookQueue = orgQueue.find(q => q.webhookId === webhookId);
        if (!webhookQueue) {
            webhookQueue = {
                webhookId,
                events: [],
            };
            orgQueue.push(webhookQueue);
        }
        webhookQueue.events.push({
            event,
            data,
            timestamp: new Date().toISOString(),
        });
        if (webhookQueue.events.length === 1) {
            webhookQueue.timer = setTimeout(() => {
                this.flushBatch(organizationId, webhookId).catch(err => {
                    logger_1.logger.error(`Error flushing batch for webhook ${webhookId}:`, err);
                });
            }, this.batchConfig.maxWaitTimeMs);
        }
        if (webhookQueue.events.length >= this.batchConfig.maxBatchSize) {
            if (webhookQueue.timer) {
                clearTimeout(webhookQueue.timer);
                webhookQueue.timer = undefined;
            }
            this.flushBatch(organizationId, webhookId).catch(err => {
                logger_1.logger.error(`Error flushing full batch for webhook ${webhookId}:`, err);
            });
        }
    }
    async flushBatch(organizationId, webhookId) {
        const orgQueue = this.batchQueues.get(organizationId);
        if (!orgQueue) {
            return null;
        }
        const queueIndex = orgQueue.findIndex(q => q.webhookId === webhookId);
        if (queueIndex === -1) {
            return null;
        }
        const webhookQueue = orgQueue[queueIndex];
        const events = [...webhookQueue.events];
        webhookQueue.events = [];
        if (webhookQueue.timer) {
            clearTimeout(webhookQueue.timer);
            webhookQueue.timer = undefined;
        }
        orgQueue.splice(queueIndex, 1);
        if (orgQueue.length === 0) {
            this.batchQueues.delete(organizationId);
        }
        if (events.length === 0) {
            return null;
        }
        try {
            const webhook = await this.webhookRepository.findOne({ where: { id: webhookId } });
            if (!webhook?.enabled) {
                return null;
            }
            const batchPayload = {
                id: this.generateDeliveryId(),
                timestamp: new Date().toISOString(),
                event: Webhook_1.WebhookEventType.BATCH,
                organizationId,
                data: {
                    batch: true,
                    eventCount: events.length,
                    events: events.map(e => ({
                        event: e.event,
                        data: e.data,
                        timestamp: e.timestamp,
                    })),
                },
                retryCount: 0,
            };
            if (webhook.type === Webhook_1.WebhookType.CUSTOM && webhook.secret) {
                batchPayload.signature = this.generateSignature(batchPayload, webhook.secret);
            }
            logger_1.logger.info(`Delivering batched webhook for ${webhookId} with ${events.length} events`);
            return await this.deliverWithRetry(webhook, batchPayload);
        }
        catch (error) {
            logger_1.logger.error(`Error flushing batch for webhook ${webhookId}:`, error);
            throw error;
        }
    }
    async flushAllBatches(organizationId) {
        const orgQueue = this.batchQueues.get(organizationId);
        if (!orgQueue || orgQueue.length === 0) {
            return { flushed: 0, results: [] };
        }
        const webhookIds = orgQueue.map(q => q.webhookId);
        const results = [];
        for (const webhookId of webhookIds) {
            const result = await this.flushBatch(organizationId, webhookId);
            if (result) {
                results.push(result);
            }
        }
        logger_1.logger.info(`Flushed ${results.length} batches for org ${organizationId}`);
        return { flushed: results.length, results };
    }
    getPendingBatches(organizationId) {
        const orgQueue = this.batchQueues.get(organizationId);
        if (!orgQueue) {
            return [];
        }
        return orgQueue.map(q => ({
            webhookId: q.webhookId,
            eventCount: q.events.length,
            events: q.events.map(e => ({
                event: e.event,
                timestamp: e.timestamp,
            })),
        }));
    }
    cancelPendingBatches(organizationId, webhookId) {
        const orgQueue = this.batchQueues.get(organizationId);
        if (!orgQueue) {
            return 0;
        }
        let cancelled = 0;
        if (webhookId) {
            const queueIndex = orgQueue.findIndex(q => q.webhookId === webhookId);
            if (queueIndex !== -1) {
                const queue = orgQueue[queueIndex];
                cancelled = queue.events.length;
                if (queue.timer) {
                    clearTimeout(queue.timer);
                }
                orgQueue.splice(queueIndex, 1);
            }
        }
        else {
            for (const queue of orgQueue) {
                cancelled += queue.events.length;
                if (queue.timer) {
                    clearTimeout(queue.timer);
                }
            }
            this.batchQueues.delete(organizationId);
        }
        if (cancelled > 0) {
            logger_1.logger.info(`Cancelled ${cancelled} pending events for org ${organizationId}${webhookId ? ` webhook ${webhookId}` : ''}`);
        }
        return cancelled;
    }
    async notifyAdminsOfCircuitBreakerOpen(webhook) {
        webhook.adminNotifiedOfFailure = true;
        webhook.adminNotifiedAt = new Date();
        await this.webhookRepository.save(webhook);
        logger_1.logger.error('ADMIN ALERT: Webhook circuit breaker opened', {
            webhookId: webhook.id,
            webhookName: webhook.name,
            organizationId: webhook.organizationId,
            consecutiveFailures: webhook.consecutiveFailures,
            circuitBreakerThreshold: webhook.circuitBreakerThreshold,
            lastError: webhook.lastError,
            lastFailureAt: webhook.lastFailureAt,
        });
        try {
            await NotificationDispatcher_1.notificationDispatcher.notifyPlatformAdmins('Webhook circuit breaker opened', `Webhook "${webhook.name}" (org ${webhook.organizationId}) opened its circuit breaker after ${webhook.consecutiveFailures} consecutive failures. Last error: ${webhook.lastError ?? 'unknown'}`, {
                data: {
                    webhookId: webhook.id,
                    webhookName: webhook.name,
                    organizationId: webhook.organizationId,
                    consecutiveFailures: webhook.consecutiveFailures,
                    circuitBreakerThreshold: webhook.circuitBreakerThreshold,
                    lastError: webhook.lastError,
                    lastFailureAt: webhook.lastFailureAt,
                },
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to dispatch webhook circuit-breaker admin alert', { error: err });
        }
    }
    async resetCircuitBreaker(webhookId) {
        const webhook = await this.getWebhookById(webhookId);
        if (!webhook) {
            throw new Error(`Webhook not found: ${webhookId}`);
        }
        if (!webhook.circuitBreakerOpen) {
            logger_1.logger.warn(`Circuit breaker for webhook ${webhookId} is not open - nothing to reset`);
            return webhook;
        }
        webhook.circuitBreakerOpen = false;
        webhook.circuitOpenedAt = undefined;
        webhook.consecutiveFailures = 0;
        webhook.adminNotifiedOfFailure = false;
        webhook.adminNotifiedAt = undefined;
        webhook.status = Webhook_1.WebhookStatus.ACTIVE;
        await this.webhookRepository.save(webhook);
        logger_1.logger.info(`Circuit breaker manually reset for webhook ${webhookId}`);
        return webhook;
    }
    async getWebhooksWithOpenCircuitBreakers() {
        return this.webhookRepository.find({
            where: { circuitBreakerOpen: true },
            order: { circuitOpenedAt: 'DESC' },
        });
    }
    async getCircuitBreakerStats(organizationId) {
        const webhooks = await this.getWebhooksByOrganization(organizationId);
        return {
            total: webhooks.length,
            active: webhooks.filter(w => w.enabled && !w.circuitBreakerOpen).length,
            circuitOpen: webhooks.filter(w => w.circuitBreakerOpen).length,
            recentFailures: webhooks.filter(w => w.consecutiveFailures > 0).length,
        };
    }
}
exports.WebhookService = WebhookService;
//# sourceMappingURL=WebhookService.js.map