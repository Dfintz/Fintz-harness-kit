import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { AllianceDiplomacyService } from '../services/organization/AllianceDiplomacyService';
import { BadRequestError } from '../utils/apiErrors';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * Controller for alliance diplomacy operations
 * Delegates business logic to AllianceDiplomacyService
 * All methods require authenticated user with organization context
 */
export class AllianceDiplomacyController extends BaseController {
  private readonly diplomacyService = new AllianceDiplomacyService();

  constructor() {
    super();
  }

  private getOrgContext(req: AuthRequest): { userId: string; orgId: string } {
    const userId = req.user?.id;
    const orgId = req.user?.currentOrganizationId;
    if (!userId || !orgId) {
      throw new BadRequestError('Organization context is required');
    }
    return { userId, orgId };
  }

  public proposeDiplomacy = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const { userId, orgId } = this.getOrgContext(req);
        const { targetOrgId, allianceType, notes } = req.body;

        return this.diplomacyService.propose({
          orgId1: orgId,
          orgId2: targetOrgId,
          allianceType,
          proposedBy: userId,
          notes,
        });
      },
      201
    );
  };

  public getDiplomacyRelations = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      const paginationOptions = extractPaginationOptions(req);
      return this.diplomacyService.findAll(orgId, paginationOptions);
    });
  };

  public getDiplomacyById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.diplomacyService.findById(req.params.id, orgId);
    });
  };

  public approveDiplomacy = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId, orgId } = this.getOrgContext(req);
      return this.diplomacyService.approve(req.params.id, orgId, userId);
    });
  };

  public suspendDiplomacy = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.diplomacyService.suspend(req.params.id, orgId);
    });
  };

  public terminateDiplomacy = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.diplomacyService.terminate(req.params.id, orgId);
    });
  };

  public reportIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId, orgId } = this.getOrgContext(req);
      const reportedBy = (req.body.reportedBy as string | undefined) ?? userId;
      return this.diplomacyService.reportIncident(req.params.id, orgId, {
        description: req.body.description as string,
        severity: req.body.severity as 'low' | 'medium' | 'high' | 'critical',
        reportedBy,
      });
    });
  };

  public resolveIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.diplomacyService.resolveIncident(req.params.id, orgId, req.params.incidentId);
    });
  };
}
