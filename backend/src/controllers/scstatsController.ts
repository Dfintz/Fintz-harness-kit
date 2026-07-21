import { Request, Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { SCStatsOrgAnalyticsService } from '../services/analytics/SCStatsOrgAnalyticsService';
import { PublicOrgDirectoryService } from '../services/organization/PublicOrgDirectoryService';
import { SCStatsCsvImportService } from '../services/user/SCStatsCsvImportService';
import { SCStatsImportService } from '../services/user/SCStatsImportService';
import { SCStatsLogImportService } from '../services/user/SCStatsLogImportService';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * SCStatsController
 *
 * Wave 2.5 — SCStats Integration
 *
 * Handles SCStats JSON/CSV import, retrieval, GDPR deletion, and org analytics.
 * Import/delete endpoints verify user ownership. Get endpoint allows any
 * authenticated user to view public metrics. Org analytics requires membership.
 */
class SCStatsController extends BaseController {
  private readonly importService: SCStatsImportService;
  private readonly csvImportService: SCStatsCsvImportService;
  private readonly logImportService: SCStatsLogImportService;
  private readonly orgAnalyticsService: SCStatsOrgAnalyticsService;
  private readonly directoryService: PublicOrgDirectoryService;

  constructor() {
    super();
    this.importService = new SCStatsImportService();
    this.csvImportService = new SCStatsCsvImportService();
    this.logImportService = new SCStatsLogImportService();
    this.orgAnalyticsService = new SCStatsOrgAnalyticsService();
    this.directoryService = new PublicOrgDirectoryService();
  }

  /**
   * POST /api/v2/scstats/users/:userId/import
   * Import SCStats JSON export
   */
  async importSCStats(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userId } = req.params;

      // Verify user is updating their own profile
      if (user.id !== userId) {
        throw new UnauthorizedError('Cannot import SCStats data for another user');
      }

      const file = req.file;
      const body = req.body as Record<string, unknown>;
      const consent = body.consent === 'true' || body.consent === true;

      if (!file) {
        throw new ValidationError('JSON file is required');
      }

      if (!consent) {
        throw new ValidationError('Consent is required to import SCStats data');
      }

      // Security: validate file content before processing
      const jsonData = file.buffer.toString('utf-8');

      // Reject excessively large JSON strings (defense-in-depth beyond multer limit)
      if (jsonData.length > 5 * 1024 * 1024) {
        throw new ValidationError('JSON content exceeds maximum allowed size (5MB)');
      }

      // Reject files that contain non-JSON content (e.g. HTML, scripts)
      const trimmed = jsonData.trimStart();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        throw new ValidationError('File does not contain valid JSON');
      }

      const preferences = await this.importService.importData(userId, jsonData, consent);

      logger.info('SCStats data imported via API', { userId });

      res.status(200).json({
        success: true,
        data: {
          message: 'SCStats data imported successfully',
          imported: {
            totalHours: preferences.scstatsTotalHours,
            kdRatio: preferences.scstatsKdRatio,
            missionsCompleted: preferences.scstatsMissionsCompleted,
            favoriteVehicle: preferences.scstatsFavoriteVehicle,
          },
          lastImport: preferences.scstatsLastImport,
        },
      });
    });
  }

  /**
   * GET /api/v2/scstats/users/:userId
   * Get SCStats data for user
   */
  async getSCStats(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      this.getAuthUser(req);
      const { userId } = req.params;

      const data = await this.importService.getData(userId);
      res.status(200).json({
        success: true,
        data,
      });
    });
  }

  /**
   * DELETE /api/v2/scstats/users/:userId
   * Delete SCStats data (GDPR)
   */
  async deleteSCStats(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userId } = req.params;

      // Verify user is deleting their own data
      if (user.id !== userId) {
        throw new UnauthorizedError('Cannot delete SCStats data for another user');
      }

      await this.importService.deleteData(userId);

      logger.info('SCStats data deleted via API', { userId });

      res.status(200).json({
        success: true,
        data: {
          message: 'SCStats data deleted successfully',
        },
      });
    });
  }

  /**
   * GET /api/v2/scstats/organizations/:organizationId/analytics
   * Get org-level SCStats analytics (members only)
   */
  async getOrgAnalytics(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { organizationId } = req.params;

      // Verify user is a member of the organization
      this.verifyOrganizationMembership(req, organizationId);

      const analytics = await this.orgAnalyticsService.getOrgAnalytics(organizationId);
      res.status(200).json({
        success: true,
        data: analytics,
      });
    });
  }

  /**
   * GET /api/v2/scstats/organizations/:organizationId/analytics/public
   * Get org-level SCStats analytics (public — only if org profile isPublic)
   */
  async getPublicOrgAnalytics(req: Request, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const { organizationId } = req.params;

      // Check if the organization has a public profile
      const profile = await this.directoryService.getOrCreateProfile(organizationId);

      if (!profile?.isPublic) {
        throw new NotFoundError('Organization stats are not publicly available');
      }

      const analytics = await this.orgAnalyticsService.getOrgAnalytics(organizationId);

      // For public view, strip individual user IDs from top performers for privacy
      const sanitizedAnalytics = {
        ...analytics,
        topPerformers: analytics.topPerformers.map((p, index) => ({
          ...p,
          userId: `member-${index + 1}`,
        })),
      };

      res.status(200).json({
        success: true,
        data: sanitizedAnalytics,
      });
    });
  }

  /**
   * POST /api/v2/scstats/users/:userId/csv-import
   * Import SCStats CSV exports (playtime, loadoutTop, loadoutDetail, purchases, ships)
   */
  async importCsvData(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userId } = req.params;

      if (user.id !== userId) {
        throw new UnauthorizedError('Cannot import SCStats data for another user');
      }

      const body = req.body as Record<string, unknown>;
      const consent = body.consent === 'true' || body.consent === true;

      if (!consent) {
        throw new ValidationError('Consent is required to import SCStats data');
      }

      // Extract uploaded files from multer fields
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      if (!files) {
        throw new ValidationError('CSV files are required');
      }

      const knownFields = ['playtime', 'loadoutTop', 'loadoutDetail', 'purchases', 'ships'];
      const presentFields = knownFields.filter(f => files[f] && files[f].length > 0);
      if (presentFields.length === 0) {
        throw new ValidationError(
          'At least one CSV file is required (playtime, loadoutTop, loadoutDetail, purchases, or ships).'
        );
      }

      // Read file buffers as UTF-8 strings (only for present files)
      const csvContents: Record<string, string> = {};
      for (const field of presentFields) {
        csvContents[field] = files[field][0].buffer.toString('utf-8');
      }

      // Size validation (defense-in-depth beyond multer)
      for (const [key, content] of Object.entries(csvContents)) {
        if (content.length > 5 * 1024 * 1024) {
          throw new ValidationError(`${key} CSV exceeds maximum allowed size (5MB)`);
        }
      }

      const result = await this.csvImportService.importCsvData(userId, csvContents, consent);

      logger.info('SCStats CSV data imported via API', { userId });

      res.status(200).json({
        success: true,
        data: {
          message: 'SCStats CSV data imported successfully',
          summary: result.summary,
          counts: {
            playtime: result.counts.playtime?.length ?? 0,
            loadoutTop: result.counts.loadoutTop?.length ?? 0,
            loadoutDetail: result.counts.loadoutDetail?.length ?? 0,
            purchases: result.counts.purchases?.length ?? 0,
            ships: result.counts.ships?.length ?? 0,
          },
        },
      });
    });
  }

  /**
   * POST /api/v2/scstats/users/:userId/log-import
   * Import SCStats data directly from one or more Star Citizen log files.
   */
  async importLogData(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userId } = req.params;

      if (user.id !== userId) {
        throw new UnauthorizedError('Cannot import SCStats data for another user');
      }

      const body = req.body as Record<string, unknown>;
      const consent = body.consent === 'true' || body.consent === true;
      if (!consent) {
        throw new ValidationError('Consent is required to import SCStats data');
      }

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        throw new ValidationError('At least one .log file is required');
      }

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (totalBytes > 50 * 1024 * 1024) {
        throw new ValidationError('Combined log upload size exceeds maximum allowed size (50MB)');
      }

      const parsed = this.logImportService.buildCsvImports(
        files.map(file => ({
          name: file.originalname,
          content: file.buffer.toString('utf-8'),
        }))
      );

      const result = await this.csvImportService.importCsvData(userId, parsed.csvFiles, consent);

      logger.info('SCStats log data imported via API', {
        userId,
        filesProcessed: parsed.meta.filesProcessed,
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'SCStats log data imported successfully',
          summary: result.summary,
          counts: {
            playtime: result.counts.playtime?.length ?? 0,
            loadoutTop: result.counts.loadoutTop?.length ?? 0,
            loadoutDetail: result.counts.loadoutDetail?.length ?? 0,
            purchases: result.counts.purchases?.length ?? 0,
            ships: result.counts.ships?.length ?? 0,
          },
          logMeta: parsed.meta,
        },
      });
    });
  }

  /**
   * GET /api/v2/scstats/users/:userId/csv
   * Get CSV-imported SCStats data
   */
  async getCsvData(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      this.getAuthUser(req);
      const { userId } = req.params;

      const data = await this.csvImportService.getData(userId);
      res.status(200).json({
        success: true,
        data,
      });
    });
  }

  /**
   * DELETE /api/v2/scstats/users/:userId/csv
   * Delete CSV-imported SCStats data (GDPR)
   */
  async deleteCsvData(req: AuthRequest, res: Response): Promise<void> {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { userId } = req.params;

      if (user.id !== userId) {
        throw new UnauthorizedError('Cannot delete SCStats data for another user');
      }

      await this.csvImportService.deleteData(userId);

      logger.info('SCStats CSV data deleted via API', { userId });

      res.status(200).json({
        success: true,
        data: {
          message: 'SCStats CSV data deleted successfully',
        },
      });
    });
  }
}

export const scstatsController = new SCStatsController();
