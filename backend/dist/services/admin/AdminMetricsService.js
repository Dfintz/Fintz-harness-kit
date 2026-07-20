"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMetricsService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const ModerationIncident_1 = require("../../models/ModerationIncident");
const logger_1 = require("../../utils/logger");
const EnhancedCacheService_1 = require("../caching/EnhancedCacheService");
const QueryAnalyzerService_1 = require("../monitoring/QueryAnalyzerService");
const AdminSecurityLogService_1 = require("./AdminSecurityLogService");
class AdminMetricsService {
    static async getSystemMetrics() {
        const [userMetrics, orgMetrics, activityMetrics, performanceMetrics, healthMetrics] = await Promise.all([
            this.getUserMetrics(),
            this.getOrganizationMetrics(),
            this.getActivityMetrics(),
            this.getPerformanceMetrics(),
            this.getHealthMetrics(),
        ]);
        return {
            timestamp: new Date(),
            users: userMetrics,
            organizations: orgMetrics,
            activities: activityMetrics,
            performance: performanceMetrics,
            health: healthMetrics,
        };
    }
    static async getUserMetrics() {
        try {
            const userRepo = data_source_1.AppDataSource.getRepository('User');
            const now = new Date();
            const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [total, active24h, active7d, active30d, newUsers24h, newUsers7d, newUsers30d] = await Promise.all([
                userRepo.count(),
                userRepo.count({ where: { lastLoginAt: (0, typeorm_1.MoreThanOrEqual)(day24Ago) } }).catch(() => 0),
                userRepo.count({ where: { lastLoginAt: (0, typeorm_1.MoreThanOrEqual)(day7Ago) } }).catch(() => 0),
                userRepo.count({ where: { lastLoginAt: (0, typeorm_1.MoreThanOrEqual)(day30Ago) } }).catch(() => 0),
                userRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day24Ago) } }).catch(() => 0),
                userRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day7Ago) } }).catch(() => 0),
                userRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day30Ago) } }).catch(() => 0),
            ]);
            return {
                total,
                active24h,
                active7d,
                active30d,
                newUsers24h,
                newUsers7d,
                newUsers30d,
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching user metrics', { error });
            return {
                total: 0,
                active24h: 0,
                active7d: 0,
                active30d: 0,
                newUsers24h: 0,
                newUsers7d: 0,
                newUsers30d: 0,
            };
        }
    }
    static async getOrganizationMetrics() {
        try {
            const orgRepo = data_source_1.AppDataSource.getRepository('Organization');
            const total = await orgRepo.count();
            const now = new Date();
            const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const active = await orgRepo
                .count({
                where: { updatedAt: (0, typeorm_1.MoreThanOrEqual)(day30Ago) },
            })
                .catch(() => Math.floor(total * 0.7));
            const avgMembers = await this.calculateAverageMembersPerOrg();
            return {
                total,
                active,
                inactive: total - active,
                avgMembersPerOrg: avgMembers,
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching organization metrics', { error });
            return {
                total: 0,
                active: 0,
                inactive: 0,
                avgMembersPerOrg: 0,
            };
        }
    }
    static async calculateAverageMembersPerOrg() {
        try {
            const userOrgRepo = data_source_1.AppDataSource.getRepository('OrganizationMembership');
            const orgRepo = data_source_1.AppDataSource.getRepository('Organization');
            const [totalMembers, totalOrgs] = await Promise.all([userOrgRepo.count(), orgRepo.count()]);
            return totalOrgs > 0 ? Math.round(totalMembers / totalOrgs) : 0;
        }
        catch (_error) {
            return 0;
        }
    }
    static async getActivityMetrics() {
        try {
            const activityRepo = data_source_1.AppDataSource.getRepository('Activity');
            const now = new Date();
            const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [total, created24h, created7d, created30d] = await Promise.all([
                activityRepo.count(),
                activityRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day24Ago) } }).catch(() => 0),
                activityRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day7Ago) } }).catch(() => 0),
                activityRepo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(day30Ago) } }).catch(() => 0),
            ]);
            const byType = {};
            const byStatus = {};
            try {
                const typeResults = await activityRepo
                    .createQueryBuilder('activity')
                    .select('activity.type', 'type')
                    .addSelect('COUNT(*)', 'count')
                    .groupBy('activity.type')
                    .getRawMany();
                for (const row of typeResults) {
                    byType[row.type] = Number(row.count);
                }
            }
            catch {
            }
            try {
                const statusResults = await activityRepo
                    .createQueryBuilder('activity')
                    .select('activity.status', 'status')
                    .addSelect('COUNT(*)', 'count')
                    .groupBy('activity.status')
                    .getRawMany();
                for (const row of statusResults) {
                    byStatus[row.status] = Number(row.count);
                }
            }
            catch {
            }
            return {
                total,
                created24h,
                created7d,
                created30d,
                byType,
                byStatus,
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching activity metrics', { error });
            return {
                total: 0,
                created24h: 0,
                created7d: 0,
                created30d: 0,
                byType: {},
                byStatus: {},
            };
        }
    }
    static async getPerformanceMetrics() {
        try {
            const cacheMetrics = EnhancedCacheService_1.enhancedCacheService.getMetrics();
            const queryStats = QueryAnalyzerService_1.queryAnalyzerService.getQueryStats();
            const totalCacheOps = cacheMetrics.hits + cacheMetrics.misses;
            const cacheHitRate = totalCacheOps > 0 ? cacheMetrics.hits / totalCacheOps : 0;
            const avgResponseTime = queryStats.averageDuration > 0 ? Math.round(queryStats.averageDuration) : 0;
            const totalQueries24h = queryStats.totalQueries;
            const securitySummary = AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary('24h');
            const totalEvents = securitySummary.totalEvents;
            const errorEvents = (securitySummary.bySeverity?.['critical'] ?? 0) +
                (securitySummary.bySeverity?.['warning'] ?? 0);
            const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0;
            return {
                cacheHitRate,
                avgResponseTime,
                totalQueries24h,
                errorRate,
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching performance metrics', { error });
            return {
                cacheHitRate: 0,
                avgResponseTime: 0,
                totalQueries24h: 0,
                errorRate: 0,
            };
        }
    }
    static async getHealthMetrics() {
        const memUsage = process.memoryUsage();
        return {
            databaseStatus: data_source_1.AppDataSource.isInitialized ? 'connected' : 'disconnected',
            cacheStatus: 'operational',
            uptime: process.uptime(),
            memoryUsage: {
                used: Math.round(memUsage.heapUsed / 1024 / 1024),
                total: Math.round(memUsage.heapTotal / 1024 / 1024),
                percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
            },
        };
    }
    static async getUserActionMetrics(period = '24h') {
        try {
            const securitySummary = AdminSecurityLogService_1.AdminSecurityLogService.getLogSummary(period);
            const actionsByType = {};
            if (securitySummary.byType) {
                for (const [type, count] of Object.entries(securitySummary.byType)) {
                    if (count > 0) {
                        actionsByType[type] = count;
                    }
                }
            }
            const topActions = Object.entries(actionsByType)
                .map(([action, count]) => ({ action, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const errorTotal = (securitySummary.bySeverity?.['critical'] ?? 0) +
                (securitySummary.bySeverity?.['warning'] ?? 0);
            const errorsByType = {};
            if (securitySummary.bySeverity?.['critical']) {
                errorsByType['critical'] = securitySummary.bySeverity['critical'];
            }
            if (securitySummary.bySeverity?.['warning']) {
                errorsByType['warning'] = securitySummary.bySeverity['warning'];
            }
            return {
                timestamp: new Date(),
                period,
                totalActions: securitySummary.totalEvents,
                actionsByType,
                topActions,
                errors: {
                    total: errorTotal,
                    byType: errorsByType,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('Error fetching user action metrics', { error });
            return {
                timestamp: new Date(),
                period,
                totalActions: 0,
                actionsByType: {},
                topActions: [],
                errors: { total: 0, byType: {} },
            };
        }
    }
    static async getDailyCountsFromRepo(entityName, dateColumn, days, now) {
        const repo = data_source_1.AppDataSource.getRepository(entityName);
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            const count = await repo
                .createQueryBuilder('entity')
                .where(`entity.${dateColumn} >= :start AND entity.${dateColumn} <= :end`, {
                start: dayStart,
                end: dayEnd,
            })
                .getCount()
                .catch(() => 0);
            data.push({
                date: dayStart.toISOString().split('T')[0],
                value: count,
            });
        }
        return data;
    }
    static getErrorTimeSeries(days, now) {
        const allEvents = AdminSecurityLogService_1.AdminSecurityLogService.getRecentEvents(10000);
        const errorsByDate = {};
        for (const event of allEvents) {
            if (event.severity === 'warning' || event.severity === 'critical') {
                const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
                errorsByDate[dateStr] = (errorsByDate[dateStr] ?? 0) + 1;
            }
        }
        const data = [];
        for (let i = days - 1; i >= 0; i--) {
            const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = dayStart.toISOString().split('T')[0];
            data.push({ date: dateStr, value: errorsByDate[dateStr] ?? 0 });
        }
        return data;
    }
    static async getTimeSeriesMetrics(metric, days = 7) {
        const now = new Date();
        try {
            if (metric === 'users') {
                return await this.getDailyCountsFromRepo('User', 'lastLoginAt', days, now);
            }
            if (metric === 'activities') {
                return await this.getDailyCountsFromRepo('Activity', 'createdAt', days, now);
            }
            return this.getErrorTimeSeries(days, now);
        }
        catch (error) {
            logger_1.logger.error('Error fetching time series metrics', { error, metric, days });
            const data = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
                data.push({ date: date.toISOString().split('T')[0], value: 0 });
            }
            return data;
        }
    }
    static async getPlatformModerationAnalytics() {
        try {
            const repo = data_source_1.AppDataSource.getRepository(ModerationIncident_1.ModerationIncident);
            const now = new Date();
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            const [total, active, last24h, last7d, last30d] = await Promise.all([
                repo.count(),
                repo.count({ where: { status: ModerationIncident_1.IncidentStatus.ACTIVE } }),
                repo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(oneDayAgo) } }),
                repo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(sevenDaysAgo) } }),
                repo.count({ where: { createdAt: (0, typeorm_1.MoreThanOrEqual)(thirtyDaysAgo) } }),
            ]);
            return {
                totalIncidents: total,
                activeIncidents: active,
                resolvedIncidents: total - active,
                incidentsLast24Hours: last24h,
                incidentsLast7Days: last7d,
                incidentsLast30Days: last30d,
                generatedAt: now.toISOString(),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get platform moderation analytics', { error });
            return {
                totalIncidents: 0,
                activeIncidents: 0,
                resolvedIncidents: 0,
                incidentsLast24Hours: 0,
                incidentsLast7Days: 0,
                incidentsLast30Days: 0,
                generatedAt: new Date().toISOString(),
            };
        }
    }
}
exports.AdminMetricsService = AdminMetricsService;
//# sourceMappingURL=AdminMetricsService.js.map