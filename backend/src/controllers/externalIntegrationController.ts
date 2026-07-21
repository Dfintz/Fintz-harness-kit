import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  CreateIntegrationDto,
  ExternalIntegration,
  SyncRequest,
  UpdateIntegrationDto,
} from '../models/ExternalIntegration';
import { ExternalIntegrationService } from '../services/external';
import { FleetService } from '../services/fleet/FleetService';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { UrlValidationError, validateExternalIntegrationUrl } from '../utils/urlValidator';

import { BaseController } from './BaseController';

/**
 * Controller for external integrations
 * Extends BaseController for standardized error handling
 * All CRUD operations verify organization ownership through fleet→org relationship
 */
export class ExternalIntegrationController extends BaseController {
  private readonly integrationService = new ExternalIntegrationService();
  private readonly fleetService = new FleetService();

  constructor() {
    super();
  }

  /**
   * Get the current user's organization ID from the request
   * Overrides base class to accept Request | AuthRequest
   * Throws ForbiddenError if no organization context is available
   */
  protected override getOrganizationId(req: Request | AuthRequest): string {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.currentOrganizationId;
    if (!orgId) {
      throw new ForbiddenError('Organization context is required for integration operations');
    }
    return orgId;
  }

  /**
   * Verify that an integration belongs to the user's organization
   * Fetches the integration's fleet and verifies it belongs to the current organization
   * Prevents cross-tenant access by checking the fleet ownership
   * Returns the integration to avoid redundant DB calls in callers
   */
  private async verifyIntegrationOwnership(
    integrationId: string,
    req: Request | AuthRequest
  ): Promise<ExternalIntegration> {
    const orgId = this.getOrganizationId(req);
    const integration = await this.integrationService.getIntegrationById(integrationId);
    if (!integration) {
      // Don't leak cross-tenant resource existence
      throw new NotFoundError('Integration');
    }

    // Fetch the fleet to verify organization ownership
    // getFleetById already filters by organizationId, so if fleet is null, it's either
    // non-existent or belongs to another organization
    const fleet = await this.fleetService.getFleetById(orgId, integration.fleetId);
    if (!fleet) {
      // Don't leak that the integration exists in another organization
      throw new NotFoundError('Integration');
    }

    return integration;
  }

