"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityAnalyticsService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const redis_1 = require("../../utils/redis");
const TenantService_1 = require("../base/TenantService");
class ActivityAnalyticsService extends TenantService_1.TenantService {
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity));
    }
    async getStatusCounts(organizationId, fromDate, toDate) {
        const query = this.repository
            .createQueryBuilder('activity')
            .select('activity.status', 'status')
            .addSelect('COUNT(*)', 'count');
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            query.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            query.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const results = await query.groupBy('activity.status').getRawMany();
        let total = 0;
        let active = 0;
        let completed = 0;
        let cancelled = 0;
        for (const row of results) {
            const count = parseInt(row.count, 10);
            total += count;
            switch (row.status) {
                case Activity_1.ActivityStatus.IN_PROGRESS:
                case Activity_1.ActivityStatus.OPEN:
                case Activity_1.ActivityStatus.RECRUITING:
                    active += count;
                    break;
                case Activity_1.ActivityStatus.COMPLETED:
                    completed += count;
                    break;
                case Activity_1.ActivityStatus.CANCELLED:
                    cancelled += count;
                    break;
            }
        }
        return { total, active, completed, cancelled };
    }
    async getTypeDistribution(organizationId, fromDate, toDate, limit = 10) {
        const query = this.repository
            .createQueryBuilder('activity')
            .select('activity.activityType', 'type')
            .addSelect('COUNT(*)', 'count');
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            query.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            query.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const results = await query
            .groupBy('activity.activityType')
            .orderBy('count', 'DESC')
            .limit(limit)
            .getRawMany();
        return results.map(row => ({
            type: row.type,
            count: parseInt(row.count, 10),
        }));
    }
    async getLocationDistribution(organizationId, fromDate, toDate, limit = 10) {
        const query = this.repository
            .createQueryBuilder('activity')
            .select('activity.location', 'location')
            .addSelect('COUNT(*)', 'count')
            .where('activity.location IS NOT NULL');
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            query.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            query.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const results = await query
            .groupBy('activity.location')
            .orderBy('count', 'DESC')
            .limit(limit)
            .getRawMany();
        return results.map(row => ({
            location: row.location,
            count: parseInt(row.count, 10),
        }));
    }
    async getAverageDuration(organizationId, fromDate, toDate) {
        const query = this.repository
            .createQueryBuilder('activity')
            .select('AVG(COALESCE(activity.actualDuration, activity.estimatedDuration))', 'avgDuration')
            .where('(activity.actualDuration IS NOT NULL OR activity.estimatedDuration IS NOT NULL)');
        if (organizationId) {
            query.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            query.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            query.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const result = await query.getRawOne();
        const avgDuration = parseFloat(result?.avgDuration ?? '0');
        return isNaN(avgDuration) ? 0 : Math.round(avgDuration);
    }
    async getActivityMetrics(organizationId, fromDate, toDate) {
        const cacheKey = `org:${organizationId ?? 'global'}:activity:metrics`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [statusCounts, typeDistribution, locationDistribution, avgDuration] = await Promise.all([
            this.getStatusCounts(organizationId, fromDate, toDate),
            this.getTypeDistribution(organizationId, fromDate, toDate),
            this.getLocationDistribution(organizationId, fromDate, toDate),
            this.getAverageDuration(organizationId, fromDate, toDate),
        ]);
        const participationQuery = this.repository
            .createQueryBuilder('activity')
            .select('AVG(activity.currentParticipants)', 'avgParticipation');
        if (organizationId) {
            participationQuery.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            participationQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            participationQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const participationResult = await participationQuery.getRawOne();
        const participationRate = parseFloat(participationResult?.avgParticipation ?? '0');
        const peakHoursQuery = this.repository
            .createQueryBuilder('activity')
            .select('EXTRACT(HOUR FROM activity.scheduledStartDate)', 'hour')
            .addSelect('COUNT(*)', 'count')
            .where('activity.scheduledStartDate IS NOT NULL');
        if (organizationId) {
            peakHoursQuery.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            peakHoursQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            peakHoursQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const peakHoursResult = await peakHoursQuery
            .groupBy('hour')
            .orderBy('count', 'DESC')
            .getRawMany();
        const peakHours = peakHoursResult.map(row => ({
            hour: parseInt(row.hour, 10),
            count: parseInt(row.count, 10),
        }));
        const orgStatsQuery = this.repository
            .createQueryBuilder('activity')
            .select('activity.organizationId', 'orgId')
            .addSelect('activity.organizationName', 'orgName')
            .addSelect('COUNT(*)', 'count')
            .where('activity.organizationId IS NOT NULL');
        if (organizationId) {
            orgStatsQuery.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            orgStatsQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            orgStatsQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const orgStatsResult = await orgStatsQuery
            .groupBy('activity.organizationId')
            .addGroupBy('activity.organizationName')
            .orderBy('count', 'DESC')
            .limit(20)
            .getRawMany();
        const organizationStats = orgStatsResult.map(row => ({
            orgId: row.orgId,
            orgName: row.orgName || row.orgId,
            count: parseInt(row.count, 10),
        }));
        const result = {
            totalActivities: statusCounts.total,
            activeActivities: statusCounts.active,
            completedActivities: statusCounts.completed,
            cancelledActivities: statusCounts.cancelled,
            participationRate: Math.round(participationRate * 100) / 100,
            averageDuration: avgDuration,
            popularTypes: typeDistribution,
            popularLocations: locationDistribution,
            peakHours,
            organizationStats,
        };
        await redis_1.cache.set(cacheKey, result, 600);
        return result;
    }
    async getParticipationAnalytics(organizationId, fromDate, toDate) {
        const participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
        const activitySubquery = this.repository.createQueryBuilder('a').select('a.id');
        this.applyOrgDateFilters(activitySubquery, organizationId, fromDate, toDate);
        const statsQuery = participantRepo
            .createQueryBuilder('p')
            .select('COUNT(*)::int', 'totalParticipants')
            .addSelect('COUNT(DISTINCT p."userId")::int', 'uniqueParticipants');
        this.applyParticipantActivityFilter(statsQuery, organizationId, fromDate, toDate);
        const stats = await statsQuery.getRawOne();
        const topQuery = participantRepo
            .createQueryBuilder('p')
            .select('p."userId"', 'userId')
            .addSelect('p."userName"', 'userName')
            .addSelect('COUNT(*)::int', 'count');
        this.applyParticipantActivityFilter(topQuery, organizationId, fromDate, toDate);
        const topParticipants = await topQuery
            .groupBy('p."userId"')
            .addGroupBy('p."userName"')
            .orderBy('count', 'DESC')
            .limit(20)
            .getRawMany();
        const activityCount = await activitySubquery.getCount();
        const totalParticipants = stats?.totalParticipants ?? 0;
        return {
            totalParticipants,
            uniqueParticipants: stats?.uniqueParticipants ?? 0,
            averageParticipantsPerActivity: activityCount > 0 ? Math.round((totalParticipants / activityCount) * 100) / 100 : 0,
            topParticipants: topParticipants.map(p => ({
                userId: p.userId,
                userName: p.userName,
                count: p.count,
            })),
            retentionRate: 0,
            newParticipantRate: 0,
        };
    }
    async getPerformanceMetrics(organizationId, fromDate, toDate) {
        const statusCounts = await this.getStatusCounts(organizationId, fromDate, toDate);
        const query = this.repository
            .createQueryBuilder('activity')
            .select([
            'activity.status',
            'activity.scheduledEndDate',
            'activity.completedAt',
            'activity.rewardCredits',
            'activity.metadata',
        ]);
        this.applyOrgDateFilters(query, organizationId, fromDate, toDate);
        query.andWhere('activity.status = :status', { status: Activity_1.ActivityStatus.COMPLETED });
        const completedActivities = await query.getMany();
        const { onTimeCount, totalRating, ratingCount, totalValue } = this.analyzeCompletedActivities(completedActivities);
        const costQuery = this.repository
            .createQueryBuilder('activity')
            .select('SUM(activity.rewardCredits)', 'totalCost');
        this.applyOrgDateFilters(costQuery, organizationId, fromDate, toDate);
        const costResult = await costQuery.getRawOne();
        let totalCost = parseFloat(costResult?.totalCost ?? '0');
        if (isNaN(totalCost)) {
            totalCost = 0;
        }
        const metrics = {
            completionRate: statusCounts.total > 0
                ? Math.round((statusCounts.completed / statusCounts.total) * 100) / 100
                : 0,
            averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 100) / 100 : 0,
            onTimeCompletionRate: completedActivities.length > 0
                ? Math.round((onTimeCount / completedActivities.length) * 100) / 100
                : 0,
            participantSatisfaction: 0,
            resourceUtilization: 0,
            costEffectiveness: totalCost > 0 ? Math.round((totalValue / totalCost) * 100) / 100 : 0,
        };
        return metrics;
    }
    async getTrendAnalysis(period, organizationId, fromDate, toDate) {
        let dateTrunc;
        switch (period) {
            case 'daily':
                dateTrunc = 'DATE(activity.createdAt)';
                break;
            case 'weekly':
                dateTrunc = "DATE_TRUNC('week', activity.createdAt)::date";
                break;
            case 'monthly':
                dateTrunc = "TO_CHAR(activity.createdAt, 'YYYY-MM')";
                break;
        }
        const activityTrendsQuery = this.repository
            .createQueryBuilder('activity')
            .select(`${dateTrunc}`, 'date')
            .addSelect('COUNT(*)', 'count');
        if (organizationId) {
            activityTrendsQuery.andWhere('activity.organizationId = :organizationId', { organizationId });
        }
        if (fromDate) {
            activityTrendsQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            activityTrendsQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const activityTrendsResult = await activityTrendsQuery
            .groupBy('date')
            .orderBy('date', 'ASC')
            .getRawMany();
        const activityTrends = activityTrendsResult.map(row => ({
            date: String(row.date),
            count: parseInt(row.count, 10),
        }));
        const participationTrendsQuery = this.repository
            .createQueryBuilder('activity')
            .select(`${dateTrunc}`, 'date')
            .addSelect('SUM(activity.currentParticipants)', 'participants');
        if (organizationId) {
            participationTrendsQuery.andWhere('activity.organizationId = :organizationId', {
                organizationId,
            });
        }
        if (fromDate) {
            participationTrendsQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            participationTrendsQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const participationTrendsResult = await participationTrendsQuery
            .groupBy('date')
            .orderBy('date', 'ASC')
            .getRawMany();
        const participationTrends = participationTrendsResult.map(row => ({
            date: String(row.date),
            participants: parseInt(row.participants, 10) || 0,
        }));
        const completionTrendsQuery = this.repository
            .createQueryBuilder('activity')
            .select(`${dateTrunc}`, 'date')
            .addSelect(`SUM(CASE WHEN activity.status = :completedStatus THEN 1 ELSE 0 END)`, 'completed')
            .addSelect(`SUM(CASE WHEN activity.status = :cancelledStatus THEN 1 ELSE 0 END)`, 'cancelled')
            .setParameter('completedStatus', Activity_1.ActivityStatus.COMPLETED)
            .setParameter('cancelledStatus', Activity_1.ActivityStatus.CANCELLED);
        if (organizationId) {
            completionTrendsQuery.andWhere('activity.organizationId = :organizationId', {
                organizationId,
            });
        }
        if (fromDate) {
            completionTrendsQuery.andWhere('activity.createdAt >= :fromDate', { fromDate });
        }
        if (toDate) {
            completionTrendsQuery.andWhere('activity.createdAt <= :toDate', { toDate });
        }
        const completionTrendsResult = await completionTrendsQuery
            .groupBy('date')
            .orderBy('date', 'ASC')
            .getRawMany();
        const completionTrends = completionTrendsResult.map(row => ({
            date: String(row.date),
            completed: parseInt(row.completed, 10) || 0,
            cancelled: parseInt(row.cancelled, 10) || 0,
        }));
        const typeDistribution = await this.getTypeDistribution(organizationId, fromDate, toDate, 20);
        const typeTrends = typeDistribution.map(({ type }) => ({
            type,
            trend: 'stable',
            change: 0,
        }));
        return {
            period,
            activityTrends,
            participationTrends,
            completionTrends,
            typeTrends,
        };
    }
    async generateReport(organizationId, fromDate, toDate) {
        const [metrics, participation, performance, trends] = await Promise.all([
            this.getActivityMetrics(organizationId, fromDate, toDate),
            this.getParticipationAnalytics(organizationId, fromDate, toDate),
            this.getPerformanceMetrics(organizationId, fromDate, toDate),
            this.getTrendAnalysis('weekly', organizationId, fromDate, toDate),
        ]);
        return {
            metrics,
            participation,
            performance,
            trends,
            generatedAt: new Date(),
        };
    }
    applyOrgDateFilters(qb, organizationId, fromDate, toDate) {
        if (organizationId) {
            qb.andWhere(`${qb.alias}.organizationId = :organizationId`, { organizationId });
        }
        if (fromDate) {
            qb.andWhere(`${qb.alias}.createdAt >= :fromDate`, { fromDate });
        }
        if (toDate) {
            qb.andWhere(`${qb.alias}.createdAt <= :toDate`, { toDate });
        }
    }
    applyParticipantActivityFilter(qb, organizationId, fromDate, toDate) {
        if (!organizationId && !fromDate && !toDate) {
            return;
        }
        qb.where(outerQb => {
            const sub = outerQb.subQuery().select('a.id').from(Activity_1.Activity, 'a');
            if (organizationId) {
                sub.andWhere('a.organizationId = :organizationId');
            }
            if (fromDate) {
                sub.andWhere('a.createdAt >= :fromDate');
            }
            if (toDate) {
                sub.andWhere('a.createdAt <= :toDate');
            }
            return `p."activityId" IN ${sub.getQuery()}`;
        });
        if (organizationId) {
            qb.setParameter('organizationId', organizationId);
        }
        if (fromDate) {
            qb.setParameter('fromDate', fromDate);
        }
        if (toDate) {
            qb.setParameter('toDate', toDate);
        }
    }
    analyzeCompletedActivities(activities) {
        let onTimeCount = 0;
        let totalRating = 0;
        let ratingCount = 0;
        let totalValue = 0;
        for (const activity of activities) {
            if (activity.scheduledEndDate && activity.completedAt) {
                if (activity.completedAt <= activity.scheduledEndDate) {
                    onTimeCount++;
                }
            }
            if (activity.metadata?.rating) {
                const rating = Number(activity.metadata.rating);
                if (!isNaN(rating)) {
                    totalRating += rating;
                    ratingCount++;
                }
            }
            totalValue += activity.rewardCredits || 0;
        }
        return { onTimeCount, totalRating, ratingCount, totalValue };
    }
}
exports.ActivityAnalyticsService = ActivityAnalyticsService;
//# sourceMappingURL=ActivityAnalyticsService.js.map