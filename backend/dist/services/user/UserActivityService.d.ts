import { UserActivity } from '../../models/UserActivity';
interface PaginationOptions {
    page?: number;
    limit?: number;
}
interface ActivityFilters {
    userId?: string;
    action?: string | string[];
    resource?: string;
    method?: string;
    startDate?: Date;
    endDate?: Date;
    statusCode?: number;
}
export interface ActivityLogPayload {
    userId: string;
    action: string;
    resource?: string;
    method?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    statusCode?: number;
    duration?: number;
}
export interface TimelineEvent {
    id: string;
    type: 'action' | 'milestone' | 'achievement' | 'social';
    category: string;
    title: string;
    description: string;
    timestamp: Date;
    icon: string;
    metadata?: Record<string, unknown>;
    importance: 'high' | 'medium' | 'low';
}
export declare class UserActivityService {
    private activityRepository;
    logActivity(payload: ActivityLogPayload): Promise<UserActivity>;
    logActivitiesBatch(payloads: ActivityLogPayload[]): Promise<UserActivity[]>;
    getUserActivities(userId: string, filters?: Omit<ActivityFilters, 'userId'>, pagination?: PaginationOptions): Promise<{
        activities: UserActivity[];
        total: number;
        page: number;
        limit: number;
    }>;
    getRecentActivities(limit?: number, filters?: ActivityFilters): Promise<UserActivity[]>;
    getActivitiesByAction(action: string | string[], pagination?: PaginationOptions): Promise<{
        activities: UserActivity[];
        total: number;
        page: number;
        limit: number;
    }>;
    searchActivities(filters: ActivityFilters, pagination?: PaginationOptions): Promise<{
        activities: UserActivity[];
        total: number;
        page: number;
        limit: number;
    }>;
    getUserActivityCount(userId: string, filters?: Omit<ActivityFilters, 'userId'>): Promise<number>;
    getUserActivityStats(userId: string, days?: number): Promise<{
        totalActivities: number;
        loginCount: number;
        failedLoginCount: number;
        mostCommonActions: {
            action: string;
            count: number;
        }[];
        recentActivity: Date | null;
    }>;
    getGlobalActivityStats(days?: number): Promise<{
        totalActivities: number;
        uniqueUsers: number;
        topActions: {
            action: string;
            count: number;
        }[];
        failedLogins: number;
        successfulLogins: number;
    }>;
    detectSuspiciousActivity(userId: string, hoursToCheck?: number): Promise<{
        isSuspicious: boolean;
        indicators: string[];
    }>;
    cleanupOldActivities(daysToKeep?: number): Promise<number>;
    getUserActivityTimeline(userId: string, days?: number, limit?: number): Promise<{
        timeline: TimelineEvent[];
        summary: {
            totalEvents: number;
            byCategory: Record<string, number>;
            firstActivity: Date | null;
            lastActivity: Date | null;
            streak: number;
        };
    }>;
    private mapActivityToTimelineEvent;
    private formatActionName;
    private calculateActivityStreak;
    getActivityHeatmap(userId: string, months?: number): Promise<Array<{
        date: string;
        count: number;
    }>>;
    private buildWhereClause;
}
export {};
//# sourceMappingURL=UserActivityService.d.ts.map