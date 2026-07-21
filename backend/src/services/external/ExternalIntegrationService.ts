import axios, { AxiosInstance } from 'axios';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  CreateIntegrationDto,
  ExternalIntegration,
  IntegrationStatus,
  IntegrationType,
  SyncDirection,
  SyncRequest,
  SyncResult,
  UpdateIntegrationDto,
} from '../../models/ExternalIntegration';
import { CreateInventoryItemDto, FleetInventory } from '../../models/FleetInventory';
import { ValidationError } from '../../utils/apiErrors';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { validateExternalIntegrationUrl } from '../../utils/urlValidator';

/**
 * Service for managing external integrations
 * Handles syncing with external inventory systems via webhooks and APIs
 */
export class ExternalIntegrationService {
  private integrationRepository: Repository<ExternalIntegration>;
  private inventoryRepository: Repository<FleetInventory>;
  private axiosInstances: Map<string, AxiosInstance> = new Map();

  constructor(
    integrationRepository?: Repository<ExternalIntegration>,
    inventoryRepository?: Repository<FleetInventory>
  ) {
    this.integrationRepository =
      integrationRepository || AppDataSource.getRepository(ExternalIntegration);
    this.inventoryRepository = inventoryRepository || AppDataSource.getRepository(FleetInventory);
  }

  /**
   * Create a new external integration
   */
  public async createIntegration(dto: CreateIntegrationDto): Promise<ExternalIntegration> {
    try {
      // Validate URLs for SSRF protection before storing in database
      if (dto.apiConfig?.baseUrl) {
        this.validateUrlForSSRF(dto.apiConfig.baseUrl);
      }
      if (dto.webhookConfig?.url) {
        this.validateUrlForSSRF(dto.webhookConfig.url);
      }
      this.validateStarCommsConfig(dto.type, dto.starCommsConfig?.baseUrl);

      // Calculate next sync time if auto-sync is enabled
      const nextSyncAt =
        dto.autoSync && dto.syncIntervalMinutes
          ? new Date(Date.now() + dto.syncIntervalMinutes * 60000)
          : undefined;

      const integration = this.integrationRepository.create({
        ...dto,
        status: IntegrationStatus.PENDING,
        nextSyncAt,
        syncHistory: [],
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        enabled: true,
      });

      const savedIntegration = await this.integrationRepository.save(integration);
      logger.info(
        `Created external integration: ${savedIntegration.id} - ${savedIntegration.name}`
      );

      // Test connection
      await this.testConnection(savedIntegration.id);

      return savedIntegration;
    } catch (error: unknown) {
      logger.error('Error creating external integration:', error);
      throw error;
    }
  }

