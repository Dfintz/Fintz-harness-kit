import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { DashboardService } from '../../services/dashboard/DashboardService';
import { BaseController } from '../BaseController';

/**
 * Dashboard Controller (v2)
 *
 * Manages user-configurable dashboard CRUD, widget management, and sharing.
 * Separate from DashboardSummaryController which provides the /dashboard/summary endpoint.
 */
export class DashboardController extends BaseController {
  private readonly dashboardService: DashboardService;

  constructor() {
    super();
    this.dashboardService = new DashboardService();
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { type, scope } = req.query as Record<string, string>;
      const { page, limit } = this.getPaginationParams(req);

      const { dashboards, total } = await this.dashboardService.listDashboards(
        organizationId,
        user.id,
        { type, scope }
      );

      res.json({
        success: true,
        ...this.createPaginatedResponse(dashboards, total, page, limit),
      });
    });
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);

      const dashboard = await this.dashboardService.createDashboard(
        organizationId,
        user.id,
        req.body
      );

      res.status(201).json({ success: true, data: dashboard });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId } = req.params;

      const dashboard = await this.dashboardService.getDashboard(dashboardId, organizationId);
      if (!dashboard) {
        res.status(404).json({ success: false, error: 'Dashboard not found' });
        return;
      }

      res.json({ success: true, data: dashboard });
    });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId } = req.params;

      const dashboard = await this.dashboardService.updateDashboard(
        dashboardId,
        organizationId,
        req.body
      );

      res.json({ success: true, data: dashboard });
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId } = req.params;

      await this.dashboardService.deleteDashboard(dashboardId, organizationId);

      res.json({ success: true, message: `Dashboard ${dashboardId} deleted` });
    });
  };

  addWidget = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId } = req.params;

      const widget = await this.dashboardService.addWidget(dashboardId, organizationId, req.body);

      res.status(201).json({ success: true, data: widget });
    });
  };

  updateWidget = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId, widgetId } = req.params;

      const widget = await this.dashboardService.updateWidget(
        dashboardId,
        widgetId,
        organizationId,
        req.body
      );

      res.json({ success: true, data: widget });
    });
  };

  deleteWidget = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId, widgetId } = req.params;

      await this.dashboardService.deleteWidget(dashboardId, widgetId, organizationId);

      res.json({ success: true, message: `Widget ${widgetId} deleted` });
    });
  };

  share = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { dashboardId } = req.params;
      const { userIds } = req.body as { userIds: string[] };

      const dashboard = await this.dashboardService.shareDashboard(
        dashboardId,
        organizationId,
        userIds
      );

      res.json({ success: true, data: dashboard });
    });
  };
}
