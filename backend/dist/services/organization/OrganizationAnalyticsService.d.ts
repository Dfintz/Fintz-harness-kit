import { AnalyticsPeriod, OrganizationAnalytics } from '../../models/OrganizationAnalytics';
export declare class OrganizationAnalyticsService {
    private readonly analyticsRepository;
    private readonly orgRepository;
    private readonly activityRepository;
    private readonly permissionRepository;
    private readonly membershipRepository;
    private readonly relationshipRepository;
    generateAnalytics(orgId: string, period?: AnalyticsPeriod, startDate?: Date, endDate?: Date): Promise<OrganizationAnalytics>;
    private generateMemberStats;
    private generateActivityMetrics;
    private generateEngagementMetrics;
    private generateGrowthMetrics;
    private generateHierarchyHealth;
    private generateResourceUsage;
    getDashboard(orgId: string, period?: AnalyticsPeriod, refresh?: boolean): Promise<Record<string, unknown>>;
    exportAnalytics(orgId: string, period?: AnalyticsPeriod, format?: 'json' | 'csv'): Promise<string | object>;
    getOrganizationAnalytics(orgId: string, period?: AnalyticsPeriod): Promise<{
        totalMembers: number;
        activeMembers: number;
        growth: number;
        engagement: number;
    }>;
    getAnalyticsByPeriod(orgId: string, period: AnalyticsPeriod | string): Promise<{
        period: string;
        data: OrganizationAnalytics;
    }>;
    compareOrganizations(orgIds: string[], period?: AnalyticsPeriod): Promise<{
        organizations: Array<{
            id: string;
            metrics: {
                members: number;
                activeMembers: number;
                growth: number;
                engagement: number;
                activities: number;
                retentionRate: number;
            };
        }>;
    }>;
    private calculateStartDate;
    private getPreviousPeriodAnalytics;
    private calculateActivityTrend;
    private calculateMemberGrowthTrend;
    private getAllDescendants;
    private getDaysSinceLastActivity;
    private getLastActivityDate;
    private isOutdated;
    private convertToCSV;
}
//# sourceMappingURL=OrganizationAnalyticsService.d.ts.map