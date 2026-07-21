import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { CrossSystemAnalyticsService } from '../../services/analytics/CrossSystemAnalyticsService';
import { ExportRequestService } from '../../services/user/ExportRequestService';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { BaseController } from '../BaseController';

/**
 * Export Controller (v2)
 *
 * Manages data export jobs — GDPR-compliant user data export.
 * Wired to ExportRequestService (real backing service).
 */
export class ExportController extends BaseController {
  private readonly exportService: ExportRequestService;
  private readonly analyticsService: CrossSystemAnalyticsService;

  constructor() {
    super();
    this.exportService = new ExportRequestService();
    this.analyticsService = new CrossSystemAnalyticsService();
  }

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async request => {
        const authReq = request as AuthRequest;
        const user = this.getAuthUser(authReq);
        const { format } = authReq.body as { format?: string };

        const exportRequest = await this.exportService.createExportRequest(
          user.id,
          authReq.ip,
          authReq.headers['user-agent'],
          { format }
        );

        return {
          success: true,
          data: exportRequest,
        };
      },
      201
    );
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const { jobId } = authReq.params;

      const exportRequest = await this.exportService.getExportRequest(jobId);
      if (!exportRequest) {
        throw new NotFoundError('Export job', jobId);
      }

      return {
        success: true,
        data: exportRequest,
      };
    });
  };

  download = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const { jobId } = authReq.params;
      const { token } = authReq.query as Record<string, string>;

      if (!token) {
        throw new ValidationError('Download token is required');
      }

      const exportRequest = await this.exportService.verifyDownloadToken(jobId, token);
      if (!exportRequest) {
        throw new ForbiddenError('Invalid or expired download token');
      }

      return {
        success: true,
        data: exportRequest,
      };
    });
  };

  listJobs = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const user = this.getAuthUser(authReq);
      const { limit } = authReq.query as Record<string, string>;
      const limitNum = Math.min(Number.parseInt(limit) || 10, 200);

      const jobs = await this.exportService.getUserExportRequests(user.id, limitNum);

      return {
        success: true,
        data: jobs,
        pagination: {
          total: jobs.length,
          count: jobs.length,
          page: 1,
          pageSize: limitNum,
          hasMore: false,
          totalPages: 1,
        },
      };
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async request => {
      const authReq = request as AuthRequest;
      const { jobId } = authReq.params;

      const exportRequest = await this.exportService.getExportRequest(jobId);
      if (!exportRequest) {
        throw new NotFoundError('Export job', jobId);
      }

      await this.exportService.deleteExportRequest(jobId);

      return {
        success: true,
        data: {
          id: jobId,
          deleted: true,
        },
      };
    });
  };

  exportAttendanceCorrelation = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.tenantContext?.organizationId;
      if (!organizationId) {
        res.status(400).json({ success: false, error: 'Organization context required' });
        return;
      }

      const activityId =
        typeof req.query.activityId === 'string' ? req.query.activityId : undefined;
      const startDate =
        typeof req.query.startDate === 'string' ? new Date(req.query.startDate) : undefined;
      const endDate =
        typeof req.query.endDate === 'string' ? new Date(req.query.endDate) : undefined;
      const format = typeof req.query.format === 'string' ? req.query.format : 'json';

      const report = await this.analyticsService.getAttendanceCorrelationReport(organizationId, {
        activityId,
        startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
        endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : undefined,
      });

      if (format === 'csv') {
        res
          .status(200)
          .type('text/csv; charset=utf-8')
          .send(this.analyticsService.formatAttendanceCorrelationCsv(report));
        return;
      }

      res.json({ success: true, data: report });
    });
  };
}
