import { Dashboard } from './Dashboard';
export declare class DashboardWidget {
    id: string;
    dashboardId: string;
    dashboard?: Dashboard;
    type: string;
    title: string;
    config?: Record<string, unknown>;
    position?: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=DashboardWidget.d.ts.map