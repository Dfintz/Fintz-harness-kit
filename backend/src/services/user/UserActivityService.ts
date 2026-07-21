import { Between, FindOptionsWhere, In } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { UserActivity, ActivityAction } from '../../models/UserActivity';

/**
 * Pagination options
 */
interface PaginationOptions {
    page?: number;
    limit?: number;
}

/**
 * Activity filter options
 */
interface ActivityFilters {
    userId?: string;
    action?: string | string[];
    resource?: string;
    method?: string;
    startDate?: Date;
    endDate?: Date;
    statusCode?: number;
}

/**
 * Activity log payload
 */
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

/**
 * Timeline event for display in user profile
 */
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

/**
 * Service for managing user activity logging
 * Tracks user actions for audit trail and security monitoring
 */
export class UserActivityService {
    private activityRepository = AppDataSource.getRepository(UserActivity);

    // ==================== LOG ACTIVITY ====================

    /**
     * Log a user activity
     * @param payload Activity log payload
     * @returns Created activity record
     */
    async logActivity(payload: ActivityLogPayload): Promise<UserActivity> {
        const activity = this.activityRepository.create({
            userId: payload.userId,
            action: payload.action,
            resource: payload.resource,
            method: payload.method,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
            metadata: payload.metadata,
            statusCode: payload.statusCode,
            duration: payload.duration
        });

        return this.activityRepository.save(activity);
    }

    /**
     * Batch log multiple activities (for performance)
     * @param payloads Array of activity log payloads
     * @returns Created activity records
     */
    async logActivitiesBatch(payloads: ActivityLogPayload[]): Promise<UserActivity[]> {
        const activities = payloads.map(payload => 
            this.activityRepository.create({
                userId: payload.userId,
                action: payload.action,
                resource: payload.resource,
                method: payload.method,
                ipAddress: payload.ipAddress,
                userAgent: payload.userAgent,
                metadata: payload.metadata,
                statusCode: payload.statusCode,
                duration: payload.duration
            })
        );

        return this.activityRepository.save(activities);
    }

    // ==================== GET USER ACTIVITIES ====================

    /**
     * Get activities for a specific user
     * @param userId User ID
     * @param filters Optional filters
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async getUserActivities(
        userId: string,
        filters?: Omit<ActivityFilters, 'userId'>,
        pagination: PaginationOptions = {}
    ): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 50 } = pagination;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause({ ...filters, userId });

        const [activities, total] = await this.activityRepository.findAndCount({
            where,
            order: { timestamp: 'DESC' },
            take: limit,
            skip
        });

        return {
            activities,
            total,
            page,
            limit
        };
    }

    /**
     * Get recent activities across all users (admin only)
     * @param limit Number of activities to retrieve
     * @param filters Optional filters
     * @returns Recent activities
     */
    async getRecentActivities(
        limit: number = 100,
        filters?: ActivityFilters
    ): Promise<UserActivity[]> {
        const where = this.buildWhereClause(filters);

        return this.activityRepository.find({
            where,
            order: { timestamp: 'DESC' },
            take: limit,
            relations: ['user']
        });
    }

    /**
     * Get activities by action type
     * @param action Action or array of actions
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async getActivitiesByAction(
        action: string | string[],
        pagination: PaginationOptions = {}
    ): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 50 } = pagination;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause({ action });

        const [activities, total] = await this.activityRepository.findAndCount({
            where,
            order: { timestamp: 'DESC' },
            take: limit,
            skip,
            relations: ['user']
        });

        return {
            activities,
            total,
            page,
            limit
        };
    }

    /**
     * Search activities with complex filters
     * @param filters Activity filters
     * @param pagination Pagination options
     * @returns Paginated activities
     */
    async searchActivities(
        filters: ActivityFilters,
        pagination: PaginationOptions = {}
    ): Promise<{ activities: UserActivity[]; total: number; page: number; limit: number }> {
        const { page = 1, limit = 50 } = pagination;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause(filters);

        const [activities, total] = await this.activityRepository.findAndCount({
            where,
            order: { timestamp: 'DESC' },
            take: limit,
            skip,
            relations: ['user']
        });

        return {
            activities,
            total,
            page,
            limit
        };
    }

