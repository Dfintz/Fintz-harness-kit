import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ActivityType } from '../../models/Activity';

import {
  StarCommsAttendanceCorrelationFilters,
  StarCommsAttendanceCorrelationReport,
  StarCommsAttendanceCorrelationService,
} from './StarCommsAttendanceCorrelationService';

// ==================== Interfaces ====================

interface TrendDataPoint {
  date: string;
  count: number;
}

interface CrewFormationTrends {
  period: AnalyticsPeriod;
  trends: TrendDataPoint[];
  totalFormations: number;
  averagePerPeriod: number;
}

interface FormationSpeedStats {
  averageMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  distribution: Array<{ bucket: string; count: number }>;
}

interface PlacementMetrics {
  totalJobs: number;
  completedJobs: number;
  placementRate: number;
  averagePlacementDays: number;
  byType: Array<{ type: string; total: number; completed: number; rate: number }>;
  trend: TrendDataPoint[];
}

interface LfgConversionMetrics {
  totalLfg: number;
  converted: number;
  conversionRate: number;
  averageGroupSize: number;
  trend: TrendDataPoint[];
  byActivity: Array<{ activity: string; total: number; converted: number; rate: number }>;
}

export interface CrossSystemAnalytics {
  crewFormation: CrewFormationTrends;
  formationSpeed: FormationSpeedStats;
  jobPlacement: PlacementMetrics;
  lfgConversion: LfgConversionMetrics;
  generatedAt: string;
}

// DB row interfaces
interface TrendRow {
  date: string;
  count: string;
}
interface TypePlacementRow {
  type: string;
  total: string;
  completed: string;
  rate: string;
}
interface PlacementTrendRow {
  date: string;
  count: string;
}
interface LfgTypeRow {
  location: string;
  total: string;
  converted: string;
  rate: string;
}
interface FormationSpeedRow {
  minutes: string;
}
interface DurationResultRow {
  avgDays: string | null;
}
interface LfgOverallRow {
  total: string;
  converted: string;
  avg_group_size: string;
}

// ==================== Service ====================

type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

export class CrossSystemAnalyticsService {
  private readonly activityRepo = AppDataSource.getRepository(Activity);
  private readonly attendanceCorrelationService = new StarCommsAttendanceCorrelationService();

  private resolveTimeBucket(period: AnalyticsPeriod): 'day' | 'week' | 'month' {
    if (period === 'daily') {
      return 'day';
    }

    if (period === 'weekly') {
      return 'week';
    }

    return 'month';
  }

