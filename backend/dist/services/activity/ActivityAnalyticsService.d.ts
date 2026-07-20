import { Activity, ActivityType } from '../../models/Activity';
import { TenantService } from '../base/TenantService';
export interface ActivityMetrics {
    totalActivities: number;
    activeActivities: number;
    completedActivities: number;
    cancelledActivities: number;
    participationRate: number;
    averageDuration: number;
    popularTypes: {
        type: ActivityType;
        count: number;
    }[];
    popularLocations: {
        location: string;
        count: number;
    }[];
    peakHours: {
        hour: number;
        count: number;
    }[];
    organizationStats: {
        orgId: string;
        orgName: string;
        count: number;
    }[];
}
export interface ParticipationAnalytics {
    totalParticipants: number;
    uniqueParticipants: number;
    averageParticipantsPerActivity: number;
    topParticipants: {
        userId: string;
        userName: string;
        count: number;
    }[];
    retentionRate: number;
    newParticipantRate: number;
}
export interface PerformanceMetrics {
    completionRate: number;
    averageRating: number;
    onTimeCompletionRate: number;
    participantSatisfaction: number;
    resourceUtilization: number;
    costEffectiveness: number;
}
export interface TrendAnalysis {
    period: 'daily' | 'weekly' | 'monthly';
    activityTrends: {
        date: string;
        count: number;
    }[];
    participationTrends: {
        date: string;
        participants: number;
    }[];
    completionTrends: {
        date: string;
        completed: number;
        cancelled: number;
    }[];
    typeTrends: {
        type: ActivityType;
        trend: 'up' | 'down' | 'stable';
        change: number;
    }[];
}
export declare class ActivityAnalyticsService extends TenantService<Activity> {
    constructor();
    getStatusCounts(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<{
        total: number;
        active: number;
        completed: number;
        cancelled: number;
    }>;
    getTypeDistribution(organizationId?: string, fromDate?: Date, toDate?: Date, limit?: number): Promise<{
        type: ActivityType;
        count: number;
    }[]>;
    getLocationDistribution(organizationId?: string, fromDate?: Date, toDate?: Date, limit?: number): Promise<{
        location: string;
        count: number;
    }[]>;
    getAverageDuration(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<number>;
    getActivityMetrics(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<ActivityMetrics>;
    getParticipationAnalytics(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<ParticipationAnalytics>;
    getPerformanceMetrics(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<PerformanceMetrics>;
    getTrendAnalysis(period: 'daily' | 'weekly' | 'monthly', organizationId?: string, fromDate?: Date, toDate?: Date): Promise<TrendAnalysis>;
    generateReport(organizationId?: string, fromDate?: Date, toDate?: Date): Promise<{
        metrics: ActivityMetrics;
        participation: ParticipationAnalytics;
        performance: PerformanceMetrics;
        trends: TrendAnalysis;
        generatedAt: Date;
    }>;
    private applyOrgDateFilters;
    private applyParticipantActivityFilter;
    private analyzeCompletedActivities;
}
//# sourceMappingURL=ActivityAnalyticsService.d.ts.map