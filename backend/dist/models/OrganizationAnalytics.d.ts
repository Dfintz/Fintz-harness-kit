import { Organization } from './Organization';
export declare enum AnalyticsPeriod {
    DAILY = "DAILY",
    WEEKLY = "WEEKLY",
    MONTHLY = "MONTHLY",
    QUARTERLY = "QUARTERLY",
    YEARLY = "YEARLY",
    ALL_TIME = "ALL_TIME"
}
export declare enum MetricType {
    MEMBER_COUNT = "MEMBER_COUNT",
    ACTIVITY_COUNT = "ACTIVITY_COUNT",
    ENGAGEMENT_SCORE = "ENGAGEMENT_SCORE",
    GROWTH_RATE = "GROWTH_RATE",
    RETENTION_RATE = "RETENTION_RATE",
    HIERARCHY_DEPTH = "HIERARCHY_DEPTH",
    PERMISSION_USAGE = "PERMISSION_USAGE",
    RESOURCE_USAGE = "RESOURCE_USAGE"
}
export interface MemberStats {
    totalMembers: number;
    directMembers: number;
    activeMembers: number;
    inactiveMembers: number;
    newMembersThisPeriod: number;
    removedMembersThisPeriod: number;
    membersByRole: Record<string, number>;
    averageTenure: number;
    memberGrowthRate: number;
}
export interface ActivityMetrics {
    totalActivities: number;
    activitiesByType: Record<string, number>;
    activitiesBySeverity: Record<string, number>;
    activityTrend: Array<{
        date: string;
        count: number;
    }>;
    mostActiveUsers: Array<{
        userId: string;
        activityCount: number;
    }>;
    peakActivityTimes: Array<{
        hour: number;
        count: number;
    }>;
    averageActivitiesPerDay: number;
}
export interface EngagementMetrics {
    engagementScore: number;
    activeUsersPercentage: number;
    averageActivitiesPerUser: number;
    lastActivityDate: Date | null;
    dormantMembers: number;
    highlyEngagedMembers: number;
    engagementTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
}
export interface GrowthMetrics {
    memberGrowth: Array<{
        date: string;
        count: number;
    }>;
    growthRate: number;
    projectedGrowth: number;
    churnRate: number;
    retentionRate: number;
    netGrowth: number;
    subOrgGrowth: number;
}
export interface HierarchyHealth {
    depth: number;
    balance: number;
    averageChildrenPerNode: number;
    leafNodeCount: number;
    middleNodeCount: number;
    totalSubOrgs: number;
    deepestPath: string[];
    widestLevel: number;
}
export interface ResourceUsage {
    storageUsed: number;
    apiCallsThisPeriod: number;
    permissionChecks: number;
    averageResponseTime: number;
    errorRate: number;
    resourcesByType: Record<string, number>;
}
export declare class OrganizationAnalytics {
    id: string;
    organizationId: string;
    organization: Organization;
    period: AnalyticsPeriod;
    periodStart: Date;
    periodEnd: Date;
    memberStats: MemberStats;
    activityMetrics: ActivityMetrics;
    engagementMetrics: EngagementMetrics;
    growthMetrics: GrowthMetrics;
    hierarchyHealth: HierarchyHealth;
    resourceUsage: ResourceUsage;
    overallHealthScore: number;
    comparison: {
        memberChange: number;
        activityChange: number;
        engagementChange: number;
        growthChange: number;
    } | null;
    alerts: Array<{
        type: 'WARNING' | 'INFO' | 'CRITICAL';
        message: string;
        metric: string;
        value: number;
        threshold: number;
    }> | null;
    recommendations: Array<{
        category: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        message: string;
        action: string;
    }> | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    isSnapshot: boolean;
    calculateHealthScore(): number;
    generateAlerts(): void;
    generateRecommendations(): void;
    compareWithPrevious(previous: OrganizationAnalytics | null): void;
    private calculatePercentageChange;
    getDashboardSummary(): {
        organizationId: string;
        period: AnalyticsPeriod;
        periodStart: Date;
        periodEnd: Date;
        healthScore: number;
        totalMembers: number;
        activeMembers: number;
        memberGrowth: number;
        totalActivities: number;
        engagementScore: number;
        growthRate: number;
        retentionRate: number;
        alertCount: number;
        criticalAlerts: number;
        comparison: {
            memberChange: number;
            activityChange: number;
            engagementChange: number;
            growthChange: number;
        } | null;
        topRecommendations: {
            category: string;
            priority: "HIGH" | "MEDIUM" | "LOW";
            message: string;
            action: string;
        }[];
    };
}
//# sourceMappingURL=OrganizationAnalytics.d.ts.map