import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { CargoManifestService } from '../services/fleet/CargoManifestService';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

const getRequestOrganizationId = (req: AuthRequest): string | null =>
  req.tenantContext?.organizationId || req.user?.currentOrganizationId || null;

/**
 * CargoManifestController - Handles cargo manifest management and tracking
 * Delegates business logic to CargoManifestService
 */
export class CargoManifestController extends BaseController {
  private readonly manifestService = new CargoManifestService();

  constructor() {
    super();
  }

  public createManifest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      const ownerId = req.user?.id;
      if (!ownerId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const manifest = await this.manifestService.create(req.body, organizationId, ownerId);
      res.status(201).json(manifest);
    });
  };

  public getManifests = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      const paginationOptions = extractPaginationOptions(req);
      return this.manifestService.findAll(paginationOptions, organizationId);
    });
  };

  public getManifestById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      return this.manifestService.findById(req.params.id, organizationId);
    });
  };

  public addCargoItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      return this.manifestService.addCargoItem(req.params.id, organizationId, req.body);
    });
  };

  public updateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      return this.manifestService.updateStatus(req.params.id, organizationId, req.body.status);
    });
  };

  public updateSharing = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = getRequestOrganizationId(req);
      if (!organizationId) {
        res.status(400).json({
          error: 'No active organization selected',
          message: 'Please select an organization to continue',
          requiresOrgSelection: true,
        });
        return;
      }

      return this.manifestService.updateSharing(req.params.id, organizationId, req.body);
    });
  };
}
