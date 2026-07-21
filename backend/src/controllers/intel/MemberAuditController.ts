/**
 * Member Audit Controller
 *
 * REST endpoints for member audit flags — list, create (manual),
 * resolve, and per-user stats.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase E)
 */
import type {
  CreateManualFlagDto,
  FlagSeverity,
  FlagStatus,
  ListFlagsQuery,
  MemberFlagType,
  ResolveFlagDto,
} from '@sc-fleet-manager/shared-types';
import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { MemberAuditService } from '../../services/intel/MemberAuditService';
import { BaseController } from '../BaseController';

export class MemberAuditController extends BaseController {
  private auditService: MemberAuditService | null = null;

  private getService(): MemberAuditService {
    this.auditService ??= new MemberAuditService();
    return this.auditService;
  }

  /* ─── GET /flags ───────────────────────────────────────────────── */

  public listFlags = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      const query = req.query as unknown as ListFlagsQuery;

      // Normalise array-or-single query params
      if (query.flagTypes && !Array.isArray(query.flagTypes)) {
        query.flagTypes = [query.flagTypes] as MemberFlagType[];
      }
      if (query.severities && !Array.isArray(query.severities)) {
        query.severities = [query.severities] as FlagSeverity[];
      }
      if (query.statuses && !Array.isArray(query.statuses)) {
        query.statuses = [query.statuses] as FlagStatus[];
      }

      return this.getService().listFlags(orgId, query);
    });
  };

  /* ─── GET /flags/:flagId ───────────────────────────────────────── */

  public getFlagById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, flagId } = req.params;
      const flag = await this.getService().getFlagById(orgId, flagId);
      if (!flag) {
        res.status(404).json({ error: 'Flag not found' });
        return null;
      }
      return flag;
    });
  };

  /* ─── POST /flags ──────────────────────────────────────────────── */

  public createManualFlag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const user = this.getAuthUser(req);
        const { orgId } = req.params;
        const dto = req.body as CreateManualFlagDto;
        const flag = await this.getService().createManualFlag(orgId, dto.userId, user.id, dto);
        return this.getService().toSummary(flag);
      },
      201
    );
  };

  /* ─── PATCH /flags/:flagId/resolve ─────────────────────────────── */

  public resolveFlag = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const user = this.getAuthUser(req);
      const { orgId, flagId } = req.params;
      const dto = req.body as ResolveFlagDto;
      const flag = await this.getService().resolveFlag(orgId, flagId, user.id, dto);
      return this.getService().toSummary(flag);
    });
  };

  /* ─── GET /flags/stats/:userId ─────────────────────────────────── */

  public getUserFlagStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, userId } = req.params;
      return this.getService().getUserFlagStats(orgId, userId);
    });
  };
}
