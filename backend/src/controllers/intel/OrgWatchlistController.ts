/**
 * Org Watchlist Controller
 *
 * REST endpoints for managing external RSI organization watchlist entries.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase E)
 */
import type {
  CreateWatchlistEntryDto,
  ListWatchlistQuery,
  UpdateWatchlistEntryDto,
  WatchlistReason,
  WatchlistThreatLevel,
} from '@sc-fleet-manager/shared-types';
import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { OrgWatchlistService } from '../../services/intel/OrgWatchlistService';
import { BaseController } from '../BaseController';

export class OrgWatchlistController extends BaseController {
  private watchlistService: OrgWatchlistService | null = null;

  private getService(): OrgWatchlistService {
    this.watchlistService ??= new OrgWatchlistService();
    return this.watchlistService;
  }

  /* ─── GET /watchlist ───────────────────────────────────────────── */

  public listEntries = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      const query = req.query as unknown as ListWatchlistQuery;

      // Normalise array-or-single query params
      if (query.reasons && !Array.isArray(query.reasons)) {
        query.reasons = [query.reasons] as WatchlistReason[];
      }
      if (query.threatLevels && !Array.isArray(query.threatLevels)) {
        query.threatLevels = [query.threatLevels] as WatchlistThreatLevel[];
      }

      return this.getService().listEntries(orgId, query);
    });
  };

  /* ─── GET /watchlist/:entryId ──────────────────────────────────── */

  public getEntryById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, entryId } = req.params;
      const entry = await this.getService().getEntryById(orgId, entryId);
      if (!entry) {
        res.status(404).json({ error: 'Watchlist entry not found' });
        return null;
      }
      return entry;
    });
  };

  /* ─── POST /watchlist ──────────────────────────────────────────── */

  public createEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const user = this.getAuthUser(req);
        const { orgId } = req.params;
        const dto = req.body as CreateWatchlistEntryDto;
        return this.getService().createEntry(orgId, user.id, dto);
      },
      201
    );
  };

  /* ─── PATCH /watchlist/:entryId ────────────────────────────────── */

  public updateEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, entryId } = req.params;
      const dto = req.body as UpdateWatchlistEntryDto;
      return this.getService().updateEntry(orgId, entryId, dto);
    });
  };

  /* ─── DELETE /watchlist/:entryId ───────────────────────────────── */

  public deleteEntry = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, entryId } = req.params;
      const deleted = await this.getService().deleteEntry(orgId, entryId);
      if (!deleted) {
        res.status(404).json({ error: 'Watchlist entry not found' });
        return null;
      }
      return { success: true };
    });
  };
}
