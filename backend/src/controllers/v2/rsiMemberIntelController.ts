/**
 * RSI Member Intel Controller
 *
 * Handles member intelligence endpoints for RSI Sync Enhancements (Wave 3.3).
 * Provides composite member views, enrichment, audit, and role validation.
 */

import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import {
  RsiMemberIntelService,
  rsiMemberIntelService,
} from '../../services/external/RsiMemberIntelService';
import { NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { BaseController } from '../BaseController';

interface ManualLinkBody {
  userId: string;
  discordUserId?: string;
}

export class RsiMemberIntelController extends BaseController {
  private readonly intelService: RsiMemberIntelService;

  constructor() {
    super();
    this.intelService = rsiMemberIntelService;
  }

  /**
   * GET /api/v2/rsi/members/:orgId/intel
   * List all RSI members with intel summary
   */
  public listMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;
      const result = await this.intelService.getMemberList(organizationId);
      return { members: result.members, count: result.members.length, status: result.status };
    });
  };

  /**
   * GET /api/v2/rsi/members/:orgId/intel/:rsiHandle
   * Get full member intel card
   */
  public getMemberCard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, rsiHandle } = req.params;
      const card = await this.intelService.getMemberCard(orgId, rsiHandle);
      if (!card) {
        throw new NotFoundError('Member not found in RSI org data');
      }
      return card;
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/:rsiHandle/enrich
   * Trigger enrichment for a single member
   */
  public enrichMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, rsiHandle } = req.params;

      logger.info('Manual member enrichment triggered', {
        organizationId: orgId,
        rsiHandle,
        triggeredBy: req.user?.id,
      });

      return this.intelService.enrichMember(orgId, rsiHandle);
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/enrich-all
   * Batch enrich all members in org
   */
  public enrichAll = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;

      logger.info('Batch member enrichment triggered', {
        organizationId,
        triggeredBy: req.user?.id,
      });

      return this.intelService.enrichOrganizationMembers(organizationId);
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/audit
   * Run member audit checks
   */
  public runAudit = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;
      const guildId = req.body?.guildId;

      logger.info('Member audit triggered', {
        organizationId,
        guildId,
        triggeredBy: req.user?.id,
      });

      return this.intelService.runMemberAudit(organizationId, guildId);
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/validate-roles
   * Validate role mappings
   */
  public validateRoles = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;
      const guildId = req.body?.guildId;

      logger.info('Role mapping validation triggered', {
        organizationId,
        guildId,
        triggeredBy: req.user?.id,
      });

      return this.intelService.validateRoleMappings(organizationId, guildId);
    });
  };

  /**
   * GET /api/v2/rsi/members/:orgId/intel/link-candidates
   * Suggest platform users who can be linked to an RSI member
   */
  public suggestLinkCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;
      const query = typeof req.query.q === 'string' ? req.query.q : undefined;
      return this.intelService.suggestLinkCandidates(organizationId, query);
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/:rsiHandle/link
   * Manually link an RSI member to a platform user
   */
  public manualLink = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, rsiHandle } = req.params;
      const body = req.body as ManualLinkBody;
      const performedBy = req.user?.id ?? 'unknown';

      logger.info('Manual RSI link requested', {
        organizationId: orgId,
        rsiHandle,
        targetUserId: body.userId,
        triggeredBy: performedBy,
      });

      return this.intelService.manualLink(orgId, rsiHandle, body, performedBy);
    });
  };

  /**
   * DELETE /api/v2/rsi/members/:orgId/intel/:rsiHandle/link
   * Remove the link between an RSI member and a platform user
   */
  public unlinkMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, rsiHandle } = req.params;
      const performedBy = req.user?.id ?? 'unknown';

      logger.info('Manual RSI unlink requested', {
        organizationId: orgId,
        rsiHandle,
        triggeredBy: performedBy,
      });

      return this.intelService.unlinkMember(orgId, rsiHandle, performedBy);
    });
  };

  /**
   * POST /api/v2/rsi/members/:orgId/intel/clear-cache
   * Clear all cached RSI data for the organization
   */
  public clearCache = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const organizationId = req.params.orgId;
      const performedBy = req.user?.id ?? 'unknown';

      logger.info('RSI cache clear requested', {
        organizationId,
        triggeredBy: performedBy,
      });

      return this.intelService.clearCache(organizationId, performedBy);
    });
  };
}