    // ==================== STATISTICS ====================

    /**
     * Get activity count by user
     * @param userId User ID
     * @param filters Optional filters
     * @returns Activity count
     */
    async getUserActivityCount(userId: string, filters?: Omit<ActivityFilters, 'userId'>): Promise<number> {
        const where = this.buildWhereClause({ ...filters, userId });
        return this.activityRepository.count({ where });
    }

    /**
     * Get activity statistics for a user
     * @param userId User ID
     * @param days Number of days to look back (default: 30)
     * @returns Activity statistics
     */
    async getUserActivityStats(userId: string, days: number = 30): Promise<{
        totalActivities: number;
        loginCount: number;
        failedLoginCount: number;
        mostCommonActions: { action: string; count: number }[];
        recentActivity: Date | null;
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const where: FindOptionsWhere<UserActivity> = {
            userId,
            timestamp: Between(startDate, new Date())
        };

        const [activities, totalActivities] = await this.activityRepository.findAndCount({
            where,
            order: { timestamp: 'DESC' }
        });

        const loginCount = activities.filter(a => a.action === ActivityAction.LOGIN).length;
        const failedLoginCount = activities.filter(a => a.action === ActivityAction.LOGIN_FAILED).length;

        // Calculate most common actions
        const actionCounts = activities.reduce((acc, activity) => {
            acc[activity.action] = (acc[activity.action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const mostCommonActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const recentActivity = activities.length > 0 ? activities[0].timestamp : null;

        return {
            totalActivities,
            loginCount,
            failedLoginCount,
            mostCommonActions,
            recentActivity
        };
    }

    /**
     * Get global activity statistics (admin only)
     * @param days Number of days to look back (default: 7)
     * @returns Global activity statistics
     */
    async getGlobalActivityStats(days: number = 7): Promise<{
        totalActivities: number;
        uniqueUsers: number;
        topActions: { action: string; count: number }[];
        failedLogins: number;
        successfulLogins: number;
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const activities = await this.activityRepository.find({
            where: {
                timestamp: Between(startDate, new Date())
            }
        });

        const totalActivities = activities.length;
        const uniqueUsers = new Set(activities.map(a => a.userId)).size;

        // Calculate top actions
        const actionCounts = activities.reduce((acc, activity) => {
            acc[activity.action] = (acc[activity.action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const failedLogins = activities.filter(a => a.action === ActivityAction.LOGIN_FAILED).length;
        const successfulLogins = activities.filter(a => a.action === ActivityAction.LOGIN).length;

        return {
            totalActivities,
            uniqueUsers,
            topActions,
            failedLogins,
            successfulLogins
        };
    }

    // ==================== SECURITY MONITORING ====================

    /**
     * Detect suspicious activity for a user
     * @param userId User ID
     * @param hoursToCheck Hours to look back (default: 24)
     * @returns Suspicious activity indicators
     */
    async detectSuspiciousActivity(userId: string, hoursToCheck: number = 24): Promise<{
        isSuspicious: boolean;
        indicators: string[];
    }> {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hoursToCheck);

        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: Between(startDate, new Date())
            },
            order: { timestamp: 'DESC' }
        });

        const indicators: string[] = [];
        
        // Check for multiple failed login attempts
        const failedLogins = activities.filter(a => a.action === ActivityAction.LOGIN_FAILED);
        if (failedLogins.length >= 5) {
            indicators.push(`${failedLogins.length} failed login attempts in the last ${hoursToCheck} hours`);
        }

        // Check for logins from multiple IP addresses
        const uniqueIPs = new Set(activities
            .filter(a => a.action === ActivityAction.LOGIN && a.ipAddress)
            .map(a => a.ipAddress));
        if (uniqueIPs.size >= 5) {
            indicators.push(`Logins from ${uniqueIPs.size} different IP addresses`);
        }

        // Check for rapid succession of activities (potential bot)
        const recentActivities = activities.slice(0, 10);
        if (recentActivities.length >= 10) {
            const timeSpan = recentActivities[0].timestamp.getTime() - 
                           recentActivities[9].timestamp.getTime();
            if (timeSpan < 60000) { // Less than 1 minute
                indicators.push('Unusual high-frequency activity detected');
            }
        }

        return {
            isSuspicious: indicators.length > 0,
            indicators
        };
    }

    // ==================== CLEANUP ====================

    /**
     * Delete old activities (maintenance job)
     * @param daysToKeep Number of days of history to keep
     * @returns Number of activities deleted
     */
    async cleanupOldActivities(daysToKeep: number = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await this.activityRepository
            .createQueryBuilder()
            .delete()
            .where('timestamp < :cutoffDate', { cutoffDate })
            .execute();

        return result.affected || 0;
    }

    // ==================== USER ACTIVITY TIMELINE ====================

    /**
     * Get user activity timeline with enriched events
     * @param userId User ID
     * @param days Number of days to look back (default: 30)
     * @param limit Maximum number of timeline events (default: 50)
     * @returns Enriched timeline of user activities
     */
    async getUserActivityTimeline(
        userId: string,
        days: number = 30,
        limit: number = 50
    ): Promise<{
        timeline: TimelineEvent[];
        summary: {
            totalEvents: number;
            byCategory: Record<string, number>;
            firstActivity: Date | null;
            lastActivity: Date | null;
            streak: number;
        };
    }> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: Between(startDate, new Date())
            },
            order: { timestamp: 'DESC' },
            take: limit * 2 // Fetch more to filter and enrich
        });

        const timeline: TimelineEvent[] = [];
        const categoryCount: Record<string, number> = {};

        for (const activity of activities) {
            const event = this.mapActivityToTimelineEvent(activity);
            if (event) {
                timeline.push(event);
                categoryCount[event.category] = (categoryCount[event.category] || 0) + 1;
            }
            if (timeline.length >= limit) {
                break;
            }
        }

        // Calculate activity streak (consecutive days with activity)
        const streak = this.calculateActivityStreak(activities);

        return {
            timeline,
            summary: {
                totalEvents: timeline.length,
                byCategory: categoryCount,
                firstActivity: activities.length > 0 
                    ? activities[activities.length - 1].timestamp 
                    : null,
                lastActivity: activities.length > 0 
                    ? activities[0].timestamp 
                    : null,
                streak
            }
        };
    }