  /**
   * Get integration by ID
   */
  public async getIntegrationById(id: string): Promise<ExternalIntegration | null> {
    try {
      return await this.integrationRepository.findOne({ where: { id } });
    } catch (error: unknown) {
      logger.error(`Error getting integration ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all integrations for a fleet
   */
  public async getIntegrations(fleetId: string): Promise<ExternalIntegration[]> {
    try {
      return await this.integrationRepository.find({
        where: { fleetId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error('Error getting integrations:', error);
      throw error;
    }
  }

  /**
   * Update integration
   */
  public async updateIntegration(
    id: string,
    dto: UpdateIntegrationDto
  ): Promise<ExternalIntegration> {
    try {
      const integration = await this.integrationRepository.findOne({ where: { id } });

      if (!integration) {
        throw new Error(`Integration ${id} not found`);
      }

      // Validate URLs for SSRF protection if they are being updated
      if (dto.apiConfig?.baseUrl) {
        this.validateUrlForSSRF(dto.apiConfig.baseUrl);
      }
      if (dto.webhookConfig?.url) {
        this.validateUrlForSSRF(dto.webhookConfig.url);
      }
      this.validateStarCommsConfig(integration.type, dto.starCommsConfig?.baseUrl);

      Object.assign(integration, dto);

      // Update next sync time if auto-sync settings changed
      if (dto.autoSync !== undefined || dto.syncIntervalMinutes !== undefined) {
        if (integration.autoSync && integration.syncIntervalMinutes) {
          integration.nextSyncAt = new Date(Date.now() + integration.syncIntervalMinutes * 60000);
        } else {
          integration.nextSyncAt = undefined;
        }
      }

      const updatedIntegration = await this.integrationRepository.save(integration);
      logger.info(`Updated integration: ${id}`);

      // Clear cached axios instance
      this.axiosInstances.delete(id);

      return updatedIntegration;
    } catch (error: unknown) {
      logger.error(`Error updating integration ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete integration
   */
  public async deleteIntegration(id: string): Promise<void> {
    try {
      const result = await this.integrationRepository.delete(id);
      if (result.affected === 0) {
        throw new Error(`Integration ${id} not found`);
      }
      this.axiosInstances.delete(id);
      logger.info(`Deleted integration: ${id}`);
    } catch (error: unknown) {
      logger.error(`Error deleting integration ${id}:`, error);
      throw error;
    }
  }

  /**
   * Test connection to external system
   */
  public async testConnection(
    id: string
  ): Promise<{ success: boolean; responseTime?: number; error?: string }> {
    const startTime = Date.now();
    try {
      const integration = await this.integrationRepository.findOne({ where: { id } });

      if (!integration) {
        throw new Error(`Integration ${id} not found`);
      }

      const client = this.getAxiosClient();
      const requestConfig = this.buildAxiosRequestConfig(integration);

      // Attempt a test request
      if (integration.apiConfig) {
        const testEndpoint =
          integration.apiConfig.endpoints.getInventory || integration.apiConfig.baseUrl;
        const safeUrl = this.resolveExternalUrl(integration, testEndpoint);
        await client.get(safeUrl, requestConfig);
      } else if (integration.webhookConfig) {
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

      // Update status to active
      integration.status = IntegrationStatus.ACTIVE;
      integration.errorMessage = undefined;
      integration.lastErrorAt = undefined;
      await this.integrationRepository.save(integration);

      logger.info(`Connection test successful for integration: ${id}`);
      return { success: true, responseTime: Date.now() - startTime };
    } catch (error: unknown) {
      logger.error(`Connection test failed for integration ${id}:`, error);

      // Update status to error
      const integration = await this.integrationRepository.findOne({ where: { id } });
      if (integration) {
        integration.status = IntegrationStatus.ERROR;
        integration.errorMessage = getErrorMessage(error);
        integration.lastErrorAt = new Date();
        await this.integrationRepository.save(integration);
      }

      return { success: false, error: getErrorMessage(error) };
    }
  }

  /**
   * Sync inventory with external system
   */
  public async syncInventory(request: SyncRequest): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
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

      // Fetch data from external system
      let externalData: unknown[] = [];

      if (
        integration.syncDirection === SyncDirection.INBOUND ||
        integration.syncDirection === SyncDirection.BIDIRECTIONAL
      ) {
        externalData = await this.fetchExternalInventory(integration, client, request.categories);
      }

      // Process each item
      for (const externalItem of externalData) {
        try {
          const mappedItem = this.mapExternalToInternal(externalItem, integration);

          if (request.dryRun) {
            // Dry run - just count what would be synced
            result.itemsSynced++;
            continue;
          }

          // Check if item already exists
          const existing = await this.inventoryRepository.findOne({
            where: {
              fleetId: integration.fleetId,
              itemName: mappedItem.itemName,
            },
          });

          if (existing) {
            // Update existing item
            Object.assign(existing, mappedItem);
            await this.inventoryRepository.save(existing);
            result.changes.updated++;
          } else {
            // Create new item
            const newItem = this.inventoryRepository.create(mappedItem);
            await this.inventoryRepository.save(newItem);
            result.changes.created++;
          }

          result.itemsSynced++;
        } catch (itemError: unknown) {
          result.errors.push(`Error syncing item: ${getErrorMessage(itemError)}`);
          logger.error('Error syncing item:', itemError);
        }
      }

      // If bidirectional, also push our data to external system
      if (
        integration.syncDirection === SyncDirection.BIDIRECTIONAL ||
        integration.syncDirection === SyncDirection.OUTBOUND
      ) {
        if (!request.dryRun) {
          await this.pushInventoryToExternal(integration, client, request.categories);
        }
      }

      // Update integration stats
      integration.lastSyncAt = new Date();
      integration.totalSyncs++;
      integration.successfulSyncs++;
      integration.status = IntegrationStatus.ACTIVE;
      integration.errorMessage = undefined;

      // Calculate next sync time
      if (integration.autoSync && integration.syncIntervalMinutes) {
        integration.nextSyncAt = new Date(Date.now() + integration.syncIntervalMinutes * 60000);
      }

      // Add to sync history
      const syncLog = {
        timestamp: new Date(),
        status: result.errors.length > 0 ? ('partial' as const) : ('success' as const),
        itemsSynced: result.itemsSynced,
        errors: result.errors.length > 0 ? result.errors : undefined,
        duration: Date.now() - startTime,
      };

      integration.syncHistory = [
        syncLog,
        ...(integration.syncHistory || []).slice(0, 49), // Keep last 50 syncs
      ];

      await this.integrationRepository.save(integration);

      result.success = true;
      result.duration = Date.now() - startTime;

      logger.info(
        `Sync completed for integration ${integration.id}: ${result.itemsSynced} items synced`
      );

      return result;
    } catch (error: unknown) {
      logger.error(`Sync failed for integration ${request.integrationId}:`, error);

      result.errors.push(getErrorMessage(error));
      result.duration = Date.now() - startTime;

      // Update integration error status
      const integration = await this.integrationRepository.findOne({
        where: { id: request.integrationId },
      });

      if (integration) {
        integration.failedSyncs++;
        integration.totalSyncs++;
        integration.status = IntegrationStatus.ERROR;
        integration.errorMessage = getErrorMessage(error);
        integration.lastErrorAt = new Date();

        const syncLog = {
          timestamp: new Date(),
          status: 'error' as const,
          itemsSynced: 0,
          errors: [getErrorMessage(error)],
          duration: Date.now() - startTime,
        };

        integration.syncHistory = [syncLog, ...(integration.syncHistory || []).slice(0, 49)];

        await this.integrationRepository.save(integration);
      }

      return result;
    }
  }

  /**
   * Process automatic syncs for all enabled integrations
   */
  public async processAutoSyncs(): Promise<{
    syncedCount: number;
    failedCount: number;
    results: Array<{ integrationId: string; result?: SyncResult; error?: string }>;
  }> {
    let syncedCount = 0;
    let failedCount = 0;
    const results: Array<{ integrationId: string; result?: SyncResult; error?: string }> = [];

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
          logger.info(`Running auto-sync for integration: ${integration.id}`);

          try {
            const result = await this.syncInventory({
              integrationId: integration.id,
            });

            if (result.success) {
              syncedCount++;
            } else {
              failedCount++;
            }
            results.push({ integrationId: integration.id, result });
          } catch (error: unknown) {
            failedCount++;
            results.push({ integrationId: integration.id, error: getErrorMessage(error) });
            logger.error(`Auto-sync failed for integration ${integration.id}:`, error);
          }
        }
      }

      return { syncedCount, failedCount, results };
    } catch (error: unknown) {
      logger.error('Error processing auto-syncs:', error);
      return { syncedCount, failedCount, results };
    }
  }

  /**
   * Send webhook notification
   */
  public async sendWebhook(
    integrationId: string,
    data: unknown
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
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

      logger.info(`Webhook sent for integration ${integrationId} with ${events.length} events`);
      return { success: true, statusCode: response.status };
    } catch (error: unknown) {
      logger.error(`Error sending webhook for integration ${integrationId}:`, error);
      return { success: false, error: getErrorMessage(error) };
    }
  }

  // Private helper methods

  /**
   * Resolve and validate external URLs used for outbound requests.
   * Ensures relative endpoints are anchored to the configured base URL.
   */
  private resolveExternalUrl(integration: ExternalIntegration, endpoint: string): string {
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

    const validated = validateExternalIntegrationUrl(
      resolved,
      allowedHosts.length > 0 ? allowedHosts : undefined
    );

    return validated.toString();
  }

  /**
   * Validate URL for SSRF protection
   * Blocks requests to private IPs, localhost, and dangerous protocols
   */
  private validateUrlForSSRF(url: string): void {
    try {
      const allowedHosts = (process.env.EXTERNAL_INTEGRATION_ALLOWED_HOSTS || '')
        .split(',')
        .map(host => host.trim())
        .filter(Boolean);

      validateExternalIntegrationUrl(url, allowedHosts.length > 0 ? allowedHosts : undefined);
    } catch (error: unknown) {
      if (getErrorMessage(error).includes('Invalid URL')) {
        throw new Error('Invalid URL format');
      }
      throw error;
    }
  }

  private validateStarCommsConfig(type: IntegrationType, starCommsBaseUrl?: string): void {
    if (type !== IntegrationType.STARCOMMS) {
      return;
    }

    if (!starCommsBaseUrl) {
      throw new ValidationError('StarComms integrations require starCommsConfig.baseUrl');
    }

    this.validateUrlForSSRF(starCommsBaseUrl);
  }

  private getAxiosClient(): AxiosInstance {
    const cacheKey = '__default__';

    // Check cache
    if (this.axiosInstances.has(cacheKey)) {
      // @ts-expect-error - Strict mode compatibility
      return this.axiosInstances.get(cacheKey);
    }

    // Create a generic axios client. Integration-specific URL/auth are applied per request.
    const config: {
      timeout: number;
      headers: Record<string, string>;
    } = {
      timeout: 30000,
      headers: {},
    };

    const client = axios.create(config);

    // Validate every outbound URL at request time (defense in depth)
    client.interceptors.request.use(requestConfig => {
      const requestUrl = requestConfig.url || requestConfig.baseURL || '';
      if (requestUrl) {
        this.validateUrlForSSRF(requestUrl);
      }
      return requestConfig;
    });

    // Cache the shared instance
    this.axiosInstances.set(cacheKey, client);

    return client;
  }

  private buildAxiosRequestConfig(integration: ExternalIntegration): {
    timeout: number;
    headers: Record<string, string>;
    auth?: { username: string; password: string };
  } {
    const requestConfig: {
      timeout: number;
      headers: Record<string, string>;
      auth?: { username: string; password: string };
    } = {
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

  private async fetchExternalInventory(
    integration: ExternalIntegration,
    client: AxiosInstance,
    categories?: string[]
  ): Promise<unknown[]> {
    if (!integration.apiConfig?.endpoints.getInventory) {
      throw new Error('Get inventory endpoint not configured');
    }

    let url = this.resolveExternalUrl(integration, integration.apiConfig.endpoints.getInventory);

    // Add category filter if specified
    if (categories && categories.length > 0) {
      const params = new URLSearchParams();
      categories.forEach(cat => params.append('category', cat));
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${params.toString()}`;
      this.validateUrlForSSRF(url);
    }

    const response = await client.get<unknown>(url, this.buildAxiosRequestConfig(integration));

    const normalizeUnknownArray = (value: unknown): unknown[] => {
      if (!Array.isArray(value)) {
        return [];
      }

      const normalized: unknown[] = [];
      for (const item of value) {
        normalized.push(item);
      }

      return normalized;
    };

    const responseData: unknown = response.data;
    const directItems = normalizeUnknownArray(responseData);
    if (Array.isArray(responseData)) {
      return directItems;
    }

    if (typeof responseData === 'object' && responseData !== null && 'items' in responseData) {
      return normalizeUnknownArray((responseData as { items?: unknown }).items);
    }

    return directItems;
  }

  private async pushInventoryToExternal(
    integration: ExternalIntegration,
    client: AxiosInstance,
    categories?: string[]
  ): Promise<void> {
    if (!integration.apiConfig?.endpoints.syncInventory) {
      throw new Error('Sync inventory endpoint not configured');
    }

    const whereConditions: Record<string, unknown> = { fleetId: integration.fleetId };

    if (categories && categories.length > 0) {
      whereConditions.category = In(categories);
    }

    const items = await this.inventoryRepository.find({ where: whereConditions });

    const externalData = items.map(item => this.mapInternalToExternal(item, integration));

    const url = this.resolveExternalUrl(integration, integration.apiConfig.endpoints.syncInventory);
    await client.post(
      url,
      {
        items: externalData,
      },
      this.buildAxiosRequestConfig(integration)
    );
  }

  // Public for testing purposes
  public mapExternalToInternal(
    externalItem: unknown,
    integration: ExternalIntegration
  ): Partial<CreateInventoryItemDto> {
    const mapped: Record<string, unknown> = {
      fleetId: integration.fleetId,
    };

    // Apply field mappings
    (integration.fieldMappings || []).forEach(mapping => {
      let value = this.getNestedValue(externalItem, mapping.sourceField);

      // Apply transform if specified using safe evaluation
      if (mapping.transform) {
        try {
          value = this.safelyTransformValue(value, mapping.transform);
        } catch (error: unknown) {
          logger.error('Error applying transform:', error);
        }
      }

      // Use default if value is undefined
      if (value === undefined && mapping.default !== undefined) {
        value = mapping.default;
      }

      this.setNestedValue(mapped, mapping.targetField, value);
    });

    return mapped;
  }

  /**
   * Safely transform a value using predefined transformation functions
   * This replaces the dangerous Function() constructor with a whitelist of safe transformations
   */
  private safelyTransformValue(value: unknown, transformCode: string): unknown {
    type TransformFunction = (val: unknown) => unknown;

    // Whitelist of safe transformation functions
    const safeTransforms: Record<string, TransformFunction> = {
      toLowerCase: (val: unknown) => (typeof val === 'string' ? val.toLowerCase() : val),
      toUpperCase: (val: unknown) => (typeof val === 'string' ? val.toUpperCase() : val),
      trim: (val: unknown) => (typeof val === 'string' ? val.trim() : val),
      parseInt: (val: unknown) => parseInt(String(val), 10),
      parseFloat: (val: unknown) => parseFloat(String(val)),
      toString: (val: unknown) => String(val),
      toNumber: (val: unknown) => Number(val),
      toBoolean: (val: unknown) => Boolean(val),
      'return value': (val: unknown) => val, // No transformation
      'value.toLowerCase()': (val: unknown) => (typeof val === 'string' ? val.toLowerCase() : val),
      'value.toUpperCase()': (val: unknown) => (typeof val === 'string' ? val.toUpperCase() : val),
      'value.trim()': (val: unknown) => (typeof val === 'string' ? val.trim() : val),
      'parseInt(value)': (val: unknown) => parseInt(String(val), 10),
      'parseFloat(value)': (val: unknown) => parseFloat(String(val)),
      'String(value)': (val: unknown) => String(val),
      'Number(value)': (val: unknown) => Number(val),
      'Boolean(value)': (val: unknown) => Boolean(val),
    };

    // Normalize the transform code
    const normalizedTransform = transformCode.trim();

    // Check if transform is in whitelist
    if (safeTransforms[normalizedTransform]) {
      return safeTransforms[normalizedTransform](value);
    }

    // If not in whitelist, log warning and return original value
    logger.warn(
      `Unsafe or unknown transform attempted: ${transformCode}. Returning original value.`
    );
    return value;
  }

  private mapInternalToExternal(
    item: FleetInventory,
    integration: ExternalIntegration
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};

    // Reverse the field mappings
    integration.fieldMappings.forEach(mapping => {
      const value = this.getNestedValue(item, mapping.targetField);
      this.setNestedValue(mapped, mapping.sourceField, value);
    });

    return mapped;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!; // Safe: split always produces at least one element
    const target = keys.reduce<Record<string, unknown>>((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);
    target[lastKey] = value;
  }
}
