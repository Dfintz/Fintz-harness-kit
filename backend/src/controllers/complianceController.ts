import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { LicenseExportService } from '../services/compliance/LicenseExportService';
import { getDataRetentionService } from '../services/data/DataRetentionService';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * ComplianceController — Handles license export and data retention management.
 * Mounted under admin routes; requires admin privileges.
 */
export class ComplianceController extends BaseController {
  private readonly licenseExportService: LicenseExportService;

  constructor() {
    super();
    this.licenseExportService = new LicenseExportService();
  }

  /**
   * GET /admin/compliance/licenses
   * Export software dependency licenses for compliance auditing.
   * Query params: format (json|csv|text), includeDevDependencies, filter (all|problematic|unknown)
   */
  public exportLicenses = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const format = (req.query.format as string) || 'json'; // NOSONAR: Improper Type Validation FP — Express query params are strings; format validated by downstream switch
      const includeDevDependencies = parseBooleanQuery(req.query.includeDevDependencies);
      const filter = (req.query.filter as 'all' | 'problematic' | 'unknown') || 'all';

      const result = await this.licenseExportService.exportLicenses({
        includeDevDependencies,
        filter,
      });

      logger.info('License export requested', {
        userId: user.id,
        format,
        filter,
        totalPackages: result.totalPackages,
      });

      if (format === 'csv') {
        const csv = this.licenseExportService.formatAsCsv(result);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=licenses.csv');
        res.send(csv);
      } else if (format === 'text') {
        const text = this.licenseExportService.formatAsText(result);
        res.setHeader('Content-Type', 'text/plain');
        res.send(text);
      } else {
        this.sendSuccess(res, result);
      }
    });
  };

  /**
   * GET /admin/compliance/retention/config
   * Get current data retention configuration.
   */
  public getRetentionConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      this.getAuthUser(req);
      const retentionService = getDataRetentionService();
      return retentionService.getRetentionConfig();
    });
  };

  /**
   * POST /admin/compliance/retention/execute
   * Manually trigger data retention cleanup.
   * Body: { dryRun?: boolean }
   */
  public executeRetention = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { dryRun } = req.body;

      logger.info('Manual retention cleanup triggered', {
        userId: user.id,
        dryRun: dryRun || false,
      });

      const retentionService = getDataRetentionService();
      const results = await retentionService.runCleanup();

      this.sendSuccess(res, {
        message: 'Data retention cleanup completed',
        dryRun: dryRun || false,
        results,
      });
    });
  };
}
