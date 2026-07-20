"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const UserActivity_1 = require("../../models/UserActivity");
class UserActivityService {
    activityRepository = data_source_1.AppDataSource.getRepository(UserActivity_1.UserActivity);
    async logActivity(payload) {
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
    async logActivitiesBatch(payloads) {
        const activities = payloads.map(payload => this.activityRepository.create({
            userId: payload.userId,
            action: payload.action,
            resource: payload.resource,
            method: payload.method,
            ipAddress: payload.ipAddress,
            userAgent: payload.userAgent,
            metadata: payload.metadata,
            statusCode: payload.statusCode,
            duration: payload.duration
        }));
        return this.activityRepository.save(activities);
    }
    async getUserActivities(userId, filters, pagination = {}) {
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
    async getRecentActivities(limit = 100, filters) {
        const where = this.buildWhereClause(filters);
        return this.activityRepository.find({
            where,
            order: { timestamp: 'DESC' },
            take: limit,
            relations: ['user']
        });
    }
    async getActivitiesByAction(action, pagination = {}) {
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
    async searchActivities(filters, pagination = {}) {
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
    async getUserActivityCount(userId, filters) {
        const where = this.buildWhereClause({ ...filters, userId });
        return this.activityRepository.count({ where });
    }
    async getUserActivityStats(userId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const where = {
            userId,
            timestamp: (0, typeorm_1.Between)(startDate, new Date())
        };
        const [activities, totalActivities] = await this.activityRepository.findAndCount({
            where,
            order: { timestamp: 'DESC' }
        });
        const loginCount = activities.filter(a => a.action === UserActivity_1.ActivityAction.LOGIN).length;
        const failedLoginCount = activities.filter(a => a.action === UserActivity_1.ActivityAction.LOGIN_FAILED).length;
        const actionCounts = activities.reduce((acc, activity) => {
            acc[activity.action] = (acc[activity.action] || 0) + 1;
            return acc;
        }, {});
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
    async getGlobalActivityStats(days = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const activities = await this.activityRepository.find({
            where: {
                timestamp: (0, typeorm_1.Between)(startDate, new Date())
            }
        });
        const totalActivities = activities.length;
        const uniqueUsers = new Set(activities.map(a => a.userId)).size;
        const actionCounts = activities.reduce((acc, activity) => {
            acc[activity.action] = (acc[activity.action] || 0) + 1;
            return acc;
        }, {});
        const topActions = Object.entries(actionCounts)
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        const failedLogins = activities.filter(a => a.action === UserActivity_1.ActivityAction.LOGIN_FAILED).length;
        const successfulLogins = activities.filter(a => a.action === UserActivity_1.ActivityAction.LOGIN).length;
        return {
            totalActivities,
            uniqueUsers,
            topActions,
            failedLogins,
            successfulLogins
        };
    }
    async detectSuspiciousActivity(userId, hoursToCheck = 24) {
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hoursToCheck);
        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: (0, typeorm_1.Between)(startDate, new Date())
            },
            order: { timestamp: 'DESC' }
        });
        const indicators = [];
        const failedLogins = activities.filter(a => a.action === UserActivity_1.ActivityAction.LOGIN_FAILED);
        if (failedLogins.length >= 5) {
            indicators.push(`${failedLogins.length} failed login attempts in the last ${hoursToCheck} hours`);
        }
        const uniqueIPs = new Set(activities
            .filter(a => a.action === UserActivity_1.ActivityAction.LOGIN && a.ipAddress)
            .map(a => a.ipAddress));
        if (uniqueIPs.size >= 5) {
            indicators.push(`Logins from ${uniqueIPs.size} different IP addresses`);
        }
        const recentActivities = activities.slice(0, 10);
        if (recentActivities.length >= 10) {
            const timeSpan = recentActivities[0].timestamp.getTime() -
                recentActivities[9].timestamp.getTime();
            if (timeSpan < 60000) {
                indicators.push('Unusual high-frequency activity detected');
            }
        }
        return {
            isSuspicious: indicators.length > 0,
            indicators
        };
    }
    async cleanupOldActivities(daysToKeep = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const result = await this.activityRepository
            .createQueryBuilder()
            .delete()
            .where('timestamp < :cutoffDate', { cutoffDate })
            .execute();
        return result.affected || 0;
    }
    async getUserActivityTimeline(userId, days = 30, limit = 50) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: (0, typeorm_1.Between)(startDate, new Date())
            },
            order: { timestamp: 'DESC' },
            take: limit * 2
        });
        const timeline = [];
        const categoryCount = {};
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
    mapActivityToTimelineEvent(activity) {
        const actionConfig = {
            [UserActivity_1.ActivityAction.LOGIN]: {
                category: 'authentication',
                title: 'Logged in',
                icon: '🔐',
                importance: 'low'
            },
            [UserActivity_1.ActivityAction.LOGOUT]: {
                category: 'authentication',
                title: 'Logged out',
                icon: '👋',
                importance: 'low'
            },
            [UserActivity_1.ActivityAction.LOGIN_FAILED]: {
                category: 'security',
                title: 'Failed login attempt',
                icon: '⚠️',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.PASSWORD_CHANGED]: {
                category: 'security',
                title: 'Changed password',
                icon: '🔒',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.PASSWORD_RESET_REQUESTED]: {
                category: 'security',
                title: 'Password reset requested',
                icon: '🔄',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.PROFILE_UPDATED]: {
                category: 'profile',
                title: 'Updated profile',
                icon: '✏️',
                importance: 'medium'
            },
            [UserActivity_1.ActivityAction.USER_UPDATED]: {
                category: 'settings',
                title: 'Updated settings',
                icon: '⚙️',
                importance: 'low'
            },
            [UserActivity_1.ActivityAction.ORG_CREATED]: {
                category: 'organization',
                title: 'Created an organization',
                icon: '🚀',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.ORG_JOINED]: {
                category: 'organization',
                title: 'Joined an organization',
                icon: '🎉',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.ORG_LEFT]: {
                category: 'organization',
                title: 'Left an organization',
                icon: '👋',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.SECURITY_ALERT]: {
                category: 'security',
                title: 'Security alert',
                icon: '🔔',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.ACCOUNT_LOCKED]: {
                category: 'security',
                title: 'Account locked',
                icon: '🔒',
                importance: 'high'
            },
            [UserActivity_1.ActivityAction.ACCOUNT_UNLOCKED]: {
                category: 'security',
                title: 'Account unlocked',
                icon: '🔓',
                importance: 'medium'
            }
        };
        const config = actionConfig[activity.action];
        if (!config) {
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
    formatActionName(action) {
        return action
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/^\w/, c => c.toUpperCase());
    }
    calculateActivityStreak(activities) {
        if (activities.length === 0) {
            return 0;
        }
        const activityDates = new Set(activities.map(a => a.timestamp.toISOString().split('T')[0]));
        let streak = 0;
        const today = new Date();
        const currentDate = new Date(today.toISOString().split('T')[0]);
        let hasActivity = true;
        while (hasActivity) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (activityDates.has(dateStr)) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            }
            else {
                hasActivity = false;
            }
        }
        return streak;
    }
    async getActivityHeatmap(userId, months = 12) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        const activities = await this.activityRepository.find({
            where: {
                userId,
                timestamp: (0, typeorm_1.Between)(startDate, new Date())
            },
            select: ['timestamp']
        });
        const dayCounts = {};
        for (const activity of activities) {
            const dateStr = activity.timestamp.toISOString().split('T')[0];
            dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        }
        return Object.entries(dayCounts)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    buildWhereClause(filters) {
        const where = {};
        if (!filters) {
            return where;
        }
        if (filters.userId) {
            where.userId = filters.userId;
        }
        if (filters.action) {
            if (Array.isArray(filters.action)) {
                where.action = (0, typeorm_1.In)(filters.action);
            }
            else {
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
            where.timestamp = (0, typeorm_1.Between)(start, end);
        }
        return where;
    }
}
exports.UserActivityService = UserActivityService;
//# sourceMappingURL=UserActivityService.js.map