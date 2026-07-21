import { Request, Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import {
  CreateIntegrationDto,
  ExternalIntegration,
  IntegrationType,
  SyncLog,
  SyncRequest,
  UpdateIntegrationDto,
} from '../../models/ExternalIntegration';
import { ExternalIntegrationService } from '../../services/external';
import { FleetService } from '../../services/fleet/FleetService';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

export class IntegrationsV2Controller extends BaseController {
  private readonly integrationService = new ExternalIntegrationService();
  private readonly fleetService = new FleetService();

  public listIntegrations = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const orgId = this.getOrganizationIdFromRequest(req);
      const fleetId = this.requireUuid(req.query.fleetId as string | undefined, 'fleetId');

      const fleet = await this.fleetService.getFleetById(orgId, fleetId);
      if (!fleet) {
        throw new NotFoundError('Fleet');
      }

      const typeFilter = req.query.type as IntegrationType | undefined;
      const integrations = await this.integrationService.getIntegrations(fleetId);

      return integrations.filter(integration =>
        typeFilter ? integration.type === typeFilter : true
      );
    });
  };

  public createIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const orgId = this.getOrganizationIdFromRequest(req);
        const dto = req.body as CreateIntegrationDto;

        const fleet = await this.fleetService.getFleetById(orgId, dto.fleetId);
        if (!fleet) {
          throw new NotFoundError('Fleet');
        }

        dto.createdBy = this.getUserId(req);
        const integration = await this.integrationService.createIntegration(dto);
        return integration;
      },
      201
    );
  };

  public getIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integration = await this.verifyIntegrationOwnership(req.params.integrationId, req);
      return integration;
    });
  };

  public updateIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
      await this.verifyIntegrationOwnership(integrationId, req);
      const dto = req.body as UpdateIntegrationDto;
      return this.integrationService.updateIntegration(integrationId, dto);
    });
  };

  public deleteIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
      await this.verifyIntegrationOwnership(integrationId, req);
      await this.integrationService.deleteIntegration(integrationId);
      res.status(200).json({ message: 'Integration deleted successfully' });
    });
  };

  public testConnection = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
      await this.verifyIntegrationOwnership(integrationId, req);
      return this.integrationService.testConnection(integrationId);
    });
  };

  public syncIntegration = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integrationId = this.requireUuid(req.params.integrationId, 'integrationId');
      await this.verifyIntegrationOwnership(integrationId, req);

      const syncRequest: SyncRequest = {
        integrationId,
        categories: req.body.categories,
        fullSync: req.body.fullSync || false,
        dryRun: req.body.dryRun || false,
      };

      return this.integrationService.syncInventory(syncRequest);
    });
  };

  public getLogs = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const integration = await this.verifyIntegrationOwnership(req.params.integrationId, req);
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
      const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

      return (integration.syncHistory || []).filter((log: SyncLog) => {
        if (startDate && log.timestamp < startDate) {
          return false;
        }
        if (endDate && log.timestamp > endDate) {
          return false;
        }
        return true;
      });
    });
  };

  public getAvailableIntegrationTypes = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      types: Object.values(IntegrationType),
    });
  };

  private async verifyIntegrationOwnership(
    integrationId: string | undefined,
    req: Request | AuthRequest
  ): Promise<ExternalIntegration> {
    const normalizedId = this.requireUuid(integrationId, 'integrationId');
    const orgId = this.getOrganizationIdFromRequest(req);
    const integration = await this.integrationService.getIntegrationById(normalizedId);
    if (!integration) {
      throw new NotFoundError('Integration');
    }

    const fleet = await this.fleetService.getFleetById(orgId, integration.fleetId);
    if (!fleet) {
      throw new NotFoundError('Integration');
    }

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

  private getUserId(req: Request | AuthRequest): string {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id;
    if (!userId) {
      throw new ForbiddenError('Authentication required');
    }
    return userId;
  }

  private requireUuid(value: string | undefined, fieldName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      throw new ValidationError(`Invalid ${fieldName}`);
    }
    return value;
  }
}
