import { Dashboard } from '../../models/Dashboard';
import { DashboardWidget } from '../../models/DashboardWidget';
export declare class DashboardService {
    private readonly dashboardRepo;
    private readonly widgetRepo;
    listDashboards(organizationId: string, userId: string, filters?: {
        type?: string;
        scope?: string;
    }): Promise<{
        dashboards: Dashboard[];
        total: number;
    }>;
    getDashboard(dashboardId: string, organizationId: string): Promise<Dashboard | null>;
    createDashboard(organizationId: string, userId: string, data: {
        name: string;
        description?: string;
        type?: string;
        layout?: string;
        isDefault?: boolean;
    }): Promise<Dashboard>;
    updateDashboard(dashboardId: string, organizationId: string, data: Partial<Pick<Dashboard, 'name' | 'description' | 'type' | 'layout' | 'isDefault'>>): Promise<Dashboard>;
    deleteDashboard(dashboardId: string, organizationId: string): Promise<void>;
    addWidget(dashboardId: string, organizationId: string, data: {
        type: string;
        title: string;
        config?: Record<string, unknown>;
        position?: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        sortOrder?: number;
    }): Promise<DashboardWidget>;
    updateWidget(dashboardId: string, widgetId: string, organizationId: string, data: Partial<Pick<DashboardWidget, 'title' | 'config' | 'position' | 'sortOrder'>>): Promise<DashboardWidget>;
    deleteWidget(dashboardId: string, widgetId: string, organizationId: string): Promise<void>;
    shareDashboard(dashboardId: string, organizationId: string, userIds: string[]): Promise<Dashboard>;
}
//# sourceMappingURL=DashboardService.d.ts.map