  /**
   * Create integration
   * POST /api/logistics/integrations
   */
  public createIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      this.getOrganizationId(req); // Verify org context
      const dto: CreateIntegrationDto = this.sanitizeIntegrationUrls(req.body);
      const integration = await this.integrationService.createIntegration(dto);
      res.status(201).json(integration);
    });
  };

  /**
   * Get integrations for a fleet
   * GET /api/logistics/integrations/fleet/:fleetId
   */
  public getIntegrations = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { fleetId } = req.params;
      const orgId = this.getOrganizationId(req);

      // Verify the fleet belongs to the user's organization
      // getFleetById already filters by organizationId
      const fleet = await this.fleetService.getFleetById(orgId, fleetId);
      if (!fleet) {
        // Don't leak that the fleet exists in another organization
        throw new NotFoundError('Fleet');
      }

      return this.integrationService.getIntegrations(fleetId);
    });
  };

  /**
   * Get integration by ID
   * GET /api/logistics/integrations/:id
   */
  public getIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      // verifyIntegrationOwnership now returns the integration, avoiding redundant DB call
      const integration = await this.verifyIntegrationOwnership(id, req);
      return integration;
    });
  };

  /**
   * Update integration
   * PATCH /api/logistics/integrations/:id
   */
  public updateIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      await this.verifyIntegrationOwnership(id, req);
      const dto: UpdateIntegrationDto = this.sanitizeIntegrationUrls(req.body);
      return this.integrationService.updateIntegration(id, dto);
    });
  };

  /**
   * Delete integration
   * DELETE /api/logistics/integrations/:id
   */
  public deleteIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id } = req.params;
      await this.verifyIntegrationOwnership(id, req);
      await this.integrationService.deleteIntegration(id);
      res.status(200).json({ message: 'Integration deleted successfully' });
    });
  };

  /**
   * Test integration connection
   * POST /api/logistics/integrations/:id/test
   */
  public testConnection = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'integration id');
      const integration = await this.verifyIntegrationOwnership(id, req);

      // CWE-918: SSRF prevention — validate stored URLs before outbound request
      if (integration.apiConfig?.baseUrl) {
        validateExternalIntegrationUrl(integration.apiConfig.baseUrl);
      }
      if (integration.webhookConfig?.url) {
        validateExternalIntegrationUrl(integration.webhookConfig.url);
      }

      // deepcode ignore Ssrf: URLs are validated via validateExternalIntegrationUrl()
      // both on storage (sanitizeIntegrationUrls) and immediately before this call.
      const result = await this.integrationService.testConnection(id);

      if (result.success) {
        res.status(200).json({
          message: 'Connection successful',
          success: true,
          responseTime: result.responseTime,
        });
      } else {
        res.status(400).json({
          message: 'Connection failed',
          success: false,
          error: result.error,
        });
      }
    });
  };

  /**
   * Sync inventory
   * POST /api/logistics/integrations/:id/sync
   */
  public syncInventory = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'integration id');
      const integration = await this.verifyIntegrationOwnership(id, req);

      // CWE-918: SSRF prevention — validate stored URLs before outbound request
      if (integration.apiConfig?.baseUrl) {
        validateExternalIntegrationUrl(integration.apiConfig.baseUrl);
      }
      if (integration.webhookConfig?.url) {
        validateExternalIntegrationUrl(integration.webhookConfig.url);
      }

      const syncRequest: SyncRequest = {
        integrationId: id,
        categories: req.body.categories,
        fullSync: req.body.fullSync || false,
        dryRun: req.body.dryRun || false,
      };

      // deepcode ignore Ssrf: URLs are validated via validateExternalIntegrationUrl()
      // on apiConfig.baseUrl and webhookConfig.url above before this call.
      // NOSONAR: CWE-918 false positive — SSRF prevention enforced via
      // validateExternalIntegrationUrl() on lines above (apiConfig.baseUrl, webhookConfig.url).
      return this.integrationService.syncInventory(syncRequest); // NOSONAR
    });
  };

  /**
   * Send webhook (test)
   * POST /api/logistics/integrations/:id/webhook
   */
  public sendWebhook = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const id = this.requireUuid(req.params.id, 'integration id');
      const integration = await this.verifyIntegrationOwnership(id, req);

      // CWE-918: SSRF prevention — validate stored URLs before outbound request
      if (integration.webhookConfig?.url) {
        validateExternalIntegrationUrl(integration.webhookConfig.url);
      }

      const { event, data } = req.body;

      // deepcode ignore Ssrf: webhookConfig.url is validated via
      // validateExternalIntegrationUrl() above before this call.
      // NOSONAR: CWE-918 false positive — SSRF prevention enforced via
      // validateExternalIntegrationUrl() on webhookConfig.url above.
      const result = await this.integrationService.sendWebhook(id, { event, data }); // NOSONAR

      if (result.success) {
        res.status(200).json({
          message: 'Webhook sent successfully',
          success: true,
          statusCode: result.statusCode,
        });
      } else {
        res.status(400).json({
          message: 'Webhook not sent',
          success: false,
          error: result.error,
        });
      }
    });
  };

  /**
   * Normalize and validate URLs on integration payloads to prevent SSRF
   */
  private sanitizeIntegrationUrls<T extends CreateIntegrationDto | UpdateIntegrationDto>(
    payload: T
  ): T {
    const normalizeUrl = (url?: string): string | undefined => {
      if (!url) {
        return url;
      }

      try {
        return validateExternalIntegrationUrl(url).toString();
      } catch (error) {
        if (error instanceof UrlValidationError) {
          throw new ValidationError(`Invalid integration URL: ${error.message}`);
        }
        throw error;
      }
    };

    const sanitized: T = { ...payload };

    if (sanitized.webhookConfig?.url) {
      sanitized.webhookConfig = {
        ...sanitized.webhookConfig,
        url: normalizeUrl(sanitized.webhookConfig.url) as string,
      };
    }

    if (sanitized.apiConfig) {
      const sanitizedEndpoints: Record<string, string | undefined> = {};
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

  private requireUuid(value: string | undefined, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}`);
    }
    return value;
  }
}
