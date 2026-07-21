import { Request, Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { ExternalIntegration, IntegrationType } from '../../models/ExternalIntegration';
import { StarCommsAccessService, StarCommsAdapter } from '../../services/communication/starcomms';
import { ExternalIntegrationService } from '../../services/external';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

export class StarCommsReadController extends BaseController {
  private readonly integrationService = new ExternalIntegrationService();
  private readonly accessService = new StarCommsAccessService();
  private readonly starCommsAdapter = new StarCommsAdapter();

  public getStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integration = await this.verifyStarCommsIntegration(req.params.integrationId, req);
      const config = this.starCommsAdapter.buildConnectionConfig(integration);
      return this.starCommsAdapter.getShardStatus(config);
    });
  };

  public getMetrics = async (req: Request, res: Response): Promise<void> => {
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

  private async verifyStarCommsIntegration(
    integrationId: string | undefined,
    req: Request | AuthRequest
  ): Promise<ExternalIntegration> {
    const normalizedId = this.requireUuid(integrationId, 'integrationId');
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      throw new ForbiddenError('Authentication is required for integration operations');
    }
    const orgId = this.getOrganizationIdFromRequest(req);

    const integration = await this.integrationService.getIntegrationById(normalizedId);
    if (!integration) {
      throw new NotFoundError('Integration');
    }

    if (integration.type !== IntegrationType.STARCOMMS) {
      throw new ValidationError('Integration is not configured as StarComms');
    }

    await this.accessService.ensureIntegrationAccess(userId, orgId, integration);

    return integration;
  }

  private getOrganizationIdFromRequest(req: Request | AuthRequest): string {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.currentOrganizationId;
    if (!orgId) {
      throw new ForbiddenError('Organization context is required for integration operations');
    }
    return orgId;
  }

  private requireUuid(value: string | undefined, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}`);
    }
    return value;
  }
}
