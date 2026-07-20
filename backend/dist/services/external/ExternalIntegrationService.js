"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalIntegrationService = void 0;
const axios_1 = __importDefault(require("axios"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const ExternalIntegration_1 = require("../../models/ExternalIntegration");
const FleetInventory_1 = require("../../models/FleetInventory");
const apiErrors_1 = require("../../utils/apiErrors");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const urlValidator_1 = require("../../utils/urlValidator");
class ExternalIntegrationService {
    integrationRepository;
    inventoryRepository;
    axiosInstances = new Map();
    constructor(integrationRepository, inventoryRepository) {
        this.integrationRepository =
            integrationRepository || data_source_1.AppDataSource.getRepository(ExternalIntegration_1.ExternalIntegration);
        this.inventoryRepository = inventoryRepository || data_source_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory);
    }
    async createIntegration(dto) {
        try {
            if (dto.apiConfig?.baseUrl) {
                this.validateUrlForSSRF(dto.apiConfig.baseUrl);
            }
            if (dto.webhookConfig?.url) {
                this.validateUrlForSSRF(dto.webhookConfig.url);
            }
            this.validateStarCommsConfig(dto.type, dto.starCommsConfig?.baseUrl);
            const nextSyncAt = dto.autoSync && dto.syncIntervalMinutes
                ? new Date(Date.now() + dto.syncIntervalMinutes * 60000)
                : undefined;
            const integration = this.integrationRepository.create({
                ...dto,
                status: ExternalIntegration_1.IntegrationStatus.PENDING,
                nextSyncAt,
                syncHistory: [],
                totalSyncs: 0,
                successfulSyncs: 0,
                failedSyncs: 0,
                enabled: true,
            });
            const savedIntegration = await this.integrationRepository.save(integration);
            logger_1.logger.info(`Created external integration: ${savedIntegration.id} - ${savedIntegration.name}`);
            await this.testConnection(savedIntegration.id);
            return savedIntegration;
        }
        catch (error) {
            logger_1.logger.error('Error creating external integration:', error);
            throw error;
        }
    }
    async getIntegrationById(id) {
        try {
            return await this.integrationRepository.findOne({ where: { id } });
        }
        catch (error) {
            logger_1.logger.error(`Error getting integration ${id}:`, error);
            throw error;
        }
    }
    async getIntegrations(fleetId) {
        try {
            return await this.integrationRepository.find({
                where: { fleetId },
                order: { createdAt: 'DESC' },
            });
        }
        catch (error) {
            logger_1.logger.error('Error getting integrations:', error);
            throw error;
        }
    }
    async updateIntegration(id, dto) {
        try {
            const integration = await this.integrationRepository.findOne({ where: { id } });
            if (!integration) {
                throw new Error(`Integration ${id} not found`);
            }
            if (dto.apiConfig?.baseUrl) {
                this.validateUrlForSSRF(dto.apiConfig.baseUrl);
            }
            if (dto.webhookConfig?.url) {
                this.validateUrlForSSRF(dto.webhookConfig.url);
            }
            this.validateStarCommsConfig(integration.type, dto.starCommsConfig?.baseUrl);
            Object.assign(integration, dto);
            if (dto.autoSync !== undefined || dto.syncIntervalMinutes !== undefined) {
                if (integration.autoSync && integration.syncIntervalMinutes) {
                    integration.nextSyncAt = new Date(Date.now() + integration.syncIntervalMinutes * 60000);
                }
                else {
                    integration.nextSyncAt = undefined;
                }
            }
            const updatedIntegration = await this.integrationRepository.save(integration);
            logger_1.logger.info(`Updated integration: ${id}`);
            this.axiosInstances.delete(id);
            return updatedIntegration;
        }
        catch (error) {
            logger_1.logger.error(`Error updating integration ${id}:`, error);
            throw error;
        }
    }
    async deleteIntegration(id) {
        try {
            const result = await this.integrationRepository.delete(id);
            if (result.affected === 0) {
                throw new Error(`Integration ${id} not found`);
            }
            this.axiosInstances.delete(id);
            logger_1.logger.info(`Deleted integration: ${id}`);
        }
        catch (error) {
            logger_1.logger.error(`Error deleting integration ${id}:`, error);
            throw error;
        }
    }
    async testConnection(id) {
        const startTime = Date.now();
        try {
            const integration = await this.integrationRepository.findOne({ where: { id } });
            if (!integration) {
                throw new Error(`Integration ${id} not found`);
            }
            const client = this.getAxiosClient();
            const requestConfig = this.buildAxiosRequestConfig(integration);
            if (integration.apiConfig) {
                const testEndpoint = integration.apiConfig.endpoints.getInventory || integration.apiConfig.baseUrl;
                const safeUrl = this.resolveExternalUrl(integration, testEndpoint);
                await client.get(safeUrl, requestConfig);
            }
            else if (integration.webhookConfig) {
                const safeUrl = this.resolveExternalUrl(integration, integration.webhookConfig.url);
                await client.request({
                    url: safeUrl,
                    method: integration.webhookConfig.method || 'POST',
                    data: { test: true },
                    headers: requestConfig.headers,
                    auth: requestConfig.auth,
                    timeout: requestConfig.timeout,
                });
            }
            integration.status = ExternalIntegration_1.IntegrationStatus.ACTIVE;
            integration.errorMessage = undefined;
            integration.lastErrorAt = undefined;
            await this.integrationRepository.save(integration);
            logger_1.logger.info(`Connection test successful for integration: ${id}`);
            return { success: true, responseTime: Date.now() - startTime };
        }
        catch (error) {
            logger_1.logger.error(`Connection test failed for integration ${id}:`, error);
            const integration = await this.integrationRepository.findOne({ where: { id } });
            if (integration) {
                integration.status = ExternalIntegration_1.IntegrationStatus.ERROR;
                integration.errorMessage = (0, errorHandler_1.getErrorMessage)(error);
                integration.lastErrorAt = new Date();
                await this.integrationRepository.save(integration);
            }
            return { success: false, error: (0, errorHandler_1.getErrorMessage)(error) };
        }
    }
    async syncInventory(request) {
        const startTime = Date.now();
        const result = {
            success: false,
            itemsSynced: 0,
            errors: [],
            duration: 0,
            changes: {
                created: 0,
                updated: 0,
                deleted: 0,
            },
        };
        try {
            const integration = await this.integrationRepository.findOne({
                where: { id: request.integrationId },
            });
            if (!integration) {
                throw new Error(`Integration ${request.integrationId} not found`);
            }
            if (!integration.enabled) {
                throw new Error('Integration is disabled');
            }
            const client = this.getAxiosClient();
            let externalData = [];
            if (integration.syncDirection === ExternalIntegration_1.SyncDirection.INBOUND ||
                integration.syncDirection === ExternalIntegration_1.SyncDirection.BIDIRECTIONAL) {
                externalData = await this.fetchExternalInventory(integration, client, request.categories);
            }
            for (const externalItem of externalData) {
                try {
                    const mappedItem = this.mapExternalToInternal(externalItem, integration);
                    if (request.dryRun) {
                        result.itemsSynced++;
                        continue;
                    }
                    const existing = await this.inventoryRepository.findOne({
                        where: {
                            fleetId: integration.fleetId,
                            itemName: mappedItem.itemName,
                        },
                    });
                    if (existing) {
                        Object.assign(existing, mappedItem);
                        await this.inventoryRepository.save(existing);
                        result.changes.updated++;
                    }
                    else {
                        const newItem = this.inventoryRepository.create(mappedItem);
                        await this.inventoryRepository.save(newItem);
                        result.changes.created++;
                    }
                    result.itemsSynced++;
                }
                catch (itemError) {
                    result.errors.push(`Error syncing item: ${(0, errorHandler_1.getErrorMessage)(itemError)}`);
                    logger_1.logger.error('Error syncing item:', itemError);
                }
            }
            if (integration.syncDirection === ExternalIntegration_1.SyncDirection.BIDIRECTIONAL ||
                integration.syncDirection === ExternalIntegration_1.SyncDirection.OUTBOUND) {
                if (!request.dryRun) {
                    await this.pushInventoryToExternal(integration, client, request.categories);
                }
            }
            integration.lastSyncAt = new Date();
            integration.totalSyncs++;
            integration.successfulSyncs++;
            integration.status = ExternalIntegration_1.IntegrationStatus.ACTIVE;
            integration.errorMessage = undefined;
            if (integration.autoSync && integration.syncIntervalMinutes) {
                integration.nextSyncAt = new Date(Date.now() + integration.syncIntervalMinutes * 60000);
            }
            const syncLog = {
                timestamp: new Date(),
                status: result.errors.length > 0 ? 'partial' : 'success',
                itemsSynced: result.itemsSynced,
                errors: result.errors.length > 0 ? result.errors : undefined,
                duration: Date.now() - startTime,
            };
            integration.syncHistory = [
                syncLog,
                ...(integration.syncHistory || []).slice(0, 49),
            ];
            await this.integrationRepository.save(integration);
            result.success = true;
            result.duration = Date.now() - startTime;
            logger_1.logger.info(`Sync completed for integration ${integration.id}: ${result.itemsSynced} items synced`);
            return result;
        }
        catch (error) {
            logger_1.logger.error(`Sync failed for integration ${request.integrationId}:`, error);
            result.errors.push((0, errorHandler_1.getErrorMessage)(error));
            result.duration = Date.now() - startTime;
            const integration = await this.integrationRepository.findOne({
                where: { id: request.integrationId },
            });
            if (integration) {
                integration.failedSyncs++;
                integration.totalSyncs++;
                integration.status = ExternalIntegration_1.IntegrationStatus.ERROR;
                integration.errorMessage = (0, errorHandler_1.getErrorMessage)(error);
                integration.lastErrorAt = new Date();
                const syncLog = {
                    timestamp: new Date(),
                    status: 'error',
                    itemsSynced: 0,
                    errors: [(0, errorHandler_1.getErrorMessage)(error)],
                    duration: Date.now() - startTime,
                };
                integration.syncHistory = [syncLog, ...(integration.syncHistory || []).slice(0, 49)];
                await this.integrationRepository.save(integration);
            }
            return result;
        }
    }
    async processAutoSyncs() {
        let syncedCount = 0;
        let failedCount = 0;
        const results = [];
        try {
            const now = new Date();
            const integrations = await this.integrationRepository.find({
                where: {
                    enabled: true,
                    autoSync: true,
                },
            });
            for (const integration of integrations) {
                if (integration.nextSyncAt && integration.nextSyncAt <= now) {
                    logger_1.logger.info(`Running auto-sync for integration: ${integration.id}`);
                    try {
                        const result = await this.syncInventory({
                            integrationId: integration.id,
                        });
                        if (result.success) {
                            syncedCount++;
                        }
                        else {
                            failedCount++;
                        }
                        results.push({ integrationId: integration.id, result });
                    }
                    catch (error) {
                        failedCount++;
                        results.push({ integrationId: integration.id, error: (0, errorHandler_1.getErrorMessage)(error) });
                        logger_1.logger.error(`Auto-sync failed for integration ${integration.id}:`, error);
                    }
                }
            }
            return { syncedCount, failedCount, results };
        }
        catch (error) {
            logger_1.logger.error('Error processing auto-syncs:', error);
            return { syncedCount, failedCount, results };
        }
    }
    async sendWebhook(integrationId, data) {
        try {
            const integration = await this.integrationRepository.findOne({
                where: { id: integrationId },
            });
            if (!integration?.webhookConfig) {
                throw new Error('Integration or webhook config not found');
            }
            const { url, method = 'POST', headers = {}, events = [] } = integration.webhookConfig;
            const client = this.getAxiosClient();
            const requestConfig = this.buildAxiosRequestConfig(integration);
            const safeUrl = this.resolveExternalUrl(integration, url);
            const requestHeaders = { ...requestConfig.headers, ...headers };
            const response = await client.request({
                url: safeUrl,
                method,
                headers: requestHeaders,
                auth: requestConfig.auth,
                timeout: requestConfig.timeout,
                data: {
                    events,
                    timestamp: new Date().toISOString(),
                    fleetId: integration.fleetId,
                    data,
                },
            });
            logger_1.logger.info(`Webhook sent for integration ${integrationId} with ${events.length} events`);
            return { success: true, statusCode: response.status };
        }
        catch (error) {
            logger_1.logger.error(`Error sending webhook for integration ${integrationId}:`, error);
            return { success: false, error: (0, errorHandler_1.getErrorMessage)(error) };
        }
    }
    resolveExternalUrl(integration, endpoint) {
        const baseUrl = integration.apiConfig?.baseUrl;
        const isAbsolute = /^https?:\/\//i.test(endpoint);
        if (!isAbsolute && !baseUrl) {
            throw new Error('Integration baseUrl is required for relative endpoints');
        }
        const resolved = isAbsolute ? endpoint : new URL(endpoint, baseUrl).toString();
        const allowedHosts = (process.env.EXTERNAL_INTEGRATION_ALLOWED_HOSTS || '')
            .split(',')
            .map(host => host.trim())
            .filter(Boolean);
        const validated = (0, urlValidator_1.validateExternalIntegrationUrl)(resolved, allowedHosts.length > 0 ? allowedHosts : undefined);
        return validated.toString();
    }
    validateUrlForSSRF(url) {
        try {
            const allowedHosts = (process.env.EXTERNAL_INTEGRATION_ALLOWED_HOSTS || '')
                .split(',')
                .map(host => host.trim())
                .filter(Boolean);
            (0, urlValidator_1.validateExternalIntegrationUrl)(url, allowedHosts.length > 0 ? allowedHosts : undefined);
        }
        catch (error) {
            if ((0, errorHandler_1.getErrorMessage)(error).includes('Invalid URL')) {
                throw new Error('Invalid URL format');
            }
            throw error;
        }
    }
    validateStarCommsConfig(type, starCommsBaseUrl) {
        if (type !== ExternalIntegration_1.IntegrationType.STARCOMMS) {
            return;
        }
        if (!starCommsBaseUrl) {
            throw new apiErrors_1.ValidationError('StarComms integrations require starCommsConfig.baseUrl');
        }
        this.validateUrlForSSRF(starCommsBaseUrl);
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
    buildAxiosRequestConfig(integration) {
        const requestConfig = {
            timeout: 30000,
            headers: {},
        };
        if (integration.authConfig) {
            switch (integration.authConfig.type) {
                case 'basic':
                    requestConfig.auth = {
                        username: integration.authConfig.username || '',
                        password: integration.authConfig.password || '',
                    };
                    break;
                case 'bearer':
                    requestConfig.headers.Authorization = `Bearer ${integration.authConfig.token}`;
                    break;
                case 'apiKey': {
                    const header = integration.authConfig.apiKeyHeader || 'X-API-Key';
                    requestConfig.headers[header] = integration.authConfig.apiKey || '';
                    break;
                }
            }
        }
        return requestConfig;
    }
    async fetchExternalInventory(integration, client, categories) {
        if (!integration.apiConfig?.endpoints.getInventory) {
            throw new Error('Get inventory endpoint not configured');
        }
        let url = this.resolveExternalUrl(integration, integration.apiConfig.endpoints.getInventory);
        if (categories && categories.length > 0) {
            const params = new URLSearchParams();
            categories.forEach(cat => params.append('category', cat));
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}${params.toString()}`;
            this.validateUrlForSSRF(url);
        }
        const response = await client.get(url, this.buildAxiosRequestConfig(integration));
        const normalizeUnknownArray = (value) => {
            if (!Array.isArray(value)) {
                return [];
            }
            const normalized = [];
            for (const item of value) {
                normalized.push(item);
            }
            return normalized;
        };
        const responseData = response.data;
        const directItems = normalizeUnknownArray(responseData);
        if (Array.isArray(responseData)) {
            return directItems;
        }
        if (typeof responseData === 'object' && responseData !== null && 'items' in responseData) {
            return normalizeUnknownArray(responseData.items);
        }
        return directItems;
    }
    async pushInventoryToExternal(integration, client, categories) {
        if (!integration.apiConfig?.endpoints.syncInventory) {
            throw new Error('Sync inventory endpoint not configured');
        }
        const whereConditions = { fleetId: integration.fleetId };
        if (categories && categories.length > 0) {
            whereConditions.category = (0, typeorm_1.In)(categories);
        }
        const items = await this.inventoryRepository.find({ where: whereConditions });
        const externalData = items.map(item => this.mapInternalToExternal(item, integration));
        const url = this.resolveExternalUrl(integration, integration.apiConfig.endpoints.syncInventory);
        await client.post(url, {
            items: externalData,
        }, this.buildAxiosRequestConfig(integration));
    }
    mapExternalToInternal(externalItem, integration) {
        const mapped = {
            fleetId: integration.fleetId,
        };
        (integration.fieldMappings || []).forEach(mapping => {
            let value = this.getNestedValue(externalItem, mapping.sourceField);
            if (mapping.transform) {
                try {
                    value = this.safelyTransformValue(value, mapping.transform);
                }
                catch (error) {
                    logger_1.logger.error('Error applying transform:', error);
                }
            }
            if (value === undefined && mapping.default !== undefined) {
                value = mapping.default;
            }
            this.setNestedValue(mapped, mapping.targetField, value);
        });
        return mapped;
    }
    safelyTransformValue(value, transformCode) {
        const safeTransforms = {
            toLowerCase: (val) => (typeof val === 'string' ? val.toLowerCase() : val),
            toUpperCase: (val) => (typeof val === 'string' ? val.toUpperCase() : val),
            trim: (val) => (typeof val === 'string' ? val.trim() : val),
            parseInt: (val) => parseInt(String(val), 10),
            parseFloat: (val) => parseFloat(String(val)),
            toString: (val) => String(val),
            toNumber: (val) => Number(val),
            toBoolean: (val) => Boolean(val),
            'return value': (val) => val,
            'value.toLowerCase()': (val) => (typeof val === 'string' ? val.toLowerCase() : val),
            'value.toUpperCase()': (val) => (typeof val === 'string' ? val.toUpperCase() : val),
            'value.trim()': (val) => (typeof val === 'string' ? val.trim() : val),
            'parseInt(value)': (val) => parseInt(String(val), 10),
            'parseFloat(value)': (val) => parseFloat(String(val)),
            'String(value)': (val) => String(val),
            'Number(value)': (val) => Number(val),
            'Boolean(value)': (val) => Boolean(val),
        };
        const normalizedTransform = transformCode.trim();
        if (safeTransforms[normalizedTransform]) {
            return safeTransforms[normalizedTransform](value);
        }
        logger_1.logger.warn(`Unsafe or unknown transform attempted: ${transformCode}. Returning original value.`);
        return value;
    }
    mapInternalToExternal(item, integration) {
        const mapped = {};
        integration.fieldMappings.forEach(mapping => {
            const value = this.getNestedValue(item, mapping.targetField);
            this.setNestedValue(mapped, mapping.sourceField, value);
        });
        return mapped;
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            if (current && typeof current === 'object' && key in current) {
                return current[key];
            }
            return undefined;
        }, obj);
    }
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }
}
exports.ExternalIntegrationService = ExternalIntegrationService;
//# sourceMappingURL=ExternalIntegrationService.js.map