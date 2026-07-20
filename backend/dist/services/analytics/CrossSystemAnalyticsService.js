"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrossSystemAnalyticsService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const StarCommsAttendanceCorrelationService_1 = require("./StarCommsAttendanceCorrelationService");
class CrossSystemAnalyticsService {
    activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
    attendanceCorrelationService = new StarCommsAttendanceCorrelationService_1.StarCommsAttendanceCorrelationService();
    resolveTimeBucket(period) {
        if (period === 'daily') {
            return 'day';
        }
        if (period === 'weekly') {
            return 'week';
        }
        return 'month';
    }
    async getAnalytics(period = 'weekly', orgId, startDate, endDate) {
        const from = startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const to = endDate ?? new Date();
        const [crewFormation, formationSpeed, jobPlacement, lfgConversion] = await Promise.all([
            this.getCrewFormationTrends(period, orgId, from, to),
            this.getFormationSpeedStats(orgId, from, to),
            this.getJobPlacementMetrics(orgId, from, to),
            this.getLfgConversionMetrics(orgId, from, to),
        ]);
        return {
            crewFormation,
            formationSpeed,
            jobPlacement,
            lfgConversion,
            generatedAt: new Date().toISOString(),
        };
    }
    async getAttendanceCorrelationReport(organizationId, filters = {}) {
        return this.attendanceCorrelationService.getReport(organizationId, filters);
    }
    async getActivityAttendanceCorrelationReport(organizationId, activityId) {
        return this.attendanceCorrelationService.getActivityReport(organizationId, activityId);
    }
    formatAttendanceCorrelationCsv(report) {
        return this.attendanceCorrelationService.toCsv(report);
    }
    async getCrewFormationTrends(period, orgId, from, to) {
        const timeBucket = this.resolveTimeBucket(period);
        const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const dateTo = to ?? new Date();
        const query = this.activityRepo
            .createQueryBuilder('a')
            .select(`DATE_TRUNC('${timeBucket}', a."createdAt")`, 'date')
            .addSelect('COUNT(*)', 'count')
            .where('a."createdAt" >= :from', { from: dateFrom })
            .andWhere('a."createdAt" <= :to', { to: dateTo })
            .andWhere('a."currentParticipants" >= :minimumParticipants', { minimumParticipants: 2 })
            .andWhere('a.status IN (:...statuses)', {
            statuses: [Activity_1.ActivityStatus.IN_PROGRESS, Activity_1.ActivityStatus.COMPLETED, Activity_1.ActivityStatus.READY],
        });
        if (orgId) {
            query.andWhere('a."organizationId" = :orgId', { orgId });
        }
        const rows = await query
            .groupBy(`DATE_TRUNC('${timeBucket}', a."createdAt")`)
            .orderBy('date', 'ASC')
            .getRawMany();
        const trends = rows.map(r => ({ date: r.date, count: Number.parseInt(r.count, 10) }));
        const totalFormations = trends.reduce((sum, t) => sum + t.count, 0);
        return {
            period,
            trends,
            totalFormations,
            averagePerPeriod: trends.length > 0 ? Math.round(totalFormations / trends.length) : 0,
        };
    }
    async getFormationSpeedStats(orgId, from, to) {
        const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const dateTo = to ?? new Date();
        const params = [
            dateFrom,
            dateTo,
            Activity_1.ActivityStatus.IN_PROGRESS,
            Activity_1.ActivityStatus.COMPLETED,
            Activity_1.ActivityStatus.READY,
        ];
        let orgClause = '';
        if (orgId) {
            orgClause = 'AND a."organizationId" = $6';
            params.push(orgId);
        }
        const rows = await this.activityRepo.query(`SELECT EXTRACT(EPOCH FROM (MIN(ap."joinedAt") - a."createdAt")) / 60 AS minutes
       FROM activities a
       INNER JOIN activity_participants ap ON ap."activityId" = a.id
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."currentParticipants" >= 2
         AND a.status IN ($3, $4, $5)
         ${orgClause}
       GROUP BY a.id, a."createdAt"`, params);
        const formationMinutes = rows
            .map(row => Number.parseFloat(row.minutes))
            .filter(minutes => Number.isFinite(minutes) && minutes >= 0 && minutes < 10080);
        const buckets = [
            { label: '<5m', max: 5 },
            { label: '5-15m', max: 15 },
            { label: '15-30m', max: 30 },
            { label: '30-60m', max: 60 },
            { label: '1-4h', max: 240 },
            { label: '4-24h', max: 1440 },
            { label: '1d+', max: Infinity },
        ];
        if (formationMinutes.length === 0) {
            return {
                averageMinutes: 0,
                medianMinutes: 0,
                fastestMinutes: 0,
                slowestMinutes: 0,
                distribution: buckets.map(b => ({ bucket: b.label, count: 0 })),
            };
        }
        formationMinutes.sort((a, b) => a - b);
        const avg = formationMinutes.reduce((s, v) => s + v, 0) / formationMinutes.length;
        const median = formationMinutes[Math.floor(formationMinutes.length / 2)];
        const distribution = buckets.map(b => ({
            bucket: b.label,
            count: formationMinutes.filter(m => m < b.max && m >= (buckets.indexOf(b) === 0 ? 0 : buckets[buckets.indexOf(b) - 1].max)).length,
        }));
        return {
            averageMinutes: Math.round(avg),
            medianMinutes: Math.round(median),
            fastestMinutes: Math.round(formationMinutes[0]),
            slowestMinutes: Math.round(formationMinutes.at(-1)),
            distribution,
        };
    }
    async getJobPlacementMetrics(orgId, from, to, period = 'weekly') {
        const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const dateTo = to ?? new Date();
        const jobTypes = [Activity_1.ActivityType.JOB_LISTING, Activity_1.ActivityType.BOUNTY, Activity_1.ActivityType.CONTRACT];
        const timeBucket = this.resolveTimeBucket(period);
        const params = [dateFrom, dateTo];
        let orgClause = '';
        if (orgId) {
            orgClause = 'AND a."organizationId" = $3';
            params.push(orgId);
        }
        const typeRows = await this.activityRepo.query(`SELECT a."activityType" as type,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status = '${Activity_1.ActivityStatus.COMPLETED}') as completed,
              CASE WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE a.status = '${Activity_1.ActivityStatus.COMPLETED}')::float / COUNT(*) * 100)
                ELSE 0 END as rate
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" IN ('${jobTypes.join("','")}')
         ${orgClause}
       GROUP BY a."activityType"`, params);
        const placementTrendQuery = this.activityRepo
            .createQueryBuilder('a')
            .select('DATE_TRUNC(:timeBucket, a."createdAt")', 'date')
            .addSelect('COUNT(*)', 'count')
            .where('a."createdAt" >= :from', { from: dateFrom })
            .andWhere('a."createdAt" <= :to', { to: dateTo })
            .andWhere('a."activityType" IN (:...jobTypes)', { jobTypes })
            .andWhere('a.status = :completedStatus', { completedStatus: Activity_1.ActivityStatus.COMPLETED })
            .setParameter('timeBucket', timeBucket);
        if (orgId) {
            placementTrendQuery.andWhere('a."organizationId" = :orgId', { orgId });
        }
        const trendRows = await placementTrendQuery
            .groupBy('DATE_TRUNC(:timeBucket, a."createdAt")')
            .orderBy('date', 'ASC')
            .getRawMany();
        const durationQb = this.activityRepo
            .createQueryBuilder('a')
            .select('AVG(EXTRACT(EPOCH FROM (a."completedAt" - a."createdAt")) / 86400)', 'avgDays')
            .where('a."createdAt" >= :from', { from: dateFrom })
            .andWhere('a."createdAt" <= :to', { to: dateTo })
            .andWhere('a."activityType" IN (:...types)', { types: jobTypes })
            .andWhere('a.status = :status', { status: Activity_1.ActivityStatus.COMPLETED })
            .andWhere('a."completedAt" IS NOT NULL');
        if (orgId) {
            durationQb.andWhere('a."organizationId" = :orgId', { orgId });
        }
        const durationResult = await durationQb.getRawOne();
        const totalJobs = typeRows.reduce((s, r) => s + Number.parseInt(r.total, 10), 0);
        const completedJobs = typeRows.reduce((s, r) => s + Number.parseInt(r.completed, 10), 0);
        return {
            totalJobs,
            completedJobs,
            placementRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
            averagePlacementDays: Math.round(Number.parseFloat(durationResult?.avgDays ?? '0') * 10) / 10,
            byType: typeRows.map(r => ({
                type: r.type,
                total: Number.parseInt(r.total, 10),
                completed: Number.parseInt(r.completed, 10),
                rate: Math.round(Number.parseFloat(r.rate)),
            })),
            trend: trendRows.map(r => ({ date: r.date, count: Number.parseInt(r.count, 10) })),
        };
    }
    async getLfgConversionMetrics(orgId, from, to, period = 'weekly') {
        const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const dateTo = to ?? new Date();
        const timeBucket = this.resolveTimeBucket(period);
        const params = [dateFrom, dateTo];
        let orgClause = '';
        if (orgId) {
            orgClause = 'AND a."organizationId" = $3';
            params.push(orgId);
        }
        const overallRows = await this.activityRepo.query(`SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status IN ('${Activity_1.ActivityStatus.COMPLETED}', '${Activity_1.ActivityStatus.IN_PROGRESS}', '${Activity_1.ActivityStatus.READY}')) as converted,
              COALESCE(AVG(a."currentParticipants"), 0) as avg_group_size
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" = '${Activity_1.ActivityType.LFG}'
         ${orgClause}`, params);
        const total = Number.parseInt(overallRows[0]?.total ?? '0', 10);
        const converted = Number.parseInt(overallRows[0]?.converted ?? '0', 10);
        const avgGroupSize = Number.parseFloat(overallRows[0]?.avg_group_size ?? '0');
        const convertedStatuses = [
            Activity_1.ActivityStatus.COMPLETED,
            Activity_1.ActivityStatus.IN_PROGRESS,
            Activity_1.ActivityStatus.READY,
        ];
        const lfgTrendQuery = this.activityRepo
            .createQueryBuilder('a')
            .select('DATE_TRUNC(:timeBucket, a."createdAt")', 'date')
            .addSelect('COUNT(*)', 'count')
            .where('a."createdAt" >= :from', { from: dateFrom })
            .andWhere('a."createdAt" <= :to', { to: dateTo })
            .andWhere('a."activityType" = :activityType', { activityType: Activity_1.ActivityType.LFG })
            .andWhere('a.status IN (:...convertedStatuses)', { convertedStatuses })
            .setParameter('timeBucket', timeBucket);
        if (orgId) {
            lfgTrendQuery.andWhere('a."organizationId" = :orgId', { orgId });
        }
        const trendRows = await lfgTrendQuery
            .groupBy('DATE_TRUNC(:timeBucket, a."createdAt")')
            .orderBy('date', 'ASC')
            .getRawMany();
        const locationRows = await this.activityRepo.query(`SELECT COALESCE(a.location, 'Unknown') as location,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status IN ('${Activity_1.ActivityStatus.COMPLETED}', '${Activity_1.ActivityStatus.IN_PROGRESS}', '${Activity_1.ActivityStatus.READY}')) as converted,
              CASE WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE a.status IN ('${Activity_1.ActivityStatus.COMPLETED}', '${Activity_1.ActivityStatus.IN_PROGRESS}', '${Activity_1.ActivityStatus.READY}'))::float / COUNT(*) * 100)
                ELSE 0 END as rate
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" = '${Activity_1.ActivityType.LFG}'
         ${orgClause}
       GROUP BY COALESCE(a.location, 'Unknown')
       ORDER BY total DESC
       LIMIT 10`, params);
        return {
            totalLfg: total,
            converted,
            conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
            averageGroupSize: Math.round(avgGroupSize * 10) / 10,
            trend: trendRows.map(r => ({ date: r.date, count: Number.parseInt(r.count, 10) })),
            byActivity: locationRows.map(r => ({
                activity: r.location,
                total: Number.parseInt(r.total, 10),
                converted: Number.parseInt(r.converted, 10),
                rate: Math.round(Number.parseFloat(r.rate)),
            })),
        };
    }
}
exports.CrossSystemAnalyticsService = CrossSystemAnalyticsService;
//# sourceMappingURL=CrossSystemAnalyticsService.js.map