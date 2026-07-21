import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { GenericCsvPreviewService } from '../../services/user/GenericCsvPreviewService';
import { SCStatsImportService } from '../../services/user/SCStatsImportService';
import { ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/**
 * Import Controller (v2)
 *
 * Manages migration import jobs and validation:
 * - SCStats JSON import (current write path)
 * - SCStats CSV onboarding guidance
 * - Generic CSV validation/preview (phase-1 migration widening)
 * Wired to SCStatsImportService (real backing service).
 */
export class ImportController extends BaseController {
  private readonly importService: SCStatsImportService;
  private readonly genericCsvPreviewService: GenericCsvPreviewService;

  constructor() {
    super();
    this.importService = new SCStatsImportService();
    this.genericCsvPreviewService = new GenericCsvPreviewService();
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const { source, jsonData, consentGranted } = req.body as {
        source: 'scstats_json' | 'scstats_csv' | 'generic_csv';
        jsonData?: string;
        consentGranted: boolean;
      };

      if (!consentGranted) {
        res.status(400).json({
          success: false,
          error: 'Consent is required for data import (GDPR Article 6)',
        });
        return;
      }

      if (source === 'scstats_csv') {
        res.status(400).json({
          success: false,
          error:
            'SCStats CSV import is handled by /api/v2/scstats/users/:userId/csv-import (multipart upload).',
        });
        return;
      }

      if (source === 'generic_csv') {
        res.status(400).json({
          success: false,
          error:
            'Generic CSV import persistence is not enabled yet. Use /api/v2/import/validate with source=generic_csv for schema preview.',
        });
        return;
      }

      if (typeof jsonData !== 'string' || jsonData.trim().length < 2) {
        throw new ValidationError('jsonData is required for source scstats_json');
      }

      const result = await this.importService.importData(user.id, jsonData, consentGranted);

      res.status(201).json({
        success: true,
        data: result,
      });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);

      // SCStatsImportService uses userId, not jobId — returns current import status
      const data = await this.importService.getData(user.id);

      res.json({
        success: true,
        data,
      });
    });
  };

  listJobs = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);

      const data = await this.importService.getData(user.id);

      res.json({
        success: true,
        data: data.hasData ? [data] : [],
        pagination: {
          total: data.hasData ? 1 : 0,
          count: data.hasData ? 1 : 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
          totalPages: data.hasData ? 1 : 0,
        },
      });
    });
  };

  cancel = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);

      // SCStats import is synchronous — cancel means delete data
      await this.importService.deleteData(user.id);

      res.json({
        success: true,
        data: { message: 'Import data deleted successfully' },
      });
    });
  };

  validate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { source, jsonData, csvData } = req.body as {
        source: 'scstats_json' | 'scstats_csv' | 'generic_csv';
        jsonData?: string;
        csvData?: string;
      };

      try {
        if (source === 'generic_csv') {
          if (typeof csvData !== 'string' || csvData.trim().length < 2) {
            throw new ValidationError('csvData is required for source generic_csv');
          }
          const preview = this.genericCsvPreviewService.parsePreview(csvData);

          res.json({
            success: true,
            data: {
              valid: true,
              source: 'generic_csv',
              preview,
            },
          });
          return;
        }

        if (source === 'scstats_csv') {
          res.json({
            success: true,
            data: {
              valid: true,
              source: 'scstats_csv',
              guidance:
                'Use /api/v2/scstats/users/:userId/csv-import with playtime, loadoutTop, loadoutDetail, purchases, and ships files.',
              expectedFiles: ['playtime', 'loadoutTop', 'loadoutDetail', 'purchases', 'ships'],
            },
          });
          return;
        }

        if (typeof jsonData !== 'string' || jsonData.trim().length < 2) {
          throw new ValidationError('jsonData is required for source scstats_json');
        }

        const parsed = this.importService.parseJSON(jsonData);

        res.json({
          success: true,
          data: {
            valid: true,
            source: 'scstats_json',
            sections: Object.keys(parsed),
          },
        });
      } catch (err) {
        res.json({
          success: true,
          data: {
            valid: false,
            error: err instanceof Error ? err.message : 'Invalid data format',
          },
        });
      }
    });
  };
}
