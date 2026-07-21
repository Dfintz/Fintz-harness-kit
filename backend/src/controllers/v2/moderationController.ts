import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { IncidentStatus, IncidentType } from '../../models/ModerationIncident';
import { BlacklistAnalyticsService } from '../../services/discord/BlacklistAnalyticsService';
import { BlacklistSharingService } from '../../services/discord/BlacklistSharingService';
import { ModerationIncidentService } from '../../services/discord/ModerationIncidentService';
import { BaseController } from '../BaseController';

/** Parse a string query param to an optional boolean */
function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

/**
 * Moderation Controller (v2)
 *
 * Wires the existing Discord moderation services to REST endpoints.
 * Provides full CRUD for incidents, analytics, user lookup, and sharing config.
 *
 * Sprint 26 — Wire stub routes to real services
 */
export class ModerationController extends BaseController {
  private readonly incidentService: ModerationIncidentService;
  private readonly analyticsService: BlacklistAnalyticsService;
  private readonly sharingService: BlacklistSharingService;

  constructor() {
    super();
    this.incidentService = ModerationIncidentService.getInstance();
    this.analyticsService = BlacklistAnalyticsService.getInstance();
    this.sharingService = BlacklistSharingService.getInstance();
  }

  // ==================== INCIDENTS CRUD ====================

  searchIncidents = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const {
        page,
        limit,
        targetDiscordId,
        guildId,
        incidentType,
        severity,
        status,
        minSeverity,
        isShared,
        searchTerm,
        sortBy,
        sortOrder,
      } = req.query as Record<string, string>;

      const pageNum = Number.parseInt(page) || 1;
      const pageSize = Math.min(Number.parseInt(limit) || 20, 100);

      const result = await this.incidentService.searchIncidents(
        organizationId,
        {
          targetDiscordId,
          guildId,
          incidentType: incidentType as IncidentType | undefined,
          severity: severity ? Number.parseInt(severity) : undefined,
          status: status as IncidentStatus | undefined,
          minSeverity: minSeverity ? Number.parseInt(minSeverity) : undefined,
          isShared: parseOptionalBoolean(isShared),
          searchTerm,
          sortBy: sortBy as 'createdAt' | 'severity' | 'incidentType' | undefined,
          sortOrder: sortOrder?.toLowerCase() as 'asc' | 'desc' | undefined,
        },
        pageNum,
        pageSize
      );

      res.json({
        success: true,
        data: result.incidents,
        pagination: {
          total: result.total,
          count: result.incidents.length,
          page: result.page,
          pageSize,
          hasMore: result.page < result.totalPages,
          totalPages: result.totalPages,
        },
      });
    });
  };

  getIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const incident = await this.incidentService.getIncidentById(
        organizationId,
        req.params.incidentId
      );

      if (!incident) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, data: incident });
    });
  };

  createIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const incident = await this.incidentService.createIncident(
        organizationId,
        user.id,
        user.username || 'Unknown',
        {
          guildId: req.body.guildId,
          guildName: req.body.guildName,
          targetDiscordId: req.body.targetDiscordId,
          targetUsername: req.body.targetUsername,
          incidentType: req.body.incidentType,
          reason: req.body.reason,
          durationMinutes: req.body.durationMinutes,
          isShared: req.body.isShared,
          metadata: req.body.metadata,
        }
      );

      res.status(201).json({ success: true, data: incident });
    });
  };

  updateIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const updated = await this.incidentService.updateIncident(
        organizationId,
        req.params.incidentId,
        user.id,
        user.username || 'Unknown',
        {
          reason: req.body.reason,
          isShared: req.body.isShared,
          metadata: req.body.metadata,
        }
      );

      if (!updated) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, data: updated });
    });
  };

  revokeIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const revoked = await this.incidentService.revokeIncident(
        organizationId,
        req.params.incidentId,
        user.id,
        user.username || 'Unknown',
        req.body.reason
      );

      if (!revoked) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, data: revoked });
    });
  };

  shareIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const shared = await this.incidentService.shareIncident(
        organizationId,
        req.params.incidentId,
        user.id,
        user.username || 'Unknown'
      );

      if (!shared) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, data: shared });
    });
  };

  unshareIncident = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const unshared = await this.incidentService.unshareIncident(
        organizationId,
        req.params.incidentId,
        user.id,
        user.username || 'Unknown'
      );

      if (!unshared) {
        res.status(404).json({ success: false, message: 'Incident not found' });
        return;
      }

      res.json({ success: true, data: unshared });
    });
  };

  // ==================== LOOKUP ====================

  lookupUser = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const includeShared = req.query.includeShared !== 'false';

      const summary = await this.incidentService.lookupUser(
        organizationId,
        req.params.discordId,
        includeShared
      );

      res.json({ success: true, data: summary });
    });
  };

  // ==================== ANALYTICS ====================

  getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const analytics = await this.analyticsService.getAnalytics(organizationId);
      res.json({ success: true, data: analytics });
    });
  };

  getRepeatOffenders = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const offenders = await this.analyticsService.getRepeatOffenders(organizationId);
      res.json({ success: true, data: offenders });
    });
  };

  getStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const statistics = await this.incidentService.getStatistics(organizationId);
      res.json({ success: true, data: statistics });
    });
  };

  // ==================== SHARING CONFIG ====================

  getSharingConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const config = await this.sharingService.getConfig(organizationId);
      res.json({ success: true, data: config });
    });
  };

  updateSharingConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const updated = await this.sharingService.updateConfig(
        organizationId,
        user.id,
        user.username || 'Unknown',
        req.body
      );

      res.json({ success: true, data: updated });
    });
  };
}