    /**
     * Map a raw activity to a timeline event
     */
    private mapActivityToTimelineEvent(activity: UserActivity): TimelineEvent | null {
        const actionConfig: Record<string, {
            category: string;
            title: string;
            icon: string;
            importance: 'high' | 'medium' | 'low';
        }> = {
            [ActivityAction.LOGIN]: {
                category: 'authentication',
                title: 'Logged in',
                icon: '🔐',
                importance: 'low'
            },
            [ActivityAction.LOGOUT]: {
                category: 'authentication',
                title: 'Logged out',
                icon: '👋',
                importance: 'low'
            },
            [ActivityAction.LOGIN_FAILED]: {
                category: 'security',
                title: 'Failed login attempt',
                icon: '⚠️',
                importance: 'high'
            },
            [ActivityAction.PASSWORD_CHANGED]: {
                category: 'security',
                title: 'Changed password',
                icon: '🔒',
                importance: 'high'
            },
            [ActivityAction.PASSWORD_RESET_REQUESTED]: {
                category: 'security',
                title: 'Password reset requested',
                icon: '🔄',
                importance: 'high'
            },
            [ActivityAction.PROFILE_UPDATED]: {
                category: 'profile',
                title: 'Updated profile',
                icon: '✏️',
                importance: 'medium'
            },
            [ActivityAction.USER_UPDATED]: {
                category: 'settings',
                title: 'Updated settings',
                icon: '⚙️',
                importance: 'low'
            },
            [ActivityAction.ORG_CREATED]: {
                category: 'organization',
                title: 'Created an organization',
                icon: '🚀',
                importance: 'high'
            },
            [ActivityAction.ORG_JOINED]: {
                category: 'organization',
                title: 'Joined an organization',
                icon: '🎉',
                importance: 'high'
            },
            [ActivityAction.ORG_LEFT]: {
                category: 'organization',
                title: 'Left an organization',
                icon: '👋',
                importance: 'high'
            },
            [ActivityAction.SECURITY_ALERT]: {
                category: 'security',
                title: 'Security alert',
                icon: '🔔',
                importance: 'high'
            },
            [ActivityAction.ACCOUNT_LOCKED]: {
                category: 'security',
                title: 'Account locked',
                icon: '🔒',
                importance: 'high'
            },
            [ActivityAction.ACCOUNT_UNLOCKED]: {
                category: 'security',
                title: 'Account unlocked',
                icon: '🔓',
                importance: 'medium'
            }
        };

        const config = actionConfig[activity.action];
        if (!config) {
            // Generic mapping for unknown actions
            return {
                id: activity.id,
                type: 'action',
                category: 'general',
                title: this.formatActionName(activity.action),
                description: activity.resource || 'Performed an action',
                timestamp: activity.timestamp,
                icon: '📌',
                metadata: activity.metadata,
                importance: 'low'
            };
        }

        return {
            id: activity.id,
            type: 'action',
            category: config.category,
            title: config.title,
            description: activity.resource 
                ? `${config.title} on ${activity.resource}` 
                : config.title,
            timestamp: activity.timestamp,
            icon: config.icon,
            metadata: activity.metadata,
            importance: config.importance
        };
    }

