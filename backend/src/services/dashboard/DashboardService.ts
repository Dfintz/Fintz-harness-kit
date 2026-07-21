import { AppDataSource } from '../../config/database';
import { Dashboard } from '../../models/Dashboard';
import { DashboardWidget } from '../../models/DashboardWidget';
import { NotFoundError } from '../../utils/apiErrors';

export class DashboardService {
  private readonly dashboardRepo = AppDataSource.getRepository(Dashboard);
  private readonly widgetRepo = AppDataSource.getRepository(DashboardWidget);

  async listDashboards(
    organizationId: string,
    userId: string,
    filters?: { type?: string; scope?: string }
  ): Promise<{ dashboards: Dashboard[]; total: number }> {
    const qb = this.dashboardRepo
      .createQueryBuilder('dashboard')
      .leftJoinAndSelect('dashboard.widgets', 'widget')
      .where('dashboard.organizationId = :organizationId', { organizationId })
      .orderBy('dashboard.createdAt', 'DESC');

    if (filters?.type) {
      qb.andWhere('dashboard.type = :type', { type: filters.type });
    }

    // 'mine' scope shows only user's dashboards; default includes shared
    if (filters?.scope === 'mine') {
      qb.andWhere('dashboard.createdBy = :userId', { userId });
    }

    const [dashboards, total] = await qb.getManyAndCount();
    return { dashboards, total };
  }

  async getDashboard(dashboardId: string, organizationId: string): Promise<Dashboard | null> {
    return this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
      relations: ['widgets'],
    });
  }

  async createDashboard(
    organizationId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      type?: string;
      layout?: string;
      isDefault?: boolean;
    }
  ): Promise<Dashboard> {
    const dashboard = this.dashboardRepo.create({
      ...data,
      organizationId,
      createdBy: userId,
    });
    return this.dashboardRepo.save(dashboard);
  }

  async updateDashboard(
    dashboardId: string,
    organizationId: string,
    data: Partial<Pick<Dashboard, 'name' | 'description' | 'type' | 'layout' | 'isDefault'>>
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    Object.assign(dashboard, data);
    return this.dashboardRepo.save(dashboard);
  }

  async deleteDashboard(dashboardId: string, organizationId: string): Promise<void> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    await this.dashboardRepo.remove(dashboard);
  }

  async addWidget(
    dashboardId: string,
    organizationId: string,
    data: {
      type: string;
      title: string;
      config?: Record<string, unknown>;
      position?: { x: number; y: number; w: number; h: number };
      sortOrder?: number;
    }
  ): Promise<DashboardWidget> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    const widget = this.widgetRepo.create({ ...data, dashboardId });
    return this.widgetRepo.save(widget);
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    organizationId: string,
    data: Partial<Pick<DashboardWidget, 'title' | 'config' | 'position' | 'sortOrder'>>
  ): Promise<DashboardWidget> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    const widget = await this.widgetRepo.findOne({ where: { id: widgetId, dashboardId } });
    if (!widget) {
      throw new NotFoundError('Widget');
    }
    Object.assign(widget, data);
    return this.widgetRepo.save(widget);
  }

  async deleteWidget(dashboardId: string, widgetId: string, organizationId: string): Promise<void> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    const widget = await this.widgetRepo.findOne({ where: { id: widgetId, dashboardId } });
    if (!widget) {
      throw new NotFoundError('Widget');
    }
    await this.widgetRepo.remove(widget);
  }

  async shareDashboard(
    dashboardId: string,
    organizationId: string,
    userIds: string[]
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id: dashboardId, organizationId },
    });
    if (!dashboard) {
      throw new NotFoundError('Dashboard');
    }
    const existing = dashboard.sharedWithUsers ?? [];
    const merged = [...new Set([...existing, ...userIds])];
    dashboard.sharedWithUsers = merged;
    return this.dashboardRepo.save(dashboard);
  }
}

