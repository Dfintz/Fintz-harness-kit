import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { CreateWebhookDto, UpdateWebhookDto, Webhook, WebhookEventType } from '../models/Webhook';
import { WebhookService } from '../services/communication/webhooks/WebhookService';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { sanitizeObject } from '../utils/prototypePollutionPrevention';
import { UrlValidationError, validateWebhookUrl } from '../utils/urlValidator';

import { BaseController } from './BaseController';

/**
 * Controller for webhook management
 * Extends BaseController for standardized error handling
 */
export class WebhookController extends BaseController {
  private readonly webhookService = new WebhookService();

  constructor() {
    super();
  }

  /**
   * Validate webhook configuration without creating it
   * POST /api/webhooks/validate
   */
  public validateWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);

      const dto = {
        ...this.sanitizeWebhookPayload<CreateWebhookDto>(req.body),
        createdBy: user.id,
      };

      // Validate the webhook configuration
      const validation = await this.webhookService.testWebhookConfig(organizationId, dto);

      res.status(200).json(validation);
    });
  };

  /**
   * Create a new webhook
   * POST /api/webhooks
   */
  public createWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);

      const dto = {
        ...this.sanitizeWebhookPayload<CreateWebhookDto>(req.body),
        createdBy: user.id,
      };

      const webhook = await this.webhookService.createWebhook(organizationId, dto);
      res.status(201).json(webhook);
    });
  };

  /**
   * Get all webhooks for the current organization
   * GET /api/webhooks
   */
  public getWebhooks = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      return this.webhookService.getWebhooksByOrganization(organizationId);
    });
  };

  /**
   * Get a specific webhook by ID
   * GET /api/webhooks/:id
   */
  public getWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const organizationId = this.getOrganizationId(req);

      const webhook = await this.webhookService.getWebhookById(id);

      if (!webhook) {
        throw new NotFoundError('Webhook');
      }

      // Ensure webhook belongs to the user's organization
      if (webhook.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      return webhook;
    });
  };

  /**
   * Update a webhook
   * PATCH /api/webhooks/:id
   */
  public updateWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const organizationId = this.getOrganizationId(req);

      // Verify ownership
      const existing = await this.webhookService.getWebhookById(id);
      if (!existing) {
        throw new NotFoundError('Webhook');
      }

      if (existing.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      const dto: UpdateWebhookDto = this.sanitizeWebhookPayload<UpdateWebhookDto>(req.body);
      return this.webhookService.updateWebhook(id, dto);
    });
  };

  /**
   * Delete a webhook
   * DELETE /api/webhooks/:id
   */
  public deleteWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'webhook id');
      const organizationId = this.getOrganizationId(req);

      // Verify ownership
      const existing = await this.webhookService.getWebhookById(id);
      if (!existing) {
        throw new NotFoundError('Webhook');
      }

      if (existing.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      await this.webhookService.deleteWebhook(id);
      res.status(200).json({ message: 'Webhook deleted successfully' });
    });
  };

  /**
   * Test a webhook
   * POST /api/webhooks/:id/test
   */
  public testWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'webhook id');
      const organizationId = this.getOrganizationId(req);

      // Verify ownership
      const existing = await this.webhookService.getWebhookById(id);
      if (!existing) {
        throw new NotFoundError('Webhook');
      }

      if (existing.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      // CWE-918: SSRF prevention — validate and sanitize URLs before outbound request
      if (existing.customConfig?.url) {
        existing.customConfig.url = validateWebhookUrl(existing.customConfig.url).toString();
      }
      if (existing.discordConfig?.webhookUrl) {
        existing.discordConfig.webhookUrl = validateWebhookUrl(
          existing.discordConfig.webhookUrl
        ).toString();
      }

      // deepcode ignore Ssrf: customConfig.url and discordConfig.webhookUrl validated
      // via validateWebhookUrl() above before this call.
      // NOSONAR: CWE-918 false positive — SSRF prevention enforced via
      // validateWebhookUrl() on lines above (customConfig.url, discordConfig.webhookUrl).
      const result = await this.webhookService.testWebhook(existing); // NOSONAR

      if (result.success) {
        res.status(200).json({
          message: 'Webhook test successful',
          success: true,
          responseTime: result.responseTime,
          statusCode: result.statusCode,
        });
      } else {
        res.status(400).json({
          message: 'Webhook test failed',
          success: false,
          error: result.error,
        });
      }
    });
  };

  /**
   * Trigger a test event
   * POST /api/webhooks/trigger-event
   */
  public triggerEvent = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { data } = req.body as { data?: Record<string, unknown> };
      const event = this.parseWebhookEvent((req.body as { event?: unknown }).event);

      // CWE-918: Validate all webhook destination URLs before triggering (SSRF prevention)
      const webhooks = await this.webhookService.getWebhooksByOrganization(organizationId);
      for (const webhook of webhooks) {
        if (webhook.customConfig?.url) {
          webhook.customConfig.url = validateWebhookUrl(webhook.customConfig.url).toString();
        }
        if (webhook.discordConfig?.webhookUrl) {
          webhook.discordConfig.webhookUrl = validateWebhookUrl(
            webhook.discordConfig.webhookUrl
          ).toString();
        }
      }

      // deepcode ignore Ssrf: all webhook destination URLs validated via
      // validateWebhookUrl() in the loop above before this call.
      // NOSONAR: CWE-918 false positive — all webhook destination URLs validated
      // via validateWebhookUrl() in the loop above (customConfig.url, discordConfig.webhookUrl).
      return this.webhookService.triggerEvent(
        // NOSONAR
        organizationId,
        event,
        data || {}
      );
    });
  };

  /**
   * Get webhook statistics for the organization
   * GET /api/webhooks/statistics
   */
  public getStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      return this.webhookService.getStatistics(organizationId);
    });
  };

  /**
   * Get webhook delivery history
   * GET /api/webhooks/:id/deliveries
   */
  public getDeliveryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const organizationId = this.getOrganizationId(req);

      const webhook = await this.webhookService.getWebhookById(id);

      if (!webhook) {
        throw new NotFoundError('Webhook');
      }

      if (webhook.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      // Parse pagination params
      const { page, limit, offset } = this.getPaginationParams(req as Request);

      const deliveries = webhook.deliveryHistory;
      const paginatedDeliveries = deliveries.slice(offset, offset + limit);

      return this.createPaginatedResponse(paginatedDeliveries, deliveries.length, page, limit);
    });
  };

  /**
   * Get available event types
   * GET /api/webhooks/event-types
   */
  public getEventTypes = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      Object.values(WebhookEventType).map(event => ({
        value: event,
        label: this.formatEventLabel(event),
        category: this.getEventCategory(event),
      }))
    );
  };

  /**
   * Format event type to human-readable label
   */
  private formatEventLabel(event: string): string {
    return event
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  /**
   * Get event category from event type
   */
  private getEventCategory(event: string): string {
    const [category] = event.split('.');
    return category;
  }

  private requireUuid(value: string | undefined, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}`);
    }
    return value;
  }

  private parseWebhookEvent(value: unknown): WebhookEventType {
    if (typeof value !== 'string') {
      throw new ValidationError('Invalid event type');
    }

    const normalizedEventMap: Record<string, WebhookEventType> = {
      [WebhookEventType.FLEET_CREATED]: WebhookEventType.FLEET_CREATED,
      [WebhookEventType.FLEET_UPDATED]: WebhookEventType.FLEET_UPDATED,
      [WebhookEventType.FLEET_DELETED]: WebhookEventType.FLEET_DELETED,
      [WebhookEventType.FLEET_MEMBER_JOINED]: WebhookEventType.FLEET_MEMBER_JOINED,
      [WebhookEventType.FLEET_MEMBER_LEFT]: WebhookEventType.FLEET_MEMBER_LEFT,
      [WebhookEventType.MEMBER_JOINED]: WebhookEventType.MEMBER_JOINED,
      [WebhookEventType.MEMBER_LEFT]: WebhookEventType.MEMBER_LEFT,
      [WebhookEventType.MEMBER_ROLE_CHANGED]: WebhookEventType.MEMBER_ROLE_CHANGED,
      [WebhookEventType.ACTIVITY_CREATED]: WebhookEventType.ACTIVITY_CREATED,
      [WebhookEventType.ACTIVITY_STARTED]: WebhookEventType.ACTIVITY_STARTED,
      [WebhookEventType.ACTIVITY_COMPLETED]: WebhookEventType.ACTIVITY_COMPLETED,
      [WebhookEventType.ACTIVITY_CANCELLED]: WebhookEventType.ACTIVITY_CANCELLED,
      [WebhookEventType.ACTIVITY_PARTICIPANT_JOINED]: WebhookEventType.ACTIVITY_PARTICIPANT_JOINED,
      [WebhookEventType.ACTIVITY_PARTICIPANT_LEFT]: WebhookEventType.ACTIVITY_PARTICIPANT_LEFT,
      [WebhookEventType.ALERT_CREATED]: WebhookEventType.ALERT_CREATED,
      [WebhookEventType.ALERT_RESOLVED]: WebhookEventType.ALERT_RESOLVED,
      [WebhookEventType.SHIP_ADDED]: WebhookEventType.SHIP_ADDED,
      [WebhookEventType.SHIP_REMOVED]: WebhookEventType.SHIP_REMOVED,
      [WebhookEventType.SHIP_TRANSFERRED]: WebhookEventType.SHIP_TRANSFERRED,
      [WebhookEventType.BATCH]: WebhookEventType.BATCH,
    };

    const parsedEvent = normalizedEventMap[value];
    if (!parsedEvent) {
      throw new ValidationError('Invalid event type');
    }

    return parsedEvent;
  }

  /**
   * Sanitize webhook payload and validate destinations to prevent SSRF
   */
  private sanitizeWebhookPayload<T extends CreateWebhookDto | UpdateWebhookDto>(
    payload: unknown
  ): T {
    const safeBody = sanitizeObject(payload as Record<string, unknown>, [
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
    ]) as T & {
      customConfig?: { url?: string; method?: string; headers?: Record<string, string> };
      discordConfig?: { webhookUrl?: string; avatarUrl?: string; threadId?: string };
    };

    const sanitized: T = { ...safeBody };

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

  /**
   * Validate destination URL to prevent SSRF and normalize it
   */
  private validateWebhookDestination(url: string): string {
    try {
      return validateWebhookUrl(url).toString();
    } catch (error) {
      if (error instanceof UrlValidationError) {
        throw new ValidationError(`Invalid webhook URL: ${error.message}`);
      }
      throw error;
    }
  }

  private assertStoredWebhookDestination(webhook: Webhook): void {
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

  // ==================== ENHANCED TESTING ENDPOINTS ====================

  /**
   * Test a webhook with custom payload
   * POST /api/webhooks/:id/test-custom
   */
  public testWebhookCustom = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'webhook id');
      const organizationId = this.getOrganizationId(req);

      // Verify ownership
      const existing = await this.webhookService.getWebhookById(id);
      if (!existing) {
        throw new NotFoundError('Webhook');
      }

      if (existing.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      // CWE-918: SSRF prevention — validate and sanitize URLs before outbound request
      if (existing.customConfig?.url) {
        existing.customConfig.url = validateWebhookUrl(existing.customConfig.url).toString();
      }
      if (existing.discordConfig?.webhookUrl) {
        existing.discordConfig.webhookUrl = validateWebhookUrl(
          existing.discordConfig.webhookUrl
        ).toString();
      }

      const { event, data, includeSignature } = req.body as {
        event?: string;
        data?: Record<string, unknown>;
        includeSignature?: boolean;
      };

      const parsedEvent = event ? this.parseWebhookEvent(event) : undefined;

      // deepcode ignore Ssrf: customConfig.url and discordConfig.webhookUrl validated
      // via validateWebhookUrl() above before this call.
      // NOSONAR: CWE-918 false positive — SSRF prevention enforced via
      // validateWebhookUrl() on lines above (customConfig.url, discordConfig.webhookUrl).
      const result = await this.webhookService.testWebhookWithPayload(existing, {
        // NOSONAR
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
      } else {
        res.status(400).json({
          message: 'Custom test webhook delivery failed',
          success: false,
          error: result.error,
          payload: result.payload,
        });
      }
    });
  };

  /**
   * Get test payload preview
   * POST /api/webhooks/:id/preview
   */
  public getPayloadPreview = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'webhook id');
      const organizationId = this.getOrganizationId(req);

      // Verify ownership
      const existing = await this.webhookService.getWebhookById(id);
      if (!existing) {
        throw new NotFoundError('Webhook');
      }

      if (existing.organizationId !== organizationId) {
        throw new ForbiddenError('Access denied');
      }

      this.assertStoredWebhookDestination(existing);

      const { event, data } = req.body as {
        event?: string;
        data?: Record<string, unknown>;
      };

      const parsedEvent = event ? this.parseWebhookEvent(event) : undefined;

      return this.webhookService.getTestPayloadPreview(id, {
        event: parsedEvent,
        data,
      });
    });
  };

  // ==================== BATCHING ENDPOINTS ====================

  /**
   * Get batch configuration
   * GET /api/webhooks/batch/config
   */
  public getBatchConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => this.webhookService.getBatchConfig());
  };

  /**
   * Configure batch settings (admin only)
   * PUT /api/webhooks/batch/config
   */
  public configureBatch = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { maxBatchSize, maxWaitTimeMs, enabled } = req.body as {
        maxBatchSize?: number;
        maxWaitTimeMs?: number;
        enabled?: boolean;
      };

      this.webhookService.configureBatching({ maxBatchSize, maxWaitTimeMs, enabled });
      res.status(200).json({
        message: 'Batch configuration updated',
        config: this.webhookService.getBatchConfig(),
      });
    });
  };

  /**
   * Queue an event for batch delivery
   * POST /api/webhooks/batch/queue
   */
  public queueEventForBatch = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { data } = req.body as { data?: Record<string, unknown> };
      const event = this.parseWebhookEvent((req.body as { event?: unknown }).event);

      // CWE-918: Validate all webhook destination URLs before queueing (SSRF prevention)
      const webhooks = await this.webhookService.getWebhooksByOrganization(organizationId);
      for (const webhook of webhooks) {
        if (webhook.customConfig?.url) {
          webhook.customConfig.url = validateWebhookUrl(webhook.customConfig.url).toString();
        }
        if (webhook.discordConfig?.webhookUrl) {
          webhook.discordConfig.webhookUrl = validateWebhookUrl(
            webhook.discordConfig.webhookUrl
          ).toString();
        }
      }

      // deepcode ignore Ssrf: all webhook destination URLs validated via
      // validateWebhookUrl() in the loop above before this call.
      // NOSONAR: CWE-918 false positive — all webhook destination URLs validated
      // via validateWebhookUrl() in the loop above (customConfig.url, discordConfig.webhookUrl).
      return this.webhookService.queueEventForBatch(
        // NOSONAR
        organizationId,
        event,
        data || {}
      );
    });
  };

  /**
   * Get pending batches
   * GET /api/webhooks/batch/pending
   */
  public getPendingBatches = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      return this.webhookService.getPendingBatches(organizationId);
    });
  };

  /**
   * Flush all pending batches
   * POST /api/webhooks/batch/flush
   */
  public flushBatches = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { webhookId } = req.body as { webhookId?: string };

      if (webhookId) {
        // Verify webhook ownership
        const webhook = await this.webhookService.getWebhookById(webhookId);
        if (!webhook) {
          throw new NotFoundError('Webhook');
        }
        if (webhook.organizationId !== organizationId) {
          throw new ForbiddenError('Access denied');
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

  /**
   * Cancel pending batches
   * DELETE /api/webhooks/batch/pending
   */
  public cancelPendingBatches = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { webhookId } = req.query as { webhookId?: string };

      if (webhookId) {
        // Verify webhook ownership
        const webhook = await this.webhookService.getWebhookById(webhookId);
        if (!webhook) {
          throw new NotFoundError('Webhook');
        }
        if (webhook.organizationId !== organizationId) {
          throw new ForbiddenError('Access denied');
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