  /**
   * Get all cross-system analytics in one call
   */
  async getAnalytics(
    period: AnalyticsPeriod = 'weekly',
    orgId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CrossSystemAnalytics> {
    const from = startDate ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days default
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

  async getAttendanceCorrelationReport(
    organizationId: string,
    filters: StarCommsAttendanceCorrelationFilters = {}
  ): Promise<StarCommsAttendanceCorrelationReport> {
    return this.attendanceCorrelationService.getReport(organizationId, filters);
  }

  async getActivityAttendanceCorrelationReport(
    organizationId: string,
    activityId: string
  ): Promise<StarCommsAttendanceCorrelationReport> {
    return this.attendanceCorrelationService.getActivityReport(organizationId, activityId);
  }

  formatAttendanceCorrelationCsv(report: StarCommsAttendanceCorrelationReport): string {
    return this.attendanceCorrelationService.toCsv(report);
  }

  /**
   * Crew formation trends over time
   */
  async getCrewFormationTrends(
    period: AnalyticsPeriod,
    orgId?: string,
    from?: Date,
    to?: Date
  ): Promise<CrewFormationTrends> {
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
        statuses: [ActivityStatus.IN_PROGRESS, ActivityStatus.COMPLETED, ActivityStatus.READY],
      });

    if (orgId) {
      query.andWhere('a."organizationId" = :orgId', { orgId });
    }

    const rows: TrendRow[] = await query
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

  /**
   * Team/crew formation speed statistics
   */
  async getFormationSpeedStats(
    orgId?: string,
    from?: Date,
    to?: Date
  ): Promise<FormationSpeedStats> {
    const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateTo = to ?? new Date();
    const params: (Date | string)[] = [
      dateFrom,
      dateTo,
      ActivityStatus.IN_PROGRESS,
      ActivityStatus.COMPLETED,
      ActivityStatus.READY,
    ];
    let orgClause = '';

    if (orgId) {
      orgClause = 'AND a."organizationId" = $6';
      params.push(orgId);
    }

    const rows: FormationSpeedRow[] = await this.activityRepo.query(
      `SELECT EXTRACT(EPOCH FROM (MIN(ap."joinedAt") - a."createdAt")) / 60 AS minutes
       FROM activities a
       INNER JOIN activity_participants ap ON ap."activityId" = a.id
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."currentParticipants" >= 2
         AND a.status IN ($3, $4, $5)
         ${orgClause}
       GROUP BY a.id, a."createdAt"`,
      params
    );

    const formationMinutes = rows
      .map(row => Number.parseFloat(row.minutes))
      .filter(minutes => Number.isFinite(minutes) && minutes >= 0 && minutes < 10080);

    // Distribution buckets (fixed domain categories)
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
      count: formationMinutes.filter(
        m => m < b.max && m >= (buckets.indexOf(b) === 0 ? 0 : buckets[buckets.indexOf(b) - 1].max)
      ).length,
    }));

    return {
      averageMinutes: Math.round(avg),
      medianMinutes: Math.round(median),
      fastestMinutes: Math.round(formationMinutes[0]),
      slowestMinutes: Math.round(formationMinutes.at(-1)!),
      distribution,
    };
  }

  /**
   * Job placement rate metrics
   */
  async getJobPlacementMetrics(
    orgId?: string,
    from?: Date,
    to?: Date,
    period: AnalyticsPeriod = 'weekly'
  ): Promise<PlacementMetrics> {
    const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateTo = to ?? new Date();
    const jobTypes = [ActivityType.JOB_LISTING, ActivityType.BOUNTY, ActivityType.CONTRACT];
    const timeBucket = this.resolveTimeBucket(period);

    const params: (string | Date)[] = [dateFrom, dateTo];
    let orgClause = '';
    if (orgId) {
      orgClause = 'AND a."organizationId" = $3';
      params.push(orgId);
    }

    // By type breakdown
    const typeRows: TypePlacementRow[] = await this.activityRepo.query(
      `SELECT a."activityType" as type,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status = '${ActivityStatus.COMPLETED}') as completed,
              CASE WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE a.status = '${ActivityStatus.COMPLETED}')::float / COUNT(*) * 100)
                ELSE 0 END as rate
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" IN ('${jobTypes.join("','")}')
         ${orgClause}
       GROUP BY a."activityType"`,
      params
    );

    // Overall trend
    const placementTrendQuery = this.activityRepo
      .createQueryBuilder('a')
      .select('DATE_TRUNC(:timeBucket, a."createdAt")', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('a."createdAt" >= :from', { from: dateFrom })
      .andWhere('a."createdAt" <= :to', { to: dateTo })
      .andWhere('a."activityType" IN (:...jobTypes)', { jobTypes })
      .andWhere('a.status = :completedStatus', { completedStatus: ActivityStatus.COMPLETED })
      .setParameter('timeBucket', timeBucket);

    if (orgId) {
      placementTrendQuery.andWhere('a."organizationId" = :orgId', { orgId });
    }

    const trendRows: PlacementTrendRow[] = await placementTrendQuery
      .groupBy('DATE_TRUNC(:timeBucket, a."createdAt")')
      .orderBy('date', 'ASC')
      .getRawMany();

    // Average placement time
    const durationQb = this.activityRepo
      .createQueryBuilder('a')
      .select('AVG(EXTRACT(EPOCH FROM (a."completedAt" - a."createdAt")) / 86400)', 'avgDays')
      .where('a."createdAt" >= :from', { from: dateFrom })
      .andWhere('a."createdAt" <= :to', { to: dateTo })
      .andWhere('a."activityType" IN (:...types)', { types: jobTypes })
      .andWhere('a.status = :status', { status: ActivityStatus.COMPLETED })
      .andWhere('a."completedAt" IS NOT NULL');

    if (orgId) {
      durationQb.andWhere('a."organizationId" = :orgId', { orgId });
    }

    const durationResult = await durationQb.getRawOne<DurationResultRow>();

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

  /**
   * LFG to team/group conversion metrics
   */
  async getLfgConversionMetrics(
    orgId?: string,
    from?: Date,
    to?: Date,
    period: AnalyticsPeriod = 'weekly'
  ): Promise<LfgConversionMetrics> {
    const dateFrom = from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const dateTo = to ?? new Date();
    const timeBucket = this.resolveTimeBucket(period);

    const params: (string | Date)[] = [dateFrom, dateTo];
    let orgClause = '';
    if (orgId) {
      orgClause = 'AND a."organizationId" = $3';
      params.push(orgId);
    }

    // Overall LFG counts
    const overallRows: LfgOverallRow[] = await this.activityRepo.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status IN ('${ActivityStatus.COMPLETED}', '${ActivityStatus.IN_PROGRESS}', '${ActivityStatus.READY}')) as converted,
              COALESCE(AVG(a."currentParticipants"), 0) as avg_group_size
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" = '${ActivityType.LFG}'
         ${orgClause}`,
      params
    );

    const total = Number.parseInt(overallRows[0]?.total ?? '0', 10);
    const converted = Number.parseInt(overallRows[0]?.converted ?? '0', 10);
    const avgGroupSize = Number.parseFloat(overallRows[0]?.avg_group_size ?? '0');

    const convertedStatuses = [
      ActivityStatus.COMPLETED,
      ActivityStatus.IN_PROGRESS,
      ActivityStatus.READY,
    ];

    // Trend over time
    const lfgTrendQuery = this.activityRepo
      .createQueryBuilder('a')
      .select('DATE_TRUNC(:timeBucket, a."createdAt")', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('a."createdAt" >= :from', { from: dateFrom })
      .andWhere('a."createdAt" <= :to', { to: dateTo })
      .andWhere('a."activityType" = :activityType', { activityType: ActivityType.LFG })
      .andWhere('a.status IN (:...convertedStatuses)', { convertedStatuses })
      .setParameter('timeBucket', timeBucket);

    if (orgId) {
      lfgTrendQuery.andWhere('a."organizationId" = :orgId', { orgId });
    }

    const trendRows: TrendRow[] = await lfgTrendQuery
      .groupBy('DATE_TRUNC(:timeBucket, a."createdAt")')
      .orderBy('date', 'ASC')
      .getRawMany();

    // By location (approximation of "by activity")
    const locationRows: LfgTypeRow[] = await this.activityRepo.query(
      `SELECT COALESCE(a.location, 'Unknown') as location,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE a.status IN ('${ActivityStatus.COMPLETED}', '${ActivityStatus.IN_PROGRESS}', '${ActivityStatus.READY}')) as converted,
              CASE WHEN COUNT(*) > 0
                THEN (COUNT(*) FILTER (WHERE a.status IN ('${ActivityStatus.COMPLETED}', '${ActivityStatus.IN_PROGRESS}', '${ActivityStatus.READY}'))::float / COUNT(*) * 100)
                ELSE 0 END as rate
       FROM activities a
       WHERE a."createdAt" >= $1 AND a."createdAt" <= $2
         AND a."activityType" = '${ActivityType.LFG}'
         ${orgClause}
       GROUP BY COALESCE(a.location, 'Unknown')
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

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
