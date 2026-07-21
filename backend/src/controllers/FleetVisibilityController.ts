import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { FleetVisibilityService } from '../services/fleet/FleetVisibilityService';
import { BadRequestError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Controller for fleet visibility rule operations.
 * All methods require authenticated user with organization context.
 */
export class FleetVisibilityController extends BaseController {
  private readonly visibilityService = new FleetVisibilityService();

  constructor() {
    super();
  }

  private getOrgContext(req: AuthRequest): { userId: string; orgId: string } {
    const userId = req.user?.id;
    const orgId = req.tenantContext?.organizationId ?? req.user?.currentOrganizationId;
    if (!userId || !orgId) {
      throw new BadRequestError('Organization context is required');
    }
    return { userId, orgId };
  }

  /**
   * GET /fleets/:id/visibility-rules
   * List all visibility rules for a fleet.
   */
  public getRules = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      const fleetId = req.params.id;
      return this.visibilityService.getRulesForFleet(orgId, fleetId);
    });
  };

  /**
   * POST /fleets/:id/visibility-rules
   * Create a new visibility rule for a fleet.
   */
  public createRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const { orgId } = this.getOrgContext(req);
        const fleetId = req.params.id;
        return this.visibilityService.createRule(orgId, fleetId, req.body);
      },
      201
    );
  };

  /**
   * PUT /fleets/:id/visibility-rules/:ruleId
   * Update an existing visibility rule.
   */
  public updateRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      return this.visibilityService.updateRule(orgId, req.params.ruleId, req.body);
    });
  };

  /**
   * DELETE /fleets/:id/visibility-rules/:ruleId
   * Delete a visibility rule.
   */
  public deleteRule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { orgId } = this.getOrgContext(req);
      await this.visibilityService.deleteRule(orgId, req.params.ruleId);
      res.status(204).send();
    });
  };

  /**
   * POST /fleets/:id/check-access
   * Check the access level a requesting org has to this fleet.
   * Used by allied/federated orgs to verify visibility.
   */
  public checkAccess = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { userId, orgId } = this.getOrgContext(req);
      const fleetId = req.params.id;
      const { targetOrgId } = req.body;

      // Look up the requesting user's real security level from their org membership
      // instead of trusting client-provided values (authorization bypass prevention)
      const securityLevel = await this.visibilityService.getUserSecurityLevel(
        userId,
        targetOrgId ?? orgId
      );

      const accessLevel = await this.visibilityService.resolveAccessLevel(
        targetOrgId ?? orgId,
        orgId,
        fleetId,
        securityLevel
      );

      return { fleetId, accessLevel };
    });
  };
}
