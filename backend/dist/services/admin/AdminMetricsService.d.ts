export interface SystemMetrics {
    timestamp: Date;
    users: {
        total: number;
        active24h: number;
        active7d: number;
        active30d: number;
        newUsers24h: number;
        newUsers7d: number;
        newUsers30d: number;
    };
    organizations: {
        total: number;
        active: number;
        inactive: number;
        avgMembersPerOrg: number;
    };
    activities: {
        total: number;
        created24h: number;
        created7d: number;
        created30d: number;
        byType: Record<string, number>;
        byStatus: Record<string, number>;
    };
    performance: {
        cacheHitRate: number;
        avgResponseTime: number;
        totalQueries24h: number;
        errorRate: number;
    };
    health: {
        databaseStatus: string;
        cacheStatus: string;
        uptime: number;
        memoryUsage: {
            used: number;
            total: number;
            percentage: number;
        };
    };
}
export interface UserActionMetrics {
    timestamp: Date;
    period: '24h' | '7d' | '30d';
    totalActions: number;
    actionsByType: Record<string, number>;
    topActions: Array<{
        action: string;
        count: number;
    }>;
    errors: {
        total: number;
        byType: Record<string, number>;
    };
}
export declare class AdminMetricsService {
    static getSystemMetrics(): Promise<SystemMetrics>;
    private static getUserMetrics;
    private static getOrganizationMetrics;
    private static calculateAverageMembersPerOrg;
    private static getActivityMetrics;
    private static getPerformanceMetrics;
    private static getHealthMetrics;
    static getUserActionMetrics(period?: '24h' | '7d' | '30d'): Promise<UserActionMetrics>;
    private static getDailyCountsFromRepo;
    private static getErrorTimeSeries;
    static getTimeSeriesMetrics(metric: 'users' | 'activities' | 'errors', days?: number): Promise<Array<{
        date: string;
        value: number;
    }>>;
    static getPlatformModerationAnalytics(): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=AdminMetricsService.d.ts.map