    /**
     * Format action name for display
     */
    private formatActionName(action: string): string {
        return action
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/^\w/, c => c.toUpperCase());
    }

    /**
     * Calculate consecutive days with activity
     */
    private calculateActivityStreak(activities: UserActivity[]): number {
        if (activities.length === 0) {
            return 0;
        }

        const activityDates = new Set(
            activities.map(a => a.timestamp.toISOString().split('T')[0])
        );

        let streak = 0;
        const today = new Date();
        const currentDate = new Date(today.toISOString().split('T')[0]);

        let hasActivity = true;
        while (hasActivity) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (activityDates.has(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                hasActivity = false;
            }
        }

        return streak;
    }

    /**
     * Get activity heatmap data for visualization
     * @param userId User ID
     * @param months Number of months to look back (default: 12)
     * @returns Daily activity counts for heatmap
     */
    async getActivityHeatmap(
        userId: string,
        months: number = 12
    ): Promise<Array<{ date: string; count: number }>> {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: Between(startDate, new Date())
            },
            select: ['timestamp']
        });

        const dayCounts: Record<string, number> = {};

        for (const activity of activities) {
            const dateStr = activity.timestamp.toISOString().split('T')[0];
            dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        }

        return Object.entries(dayCounts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    // ==================== HELPER METHODS ====================

    /**
     * Build TypeORM where clause from filters
     * @param filters Activity filters
     * @returns Where clause for TypeORM query
     */
    private buildWhereClause(filters?: ActivityFilters): FindOptionsWhere<UserActivity> {
        const where: FindOptionsWhere<UserActivity> = {};

        if (!filters) {
            return where;
        }

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.action) {
            if (Array.isArray(filters.action)) {
                where.action = In(filters.action);
            } else {
                where.action = filters.action;
            }
        }

        if (filters.resource) {
            where.resource = filters.resource;
        }

        if (filters.method) {
            where.method = filters.method;
        }

        if (filters.statusCode) {
            where.statusCode = filters.statusCode;
        }

        if (filters.startDate || filters.endDate) {
            const start = filters.startDate || new Date(0);
            const end = filters.endDate || new Date();
            where.timestamp = Between(start, end);
        }

        return where;
    }
}

