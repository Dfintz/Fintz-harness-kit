import crypto from 'node:crypto';

import axios, { AxiosError, AxiosInstance } from 'axios';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  Webhook,
  WebhookDeliveryLog,
  WebhookDeliveryResult,
  WebhookEventType,
  WebhookPayload,
  WebhookStatus,
  WebhookType,
} from '../../../models/Webhook';
import { ValidationError } from '../../../utils/apiErrors';
import { isLocalhost, isPrivateIP } from '../../../utils/joiValidators';
import { logger } from '../../../utils/logger';
import { notificationDispatcher } from '../../notification/NotificationDispatcher';

/**
 * Discord embed structure for rich messages
 */
interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
}

/**
 * Discord webhook message payload
 */
interface DiscordWebhookMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  thread_id?: string;
}

/**
 * WebhookService
 * Manages webhook configurations and event delivery
 *
 * Features:
 * - HMAC-SHA256 signature for payload verification
 * - Exponential backoff retry mechanism
 * - Discord webhook integration with rich embeds
 * - Custom webhook support with flexible authentication
 * - Delivery tracking and history
 */
export class WebhookService {
  private readonly webhookRepository: Repository<Webhook>;
  private readonly axiosInstances: Map<string, AxiosInstance> = new Map();

  constructor(webhookRepository?: Repository<Webhook>) {
    this.webhookRepository = webhookRepository || AppDataSource.getRepository(Webhook);
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Create a new webhook
   */
  async createWebhook(organizationId: string, dto: CreateWebhookDto): Promise<Webhook> {
    try {
      // Validate configuration based on type
      this.validateWebhookConfig(dto);

      // Generate a secret if not provided for custom webhooks
      const secret =
        dto.secret || (dto.type === WebhookType.CUSTOM ? this.generateSecret() : undefined);

      const webhook = this.webhookRepository.create({
        organizationId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        status: WebhookStatus.PENDING,
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

      // Test the webhook connection
      await this.testWebhook(saved);

      logger.info(`Webhook created: ${saved.id} (${saved.type}) for org ${organizationId}`);
      return saved;
    } catch (error: unknown) {
      logger.error('Error creating webhook:', error);
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string): Promise<Webhook | null> {
    try {
      return await this.webhookRepository.findOne({ where: { id } });
    } catch (error: unknown) {
      logger.error(`Error getting webhook ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get webhook by ID (alias for getWebhookById)
   */
  async getWebhook(id: string): Promise<Webhook | null> {
    return this.getWebhookById(id);
  }

  /**
   * Get all webhooks for an organization
   */
  async getWebhooksByOrganization(organizationId: string): Promise<Webhook[]> {
    try {
      return await this.webhookRepository.find({
        where: { organizationId },
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error('Error getting webhooks:', error);
      throw error;
    }
  }

  /**
   * List webhooks for an organization with optional status filter (alias for getWebhooksByOrganization)
   */
  async listWebhooks(organizationId: string, status?: WebhookStatus): Promise<Webhook[]> {
    try {
      const where: { organizationId: string; status?: WebhookStatus } = { organizationId };
      if (status) {
        where.status = status;
      }
      return await this.webhookRepository.find({
        where,
        order: { createdAt: 'DESC' },
      });
    } catch (error: unknown) {
      logger.error('Error listing webhooks:', error);
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, dto: UpdateWebhookDto): Promise<Webhook> {
    try {
      const webhook = await this.webhookRepository.findOne({ where: { id } });

      if (!webhook) {
        throw new Error(`Webhook ${id} not found`);
      }

      // Apply simple field updates
      this.applySimpleFieldUpdates(webhook, dto);

      // Apply config updates with URL validation
      this.applyConfigUpdates(webhook, dto);

      // Clear cached axios instance
      this.axiosInstances.delete(id);

      const updated = await this.webhookRepository.save(webhook);
      logger.info(`Webhook updated: ${id}`);
      return updated;
    } catch (error: unknown) {
      logger.error(`Error updating webhook ${id}:`, error);
      throw error;
    }
  }

  /**
   * Apply simple scalar field updates from DTO to webhook entity
   */
  private applySimpleFieldUpdates(webhook: Webhook, dto: UpdateWebhookDto): void {
    const simpleFields: Array<keyof UpdateWebhookDto> = [
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (webhook as any)[field] = dto[field];
      }
    }
  }

  /**
   * Apply config updates with URL validation for SSRF protection
   */
  private applyConfigUpdates(webhook: Webhook, dto: UpdateWebhookDto): void {
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

  /**
   * Validate Discord webhook URL format and SSRF safety
   */
  private validateDiscordConfigUrl(config: { webhookUrl?: string }): void {
    if (config.webhookUrl) {
      const discordUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
      if (!discordUrlPattern.test(config.webhookUrl)) {
        throw new ValidationError(
          'Invalid Discord webhook URL format - must be a valid Discord webhook URL'
        );
      }
      this.validateUrlForSSRF(config.webhookUrl);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string): Promise<void> {
    try {
      const result = await this.webhookRepository.delete(id);
      if (result.affected === 0) {
        throw new Error(`Webhook ${id} not found`);
      }
      this.axiosInstances.delete(id);
      logger.info(`Webhook deleted: ${id}`);
    } catch (error: unknown) {
      logger.error(`Error deleting webhook ${id}:`, error);
      throw error;
    }
  }

  /**
   * Test webhook connection
   */
  async testWebhook(idOrWebhook: string | Webhook): Promise<WebhookDeliveryResult> {
    try {
      let webhook: Webhook;

      if (typeof idOrWebhook === 'string') {
        const found = await this.webhookRepository.findOne({ where: { id: idOrWebhook } });
        if (!found) {
          throw new Error(`Webhook ${idOrWebhook} not found`);
        }
        webhook = found;
      } else {
        webhook = idOrWebhook;
        // Ensure the webhook has been persisted and has an id
        if (!webhook.id) {
          throw new ValidationError(
            'Cannot test webhook without an id. Please save the webhook first.'
          );
        }
      }

      // Create a test payload
      const testPayload: WebhookPayload = {
        id: `test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: WebhookEventType.FLEET_CREATED,
        organizationId: webhook.organizationId,
        data: {
          test: true,
          message: 'This is a test webhook delivery',
        },
        retryCount: 0,
      };

      // Attempt delivery
      const result = await this.deliverWebhook(webhook, testPayload);

      // Update webhook status based on result
      webhook.status = result.success ? WebhookStatus.ACTIVE : WebhookStatus.ERROR;
      if (!result.success) {
        webhook.lastError = result.error;
      }
      await this.webhookRepository.save(webhook);

      return result;
    } catch (error: unknown) {
      logger.error(`Error testing webhook:`, error);
      throw error;
    }
  }

  // ==================== EVENT TRIGGERING ====================

  /**
   * Trigger an event for all subscribed webhooks in an organization
   */
  async triggerEvent(
    organizationId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<{
    success: number;
    failed: number;
    skipped: number;
    results: WebhookDeliveryResult[];
  }> {
    const results: WebhookDeliveryResult[] = [];
    let success = 0;
    let failed = 0;
    let skipped = 0;

    try {
      // Find all enabled webhooks subscribed to this event
      const webhooks = await this.webhookRepository
        .createQueryBuilder('webhook')
        .where('webhook.organizationId = :organizationId', { organizationId })
        .andWhere('webhook.enabled = :enabled', { enabled: true })
        .andWhere('webhook.status != :errorStatus', { errorStatus: WebhookStatus.ERROR })
        .getMany();

      // Filter webhooks that are subscribed to this event
      const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));

      logger.info(
        `Triggering event ${event} for ${subscribedWebhooks.length} webhooks in org ${organizationId}`
      );

      // Deliver to each webhook
      for (const webhook of subscribedWebhooks) {
        // Skip if circuit breaker is open
        if (webhook.circuitBreakerOpen) {
          logger.warn(`Skipping webhook ${webhook.id} - circuit breaker is open`);
          skipped++;
          results.push({
            success: false,
            error: 'Circuit breaker is open',
            deliveryId: this.generateDeliveryId(),
            skipped: true,
          });
          continue;
        }

        const payload: WebhookPayload = {
          id: this.generateDeliveryId(),
          timestamp: new Date().toISOString(),
          event,
          organizationId,
          data,
          retryCount: 0,
        };

        // Add signature for custom webhooks
        if (webhook.type === WebhookType.CUSTOM && webhook.secret) {
          payload.signature = this.generateSignature(payload, webhook.secret);
        }

        const result = await this.deliverWithRetry(webhook, payload);
        results.push(result);

        if (result.success) {
          success++;
        } else {
          failed++;
        }
      }

      return { success, failed, skipped, results };
    } catch (error: unknown) {
      logger.error(`Error triggering event ${event}:`, error);
      throw error;
    }
  }

  // ==================== DELIVERY LOGIC ====================

  /**
   * Deliver webhook with retry logic
   */
  private async deliverWithRetry(
    webhook: Webhook,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    let lastResult: WebhookDeliveryResult = {
      success: false,
      error: 'No delivery attempted',
      deliveryId: payload.id,
    };

    for (let attempt = 0; attempt <= webhook.maxRetries; attempt++) {
      // Create a copy of the payload for this attempt to avoid mutation issues
      const attemptPayload = { ...payload, retryCount: attempt };

      // Calculate delay with exponential backoff
      if (attempt > 0) {
        const delay = webhook.retryDelayMs * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }

      lastResult = await this.deliverWebhook(webhook, attemptPayload);

      // Record the delivery attempt
      await this.recordDelivery(webhook, attemptPayload, lastResult, attempt);

      if (lastResult.success) {
        break;
      }

      logger.warn(
        `Webhook delivery attempt ${attempt + 1}/${webhook.maxRetries + 1} failed for ${webhook.id}: ${lastResult.error}`
      );
    }

    return lastResult;
  }

  /**
   * Deliver webhook payload
   */
  private async deliverWebhook(
    webhook: Webhook,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const deliveryId = payload.id;

    try {
      // CWE-918: Defense-in-depth SSRF validation before any outbound webhook delivery
      if (webhook.customConfig?.url) {
        this.validateUrlForSSRF(webhook.customConfig.url);
      }
      if (webhook.discordConfig?.webhookUrl) {
        this.validateUrlForSSRF(webhook.discordConfig.webhookUrl);
      }

      if (webhook.type === WebhookType.DISCORD) {
        return await this.deliverDiscordWebhook(webhook, payload, startTime);
      } else {
        return await this.deliverCustomWebhook(webhook, payload, startTime);
      }
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Webhook delivery failed for ${webhook.id}:`, error);

      return {
        success: false,
        error: errorMessage,
        responseTime,
        deliveryId,
      };
    }
  }

  /**
   * Deliver to Discord webhook
   */
  private async deliverDiscordWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    startTime: number
  ): Promise<WebhookDeliveryResult> {
    if (!webhook.discordConfig?.webhookUrl) {
      throw new Error('Discord webhook URL not configured');
    }

    // CWE-918: Validate Discord webhook URL for SSRF protection
    // Discord webhooks should only go to discord.com
    const discordUrlPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    if (!discordUrlPattern.test(webhook.discordConfig.webhookUrl)) {
      throw new Error('Invalid Discord webhook URL format - must be a valid Discord webhook URL');
    }

    // Format the message for Discord
    const discordMessage = this.formatDiscordMessage(payload, webhook);

    try {
      const url = webhook.discordConfig.threadId
        ? `${webhook.discordConfig.webhookUrl}?thread_id=${webhook.discordConfig.threadId}`
        : webhook.discordConfig.webhookUrl;

      const response = await axios.post(url, discordMessage, {
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
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      return {
        success: false,
        statusCode: axiosError.response?.status,
        responseTime,
        error: axiosError.message,
        deliveryId: payload.id,
      };
    }
  }

  /**
   * Deliver to custom webhook
   */
  private async deliverCustomWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    startTime: number
  ): Promise<WebhookDeliveryResult> {
    if (!webhook.customConfig?.url) {
      throw new Error('Custom webhook URL not configured');
    }

    // CWE-918: Validate custom webhook URL for SSRF protection
    this.validateUrlForSSRF(webhook.customConfig.url);

    const client = this.getAxiosClient();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Delivery': payload.id,
      'X-Webhook-Timestamp': payload.timestamp,
    };

    const requestAuth = this.buildWebhookAuthConfig(webhook, headers);

    // Add signature header if secret is configured
    if (webhook.secret && payload.signature) {
      headers['X-Webhook-Signature'] = `sha256=${payload.signature}`;
    }

    // Merge custom headers
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
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      return {
        success: false,
        statusCode: axiosError.response?.status,
        responseTime,
        error: axiosError.message,
        deliveryId: payload.id,
      };
    }
  }

  // ==================== DISCORD FORMATTING ====================

  /**
   * Format webhook payload as Discord message with embeds
   */
  private formatDiscordMessage(payload: WebhookPayload, webhook: Webhook): DiscordWebhookMessage {
    const embed = this.createDiscordEmbed(payload);

    return {
      username: webhook.discordConfig?.username || 'Fleet Manager',
      avatar_url: webhook.discordConfig?.avatarUrl,
      embeds: [embed],
    };
  }

  /**
   * Create Discord embed based on event type
   */
  private createDiscordEmbed(payload: WebhookPayload): DiscordEmbed {
    const eventColors: Record<string, number> = {
      // Fleet events - Blue
      'fleet.created': 0x3498db,
      'fleet.updated': 0x3498db,
      'fleet.deleted': 0xe74c3c,
      'fleet.member.joined': 0x2ecc71,
      'fleet.member.left': 0xe67e22,

      // Member events - Green/Orange
      'member.joined': 0x2ecc71,
      'member.left': 0xe67e22,
      'member.role.changed': 0x9b59b6,

      // Activity events - Purple
      'activity.created': 0x9b59b6,
      'activity.started': 0x1abc9c,
      'activity.completed': 0x2ecc71,
      'activity.cancelled': 0xe74c3c,
      'activity.participant.joined': 0x2ecc71,
      'activity.participant.left': 0xe67e22,

      // Alert events - Red/Green
      'alert.created': 0xe74c3c,
      'alert.resolved': 0x2ecc71,

      // Ship events - Cyan
      'ship.added': 0x1abc9c,
      'ship.removed': 0xe74c3c,
      'ship.transferred': 0xf39c12,
    };

    const eventTitles: Record<string, string> = {
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

    const embed: DiscordEmbed = {
      title: eventTitles[payload.event] || `Event: ${payload.event}`,
      color: eventColors[payload.event] || 0x7289da,
      timestamp: payload.timestamp,
      footer: {
        text: 'Star Citizen Fleet Manager',
      },
      fields: [],
    };

    // Add data fields to embed
    const data = payload.data;
    if (data) {
      const fields = this.formatDataAsFields(data);
      embed.fields = fields.slice(0, 25); // Discord limit
    }

    return embed;
  }

  /**
   * Format data object as Discord embed fields
   */
  private formatDataAsFields(
    data: Record<string, unknown>
  ): Array<{ name: string; value: string; inline?: boolean }> {
    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      const name = this.formatFieldName(key);
      let valueStr: string;

      if (typeof value === 'object') {
        valueStr = JSON.stringify(value, null, 2);
        if (valueStr.length > 1024) {
          valueStr = `${valueStr.substring(0, 1021)}...`;
        }
      } else {
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

  /**
   * Format camelCase or snake_case to Title Case
   */
  private formatFieldName(key: string): string {
    return key
      .replaceAll(/([A-Z])/g, ' $1')
      .replaceAll('_', ' ')
      .replace(/^\w/, (c: string) => c.toUpperCase())
      .trim();
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get or create axios client for a webhook
   */
  private getAxiosClient(): AxiosInstance {
    const cacheKey = '__default__';

    if (this.axiosInstances.has(cacheKey)) {
      // @ts-expect-error - Strict mode compatibility
      return this.axiosInstances.get(cacheKey);
    }

    const config: Record<string, unknown> = {
      timeout: 30000,
      headers: {},
    };

    const client = axios.create(config);

    // CWE-918: Defense-in-depth SSRF protection — intercept ALL outgoing requests
    // This ensures no request through this client can bypass URL validation,
    // even if a new delivery method is added later without explicit validation.
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

  private buildWebhookAuthConfig(
    webhook: Webhook,
    headers: Record<string, string>
  ): { username: string; password: string } | undefined {
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

  /**
   * Validate URL for SSRF protection
   * CWE-918: Blocks requests to private IPs, localhost, and dangerous protocols
   * @param url - URL to validate
   * @throws Error if URL is not safe
   */
  private validateUrlForSSRF(url: string): void {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Block non-HTTP(S) protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new ValidationError(
          `Invalid protocol: ${parsedUrl.protocol}. Only HTTP(S) is allowed.`
        );
      }

      // Block localhost and loopback addresses
      if (isLocalhost(hostname)) {
        throw new ValidationError('Webhook URL cannot target localhost or loopback addresses');
      }

      // Block private IP ranges
      if (isPrivateIP(hostname)) {
        throw new ValidationError('Webhook URL cannot target private network addresses');
      }

      // Block cloud metadata endpoints
      const blockedHostnames = [
        '169.254.169.254', // AWS/GCP/Azure metadata
        'metadata.google.internal',
        'metadata.gke.internal',
        'host.docker.internal',
      ];

      if (blockedHostnames.includes(hostname)) {
        throw new ValidationError('Webhook URL cannot target cloud metadata endpoints');
      }

      // In production, require HTTPS for security
      if (process.env.NODE_ENV === 'production' && parsedUrl.protocol !== 'https:') {
        throw new ValidationError('HTTPS is required for webhooks in production');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message.includes('Invalid URL')) {
          throw new ValidationError('Invalid webhook URL format');
        }
        throw error;
      }
      throw new ValidationError('Invalid webhook URL');
    }
  }

  /**
   * Record a delivery attempt
   */
  private async recordDelivery(
    webhook: Webhook,
    payload: WebhookPayload,
    result: WebhookDeliveryResult,
    retryCount: number
  ): Promise<void> {
    try {
      const deliveryLog: WebhookDeliveryLog = {
        deliveryId: result.deliveryId,
        timestamp: new Date(),
        event: payload.event,
        status: result.success ? 'success' : 'failed',
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        error: result.error,
        retryCount,
      };

      // Add to delivery history (keep last 100)
      webhook.deliveryHistory = [deliveryLog, ...webhook.deliveryHistory.slice(0, 99)];

      // Update statistics
      webhook.totalDeliveries++;
      webhook.lastDeliveryAt = new Date();

      if (result.success) {
        webhook.successfulDeliveries++;
        webhook.lastSuccessAt = new Date();
        webhook.status = WebhookStatus.ACTIVE;
        webhook.lastError = undefined;

        // Reset circuit breaker on success
        if (webhook.consecutiveFailures > 0 || webhook.circuitBreakerOpen) {
          logger.info(
            `Resetting circuit breaker for webhook ${webhook.id} after successful delivery`
          );
          webhook.consecutiveFailures = 0;
          webhook.circuitBreakerOpen = false;
          webhook.circuitOpenedAt = undefined;
        }
      } else {
        webhook.failedDeliveries++;
        webhook.lastFailureAt = new Date();
        webhook.lastError = result.error;

        // Increment consecutive failures
        webhook.consecutiveFailures++;

        // Check if circuit breaker threshold is reached
        if (
          webhook.consecutiveFailures >= webhook.circuitBreakerThreshold &&
          !webhook.circuitBreakerOpen
        ) {
          logger.error(
            `Circuit breaker opened for webhook ${webhook.id} after ${webhook.consecutiveFailures} consecutive failures`
          );
          webhook.circuitBreakerOpen = true;
          webhook.circuitOpenedAt = new Date();
          webhook.status = WebhookStatus.ERROR;

          // Notify admins if not already notified
          if (!webhook.adminNotifiedOfFailure) {
            await this.notifyAdminsOfCircuitBreakerOpen(webhook);
          }
        }
      }

      await this.webhookRepository.save(webhook);
    } catch (error: unknown) {
      logger.error('Error recording webhook delivery:', error);
    }
  }

  /**
   * Generate HMAC-SHA256 signature
   */
  private generateSignature(payload: WebhookPayload | string, secret: string): string {
    let normalizedPayload: string;

    if (typeof payload === 'string') {
      // Normalize JSON strings to the same representation used for objects
      try {
        const parsed = JSON.parse(payload);
        normalizedPayload = JSON.stringify(parsed);
      } catch {
        // If it's not valid JSON, fall back to using the raw string
        normalizedPayload = payload;
      }
    } else {
      normalizedPayload = JSON.stringify(payload);
    }

    return crypto.createHmac('sha256', secret).update(normalizedPayload).digest('hex');
  }

  /**
   * Verify webhook signature
   * Uses constant-time comparison to prevent timing attacks
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Check length first to prevent timing attacks from length differences
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );
    } catch {
      // timingSafeEqual can throw if buffers have different lengths
      return false;
    }
  }

  /**
   * Generate a random secret
   */
  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a unique delivery ID
   */
  private generateDeliveryId(): string {
    return `del_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Validate webhook configuration
   */
  private validateWebhookConfig(dto: CreateWebhookDto): void {
    this.validateWebhookTypeConfig(dto);

    if (!dto.events || dto.events.length === 0) {
      throw new ValidationError('At least one event must be selected');
    }
  }

  /**
   * Validate type-specific webhook config (Discord URL format or custom URL SSRF)
   */
  private validateWebhookTypeConfig(dto: CreateWebhookDto): void {
    if (dto.type === WebhookType.DISCORD) {
      if (!dto.discordConfig?.webhookUrl) {
        throw new ValidationError('Discord webhook URL is required');
      }
      this.validateDiscordConfigUrl(dto.discordConfig);
    } else if (dto.type === WebhookType.CUSTOM) {
      if (!dto.customConfig?.url) {
        throw new ValidationError('Custom webhook URL is required');
      }
      this.validateUrlForSSRF(dto.customConfig.url);
    }
  }

  /**
   * Validate webhook configuration and return results (public API)
   * Tests webhook without creating it
   */
  async testWebhookConfig(
    organizationId: string,
    dto: CreateWebhookDto
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    testResult?: WebhookDeliveryResult;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate configuration
    try {
      this.validateWebhookConfig(dto);
    } catch (error: unknown) {
      if (error instanceof Error) {
        errors.push(error.message);
      } else {
        errors.push('Invalid webhook configuration');
      }
    }

    // If basic validation failed, return early
    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // Try to test the webhook endpoint
    let testResult: WebhookDeliveryResult | undefined;
    try {
      // Create a temporary webhook object for testing (not saved to DB)
      const tempWebhook: Partial<Webhook> = {
        id: `temp-${Date.now()}`,
        organizationId,
        type: dto.type,
        discordConfig: dto.discordConfig,
        customConfig: dto.customConfig,
        secret: dto.secret,
        maxRetries: 0, // No retries for validation
        timeoutMs: dto.timeoutMs ?? 10000, // Shorter timeout for validation
        retryDelayMs: 0,
      };

      // Create test payload
      const testPayload: WebhookPayload = {
        id: `validation-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: WebhookEventType.FLEET_CREATED,
        organizationId,
        data: {
          test: true,
          validation: true,
          message: 'Webhook validation test - you can ignore this message',
        },
        retryCount: 0,
      };

      // Attempt delivery without retries
      testResult = await this.deliverWebhook(tempWebhook as Webhook, testPayload);

      if (!testResult.success) {
        warnings.push(
          `Webhook test delivery failed: ${testResult.error}`,
          'The webhook configuration is valid but the endpoint may not be reachable'
        );
      }
    } catch (error: unknown) {
      warnings.push(
        `Could not test webhook endpoint: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      testResult,
    };
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get webhook statistics for an organization
   */
  async getStatistics(organizationId: string): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    errorWebhooks: number;
    totalDeliveries: number;
    successRate: number;
    recentDeliveries: WebhookDeliveryLog[];
  }> {
    try {
      const webhooks = await this.webhookRepository.find({
        where: { organizationId },
      });

      const totalWebhooks = webhooks.length;
      const activeWebhooks = webhooks.filter(w => w.status === WebhookStatus.ACTIVE).length;
      const errorWebhooks = webhooks.filter(w => w.status === WebhookStatus.ERROR).length;

      const totalDeliveries = webhooks.reduce((sum, w) => sum + w.totalDeliveries, 0);
      const successfulDeliveries = webhooks.reduce((sum, w) => sum + w.successfulDeliveries, 0);
      const successRate =
        totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 100;

      // Get recent deliveries from all webhooks
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
    } catch (error: unknown) {
      logger.error('Error getting webhook statistics:', error);
      throw error;
    }
  }

  // ==================== ENHANCED TESTING ENDPOINT ====================

  /**
   * Test webhook with custom payload
   * Allows users to send custom test payloads to verify webhook configuration
   */
  async testWebhookWithPayload(
    idOrWebhook: string | Webhook,
    options: {
      event?: WebhookEventType;
      data?: Record<string, unknown>;
      includeSignature?: boolean;
    } = {}
  ): Promise<WebhookDeliveryResult & { payload: WebhookPayload }> {
    try {
      let webhook: Webhook;

      if (typeof idOrWebhook === 'string') {
        const found = await this.webhookRepository.findOne({ where: { id: idOrWebhook } });
        if (!found) {
          throw new Error(`Webhook ${idOrWebhook} not found`);
        }
        webhook = found;
      } else {
        webhook = idOrWebhook;
        if (!webhook.id) {
          throw new ValidationError(
            'Cannot test webhook without an id. Please save the webhook first.'
          );
        }
      }

      // Create a custom test payload
      const testPayload: WebhookPayload = {
        id: `test-custom-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: options.event || WebhookEventType.FLEET_CREATED,
        organizationId: webhook.organizationId,
        data: {
          test: true,
          message: 'This is a custom test webhook delivery',
          ...options.data,
        },
        retryCount: 0,
      };

      // Add signature for custom webhooks if requested
      if (
        webhook.type === WebhookType.CUSTOM &&
        webhook.secret &&
        options.includeSignature !== false
      ) {
        testPayload.signature = this.generateSignature(testPayload, webhook.secret);
      }

      // Attempt delivery
      const result = await this.deliverWebhook(webhook, testPayload);

      // Update webhook status based on result
      webhook.status = result.success ? WebhookStatus.ACTIVE : WebhookStatus.ERROR;
      if (!result.success) {
        webhook.lastError = result.error;
      }
      await this.webhookRepository.save(webhook);

      logger.info(
        `Custom test webhook delivery for ${webhook.id}: ${result.success ? 'success' : 'failed'}`
      );

      return {
        ...result,
        payload: testPayload,
      };
    } catch (error: unknown) {
      const webhookId = typeof idOrWebhook === 'string' ? idOrWebhook : idOrWebhook?.id;
      logger.error(`Error testing webhook ${webhookId} with custom payload:`, error);
      throw error;
    }
  }

  /**
   * Echo test - returns what the webhook endpoint would receive
   * Useful for debugging and understanding the payload format
   */
  async getTestPayloadPreview(
    id: string,
    options: {
      event?: WebhookEventType;
      data?: Record<string, unknown>;
    } = {}
  ): Promise<{
    webhook: Pick<Webhook, 'id' | 'name' | 'type' | 'events'>;
    payload: WebhookPayload;
    headers: Record<string, string>;
    discordMessage?: object;
  }> {
    try {
      const webhook = await this.webhookRepository.findOne({ where: { id } });

      if (!webhook) {
        throw new Error(`Webhook ${id} not found`);
      }

      const testPayload: WebhookPayload = {
        id: `preview-${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: options.event || WebhookEventType.FLEET_CREATED,
        organizationId: webhook.organizationId,
        data: {
          test: true,
          message: 'This is a preview payload',
          ...options.data,
        },
        retryCount: 0,
      };

      // Add signature for custom webhooks
      if (webhook.type === WebhookType.CUSTOM && webhook.secret) {
        testPayload.signature = this.generateSignature(testPayload, webhook.secret);
      }

      // Build headers that would be sent
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Event': testPayload.event,
        'X-Webhook-Delivery': testPayload.id,
        'X-Webhook-Timestamp': testPayload.timestamp,
      };

      if (webhook.secret && testPayload.signature) {
        headers['X-Webhook-Signature'] = `sha256=${testPayload.signature}`;
      }

      const result: {
        webhook: Pick<Webhook, 'id' | 'name' | 'type' | 'events'>;
        payload: WebhookPayload;
        headers: Record<string, string>;
        discordMessage?: object;
      } = {
        webhook: {
          id: webhook.id,
          name: webhook.name,
          type: webhook.type,
          events: webhook.events,
        },
        payload: testPayload,
        headers,
      };

      // If Discord, also include the formatted message
      if (webhook.type === WebhookType.DISCORD) {
        result.discordMessage = this.formatDiscordMessage(testPayload, webhook);
      }

      return result;
    } catch (error: unknown) {
      logger.error(`Error getting test payload preview for webhook ${id}:`, error);
      throw error;
    }
  }

  // ==================== WEBHOOK BATCHING ====================

  // In-memory batch queue for each organization
  private readonly batchQueues: Map<
    string,
    {
      webhookId: string;
      events: Array<{
        event: WebhookEventType;
        data: Record<string, unknown>;
        timestamp: string;
      }>;
      timer?: ReturnType<typeof setTimeout>;
    }[]
  > = new Map();

  // Default batch configuration
  private readonly batchConfig = {
    maxBatchSize: 10, // Maximum events per batch
    maxWaitTimeMs: 5000, // Maximum time to wait before sending batch (5 seconds)
    enabled: true, // Whether batching is enabled
  };

  /**
   * Configure batching settings
   */
  configureBatching(config: {
    maxBatchSize?: number;
    maxWaitTimeMs?: number;
    enabled?: boolean;
  }): void {
    if (config.maxBatchSize !== undefined) {
      this.batchConfig.maxBatchSize = Math.max(1, Math.min(100, config.maxBatchSize));
    }
    if (config.maxWaitTimeMs !== undefined) {
      this.batchConfig.maxWaitTimeMs = Math.max(1000, Math.min(60000, config.maxWaitTimeMs));
    }
    if (config.enabled !== undefined) {
      this.batchConfig.enabled = config.enabled;
    }
    logger.info('Webhook batching configured:', this.batchConfig);
  }

  /**
   * Get current batch configuration
   */
  getBatchConfig(): {
    maxBatchSize: number;
    maxWaitTimeMs: number;
    enabled: boolean;
  } {
    return { ...this.batchConfig };
  }

  /**
   * Queue an event for batched delivery
   * Events will be collected and delivered together based on batch configuration
   */
  async queueEventForBatch(
    organizationId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): Promise<{ queued: boolean; webhookIds: string[] }> {
    if (!this.batchConfig.enabled) {
      // If batching is disabled, trigger immediately
      // Find webhooks that were triggered to get their IDs
      const webhooks = await this.webhookRepository
        .createQueryBuilder('webhook')
        .where('webhook.organizationId = :organizationId', { organizationId })
        .andWhere('webhook.enabled = :enabled', { enabled: true })
        .andWhere('webhook.status != :errorStatus', { errorStatus: WebhookStatus.ERROR })
        .getMany();
      const subscribedWebhookIds = webhooks.filter(w => w.events.includes(event)).map(w => w.id);

      // Trigger the event
      await this.triggerEvent(organizationId, event, data);

      return {
        queued: false,
        webhookIds: subscribedWebhookIds,
      };
    }

    try {
      // Find all enabled webhooks subscribed to this event
      const webhooks = await this.webhookRepository
        .createQueryBuilder('webhook')
        .where('webhook.organizationId = :organizationId', { organizationId })
        .andWhere('webhook.enabled = :enabled', { enabled: true })
        .andWhere('webhook.status != :errorStatus', { errorStatus: WebhookStatus.ERROR })
        .getMany();

      const subscribedWebhooks = webhooks.filter(w => w.events.includes(event));

      if (subscribedWebhooks.length === 0) {
        return { queued: false, webhookIds: [] };
      }

      const webhookIds: string[] = [];

      for (const webhook of subscribedWebhooks) {
        this.addToBatchQueue(organizationId, webhook.id, event, data);
        webhookIds.push(webhook.id);
      }

      logger.debug(
        `Queued event ${event} for ${webhookIds.length} webhooks in org ${organizationId}`
      );
      return { queued: true, webhookIds };
    } catch (error: unknown) {
      logger.error(`Error queuing event for batch:`, error);
      throw error;
    }
  }

  /**
   * Add event to batch queue for a specific webhook
   */
  private addToBatchQueue(
    organizationId: string,
    webhookId: string,
    event: WebhookEventType,
    data: Record<string, unknown>
  ): void {
    if (!this.batchQueues.has(organizationId)) {
      this.batchQueues.set(organizationId, []);
    }

    const orgQueue = this.batchQueues.get(organizationId);
    // @ts-expect-error - Strict mode compatibility
    let webhookQueue = orgQueue.find(q => q.webhookId === webhookId);

    if (!webhookQueue) {
      webhookQueue = {
        webhookId,
        events: [],
      };
      // @ts-expect-error - Strict mode compatibility
      orgQueue.push(webhookQueue);
    }

    webhookQueue.events.push({
      event,
      data,
      timestamp: new Date().toISOString(),
    });

    // Start timer if this is the first event in the batch
    if (webhookQueue.events.length === 1) {
      webhookQueue.timer = setTimeout(() => {
        this.flushBatch(organizationId, webhookId).catch(err => {
          logger.error(`Error flushing batch for webhook ${webhookId}:`, err);
        });
      }, this.batchConfig.maxWaitTimeMs);
    }

    // Flush immediately if batch size reached
    if (webhookQueue.events.length >= this.batchConfig.maxBatchSize) {
      if (webhookQueue.timer) {
        clearTimeout(webhookQueue.timer);
        webhookQueue.timer = undefined;
      }
      this.flushBatch(organizationId, webhookId).catch(err => {
        logger.error(`Error flushing full batch for webhook ${webhookId}:`, err);
      });
    }
  }

  /**
   * Flush a batch queue for a specific webhook
   */
  async flushBatch(
    organizationId: string,
    webhookId: string
  ): Promise<WebhookDeliveryResult | null> {
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

    // Clear the queue
    webhookQueue.events = [];
    if (webhookQueue.timer) {
      clearTimeout(webhookQueue.timer);
      webhookQueue.timer = undefined;
    }

    // Remove empty queue
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

      // Create batched payload
      const batchPayload: WebhookPayload = {
        id: this.generateDeliveryId(),
        timestamp: new Date().toISOString(),
        event: WebhookEventType.BATCH,
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

      // Add signature for custom webhooks
      if (webhook.type === WebhookType.CUSTOM && webhook.secret) {
        batchPayload.signature = this.generateSignature(batchPayload, webhook.secret);
      }

      logger.info(`Delivering batched webhook for ${webhookId} with ${events.length} events`);
      return await this.deliverWithRetry(webhook, batchPayload);
    } catch (error: unknown) {
      logger.error(`Error flushing batch for webhook ${webhookId}:`, error);
      throw error;
    }
  }

  /**
   * Flush all pending batches for an organization
   */
  async flushAllBatches(organizationId: string): Promise<{
    flushed: number;
    results: WebhookDeliveryResult[];
  }> {
    const orgQueue = this.batchQueues.get(organizationId);
    if (!orgQueue || orgQueue.length === 0) {
      return { flushed: 0, results: [] };
    }

    const webhookIds = orgQueue.map(q => q.webhookId);
    const results: WebhookDeliveryResult[] = [];

    for (const webhookId of webhookIds) {
      const result = await this.flushBatch(organizationId, webhookId);
      if (result) {
        results.push(result);
      }
    }

    logger.info(`Flushed ${results.length} batches for org ${organizationId}`);
    return { flushed: results.length, results };
  }

  /**
   * Get pending batch information for an organization
   */
  getPendingBatches(organizationId: string): {
    webhookId: string;
    eventCount: number;
    events: Array<{
      event: WebhookEventType;
      timestamp: string;
    }>;
  }[] {
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

  /**
   * Cancel pending batches for an organization or specific webhook
   */
  cancelPendingBatches(organizationId: string, webhookId?: string): number {
    const orgQueue = this.batchQueues.get(organizationId);
    if (!orgQueue) {
      return 0;
    }

    let cancelled = 0;

    if (webhookId) {
      // Cancel specific webhook's batch
      const queueIndex = orgQueue.findIndex(q => q.webhookId === webhookId);
      if (queueIndex !== -1) {
        const queue = orgQueue[queueIndex];
        cancelled = queue.events.length;
        if (queue.timer) {
          clearTimeout(queue.timer);
        }
        orgQueue.splice(queueIndex, 1);
      }
    } else {
      // Cancel all batches for the organization
      for (const queue of orgQueue) {
        cancelled += queue.events.length;
        if (queue.timer) {
          clearTimeout(queue.timer);
        }
      }
      this.batchQueues.delete(organizationId);
    }

    if (cancelled > 0) {
      logger.info(
        `Cancelled ${cancelled} pending events for org ${organizationId}${webhookId ? ` webhook ${webhookId}` : ''}`
      );
    }

    return cancelled;
  }

  /**
   * Notify admins that a webhook circuit breaker has opened.
   * Persists an in-app notification for every platform admin.
   */
  private async notifyAdminsOfCircuitBreakerOpen(webhook: Webhook): Promise<void> {
    webhook.adminNotifiedOfFailure = true;
    webhook.adminNotifiedAt = new Date();
    await this.webhookRepository.save(webhook);

    logger.error('ADMIN ALERT: Webhook circuit breaker opened', {
      webhookId: webhook.id,
      webhookName: webhook.name,
      organizationId: webhook.organizationId,
      consecutiveFailures: webhook.consecutiveFailures,
      circuitBreakerThreshold: webhook.circuitBreakerThreshold,
      lastError: webhook.lastError,
      lastFailureAt: webhook.lastFailureAt,
    });

    try {
      await notificationDispatcher.notifyPlatformAdmins(
        'Webhook circuit breaker opened',
        `Webhook "${webhook.name}" (org ${webhook.organizationId}) opened its circuit breaker after ${webhook.consecutiveFailures} consecutive failures. Last error: ${webhook.lastError ?? 'unknown'}`,
        {
          data: {
            webhookId: webhook.id,
            webhookName: webhook.name,
            organizationId: webhook.organizationId,
            consecutiveFailures: webhook.consecutiveFailures,
            circuitBreakerThreshold: webhook.circuitBreakerThreshold,
            lastError: webhook.lastError,
            lastFailureAt: webhook.lastFailureAt,
          },
        }
      );
    } catch (err: unknown) {
      logger.error('Failed to dispatch webhook circuit-breaker admin alert', { error: err });
    }
  }

  /**
   * Manually reset circuit breaker for a webhook
   * Useful for admin intervention after fixing underlying issues
   */
  async resetCircuitBreaker(webhookId: string): Promise<Webhook> {
    const webhook = await this.getWebhookById(webhookId);

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    if (!webhook.circuitBreakerOpen) {
      logger.warn(`Circuit breaker for webhook ${webhookId} is not open - nothing to reset`);
      return webhook;
    }

    webhook.circuitBreakerOpen = false;
    webhook.circuitOpenedAt = undefined;
    webhook.consecutiveFailures = 0;
    webhook.adminNotifiedOfFailure = false;
    webhook.adminNotifiedAt = undefined;
    webhook.status = WebhookStatus.ACTIVE;

    await this.webhookRepository.save(webhook);
    logger.info(`Circuit breaker manually reset for webhook ${webhookId}`);

    return webhook;
  }

  /**
   * Get all webhooks with open circuit breakers
   */
  async getWebhooksWithOpenCircuitBreakers(): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { circuitBreakerOpen: true },
      order: { circuitOpenedAt: 'DESC' },
    });
  }

  /**
   * Get circuit breaker statistics for an organization
   */
  async getCircuitBreakerStats(organizationId: string): Promise<{
    total: number;
    active: number;
    circuitOpen: number;
    recentFailures: number;
  }> {
    const webhooks = await this.getWebhooksByOrganization(organizationId);

    return {
      total: webhooks.length,
      active: webhooks.filter(w => w.enabled && !w.circuitBreakerOpen).length,
      circuitOpen: webhooks.filter(w => w.circuitBreakerOpen).length,
      recentFailures: webhooks.filter(w => w.consecutiveFailures > 0).length,
    };
  }
}

