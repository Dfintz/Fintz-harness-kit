import { SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity, ActivityStatus, ActivityType } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { cache } from '../../utils/redis';
import { TenantService } from '../base/TenantService';

// ==================== RAW QUERY RESULT INTERFACES ====================

/** Raw query result for status counts */
interface StatusCountRow {
  status: ActivityStatus;
  count: string;
}

/** Raw query result for type distribution */
interface TypeDistributionRow {
  type: string;
  count: string;
}

/** Raw query result for location distribution */
interface LocationDistributionRow {
  location: string;
  count: string;
}

/** Raw query result for date-based trends */
interface TrendRow {
  date: string;
  count: string;
}

/** Raw query result for participation trends */
interface ParticipationTrendRow {
  date: string;
  participants: string;
}

/** Raw query result for completion trends */
interface CompletionTrendRow {
  date: string;
  completed: string;
  cancelled: string;
}

/** Raw query result for organization stats */
interface OrgStatsRow {
  orgId: string;
  orgName: string;
  count: string;
}

/** Raw query result for peak hours */
interface PeakHourRow {
  hour: string;
  count: string;
}

/** Raw query result for cost aggregation */
interface CostResultRow {
  totalCost: string;
}

/** Raw query result for participation aggregation */
interface ParticipationResultRow {
  avgParticipation: string;
}

/** Raw query result for duration aggregation */
interface DurationResultRow {
  avgDuration: string;
}

/**
 * Activity metrics summary including counts, rates, and distributions
 */
export interface ActivityMetrics {
  /** Total number of activities in the queried period */
  totalActivities: number;
  /** Number of currently active/in-progress activities */
  activeActivities: number;
  /** Number of completed activities */
  completedActivities: number;
  /** Number of cancelled activities */
  cancelledActivities: number;
  /** Average participation rate (participants per activity) */
  participationRate: number;
  /** Average activity duration in minutes */
  averageDuration: number;
  /** Most popular activity types by count */
  popularTypes: { type: ActivityType; count: number }[];
  /** Most popular locations by count */
  popularLocations: { location: string; count: number }[];
  /** Activity creation distribution by hour of day */
  peakHours: { hour: number; count: number }[];
  /** Activity distribution by organization */
  organizationStats: { orgId: string; orgName: string; count: number }[];
}

/**
 * Participation analytics for understanding user engagement
 */
export interface ParticipationAnalytics {
  /** Total participant count (including duplicates across activities) */
  totalParticipants: number;
  /** Number of unique participants */
  uniqueParticipants: number;
  /** Average participants per activity */
  averageParticipantsPerActivity: number;
  /** Top participants by activity count */
  topParticipants: { userId: string; userName: string; count: number }[];
  /** User retention rate (returning users percentage) */
  retentionRate: number;
  /** New participant rate in queried period */
  newParticipantRate: number;
}

/**
 * Performance metrics for activity completion and quality
 */
export interface PerformanceMetrics {
  /** Percentage of activities that completed successfully */
  completionRate: number;
  /** Average activity rating from participants */
  averageRating: number;
  /** Percentage of activities completed on time */
  onTimeCompletionRate: number;
  /** Participant satisfaction score (0-100) */
  participantSatisfaction: number;
  /** Resource utilization efficiency */
  resourceUtilization: number;
  /** Cost effectiveness ratio (value/cost) */
  costEffectiveness: number;
}

/**
 * Trend analysis for activity patterns over time
 */
export interface TrendAnalysis {
  /** Time period granularity for the analysis */
  period: 'daily' | 'weekly' | 'monthly';
  /** Activity count trends over time */
  activityTrends: { date: string; count: number }[];
  /** Participation trends over time */
  participationTrends: { date: string; participants: number }[];
  /** Completion and cancellation trends */
  completionTrends: { date: string; completed: number; cancelled: number }[];
  /** Activity type popularity trends */
  typeTrends: { type: ActivityType; trend: 'up' | 'down' | 'stable'; change: number }[];
}

/**
 * ActivityAnalyticsService
 *
 * Provides analytics and reporting for activities with optimized database queries.
 *
 * **Performance Notes:**
 * - Uses database-level aggregation for large datasets when available
 * - Falls back to in-memory processing for complex analytics
 * - Supports pagination and limits for large result sets
 *
 * **Usage:**
 * ```typescript
 * const analyticsService = new ActivityAnalyticsService();
 * const metrics = await analyticsService.getActivityMetrics('org-123');
 * const trends = await analyticsService.getTrendAnalysis('weekly', 'org-123');
 * ```
 *
 * @author GitHub Copilot
 * @since October 2025
 * @see ActivityService for core activity management
 */
export class ActivityAnalyticsService extends TenantService<Activity> {
  constructor() {
    super(AppDataSource.getRepository(Activity));
  }

  // ==================== OPTIMIZED STATUS COUNTS ====================

  /**
   * Get activity counts by status using database aggregation
   * More efficient than loading all activities into memory
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Object with counts by status
   */
  async getStatusCounts(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    total: number;
    active: number;
    completed: number;
    cancelled: number;
  }> {
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

    const results: StatusCountRow[] = await query.groupBy('activity.status').getRawMany();

    let total = 0;
    let active = 0;
    let completed = 0;
    let cancelled = 0;

    for (const row of results) {
      const count = parseInt(row.count, 10);
      total += count;
      switch (row.status) {
        case ActivityStatus.IN_PROGRESS:
        case ActivityStatus.OPEN:
        case ActivityStatus.RECRUITING:
          active += count;
          break;
        case ActivityStatus.COMPLETED:
          completed += count;
          break;
        case ActivityStatus.CANCELLED:
          cancelled += count;
          break;
      }
    }

    return { total, active, completed, cancelled };
  }

  /**
   * Get activity type distribution using database aggregation
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @param limit - Maximum number of types to return (default: 10)
   * @returns Array of activity types with counts, sorted by popularity
   */
  async getTypeDistribution(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 10
  ): Promise<{ type: ActivityType; count: number }[]> {
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

    const results: TypeDistributionRow[] = await query
      .groupBy('activity.activityType')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(row => ({
      type: row.type as ActivityType,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Get location distribution using database aggregation
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @param limit - Maximum number of locations to return (default: 10)
   * @returns Array of locations with counts, sorted by popularity
   */
  async getLocationDistribution(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 10
  ): Promise<{ location: string; count: number }[]> {
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

    const results: LocationDistributionRow[] = await query
      .groupBy('activity.location')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map(row => ({
      location: row.location,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Get average duration using database aggregation
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Average duration in minutes (or 0 if no data)
   */
  async getAverageDuration(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<number> {
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

    const result = await query.getRawOne<DurationResultRow>();
    const avgDuration = parseFloat(result?.avgDuration ?? '0');
    return isNaN(avgDuration) ? 0 : Math.round(avgDuration);
  }

  // ==================== ACTIVITY METRICS ====================

  /**
   * Get comprehensive activity metrics using optimized database aggregation
   *
   * This method uses database-level aggregation queries for better performance
   * on large datasets. For complex analytics that require in-memory processing,
   * consider using pagination or limiting the date range.
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Comprehensive activity metrics
   *
   * @example
   * ```typescript
   * const metrics = await analyticsService.getActivityMetrics('org-123');
   * logger.debug(`Total: ${metrics.totalActivities}, Completed: ${metrics.completedActivities}`);
   * ```
   */
  async getActivityMetrics(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ActivityMetrics> {
    // Redis cache: 10 min TTL (Phase 5.9)
    const cacheKey = `org:${organizationId ?? 'global'}:activity:metrics`;
    const cached = await cache.get<ActivityMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Use optimized database aggregation for core metrics
    const [statusCounts, typeDistribution, locationDistribution, avgDuration] = await Promise.all([
      this.getStatusCounts(organizationId, fromDate, toDate),
      this.getTypeDistribution(organizationId, fromDate, toDate),
      this.getLocationDistribution(organizationId, fromDate, toDate),
      this.getAverageDuration(organizationId, fromDate, toDate),
    ]);

    // Get participation rate using database aggregation
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

    const participationResult = await participationQuery.getRawOne<ParticipationResultRow>();
    const participationRate = parseFloat(participationResult?.avgParticipation ?? '0');

    // Get peak hours - requires loading some data but with minimal fields
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

    const peakHoursResult: PeakHourRow[] = await peakHoursQuery
      .groupBy('hour')
      .orderBy('count', 'DESC')
      .getRawMany();

    const peakHours = peakHoursResult.map(row => ({
      hour: parseInt(row.hour, 10),
      count: parseInt(row.count, 10),
    }));

    // Get organization stats
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

    const orgStatsResult: OrgStatsRow[] = await orgStatsQuery
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

    const result: ActivityMetrics = {
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

    await cache.set(cacheKey, result, 600); // 10 min

    return result;
  }

  // ==================== PARTICIPATION ANALYTICS ====================

  /**
   * Get participation analytics for activities
   *
   * **Note:** This method requires loading participant data from JSON arrays,
   * which cannot be efficiently aggregated at the database level.
   * For very large datasets, consider using pagination via `getParticipationAnalyticsPaginated`.
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Participation analytics including top participants and engagement rates
   *
   * @example
   * ```typescript
   * const analytics = await analyticsService.getParticipationAnalytics('org-123');
   * logger.debug(`Unique participants: ${analytics.uniqueParticipants}`);
   * ```
   */
  async getParticipationAnalytics(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ParticipationAnalytics> {
    // Phase 4: Use normalized activity_participants table instead of loading JSON blobs
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);

    // Build activity ID subquery for org/date filtering
    const activitySubquery = this.repository.createQueryBuilder('a').select('a.id');
    this.applyOrgDateFilters(activitySubquery, organizationId, fromDate, toDate);

    // Total + unique participants via SQL aggregation
    const statsQuery = participantRepo
      .createQueryBuilder('p')
      .select('COUNT(*)::int', 'totalParticipants')
      .addSelect('COUNT(DISTINCT p."userId")::int', 'uniqueParticipants');

    this.applyParticipantActivityFilter(statsQuery, organizationId, fromDate, toDate);

    const stats = await statsQuery.getRawOne<{
      totalParticipants: number;
      uniqueParticipants: number;
    }>();

    // Top participants via SQL GROUP BY + ORDER BY (replaces in-memory sort)
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
      .getRawMany<{ userId: string; userName: string; count: number }>();

    // Activity count for averaging
    const activityCount = await activitySubquery.getCount();

    const totalParticipants = stats?.totalParticipants ?? 0;

    return {
      totalParticipants,
      uniqueParticipants: stats?.uniqueParticipants ?? 0,
      averageParticipantsPerActivity:
        activityCount > 0 ? Math.round((totalParticipants / activityCount) * 100) / 100 : 0,
      topParticipants: topParticipants.map(p => ({
        userId: p.userId,
        userName: p.userName,
        count: p.count,
      })),
      retentionRate: 0,
      newParticipantRate: 0,
    };
  }

  // ==================== PERFORMANCE METRICS ====================

  /**
   * Get performance metrics for activities
   *
   * Calculates completion rates, on-time performance, and cost effectiveness.
   * Uses optimized queries for status-based counts.
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Performance metrics including completion and on-time rates
   *
   * @example
   * ```typescript
   * const metrics = await analyticsService.getPerformanceMetrics('org-123');
   * logger.debug(`Completion rate: ${metrics.completionRate * 100}%`);
   * ```
   */
  async getPerformanceMetrics(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<PerformanceMetrics> {
    // Use optimized status counts
    const statusCounts = await this.getStatusCounts(organizationId, fromDate, toDate);

    // Query for on-time completion and cost metrics
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
    query.andWhere('activity.status = :status', { status: ActivityStatus.COMPLETED });

    const completedActivities = await query.getMany();
    const { onTimeCount, totalRating, ratingCount, totalValue } =
      this.analyzeCompletedActivities(completedActivities);

    // Get total cost from all activities
    const costQuery = this.repository
      .createQueryBuilder('activity')
      .select('SUM(activity.rewardCredits)', 'totalCost');
    this.applyOrgDateFilters(costQuery, organizationId, fromDate, toDate);

    const costResult = await costQuery.getRawOne<CostResultRow>();
    let totalCost = parseFloat(costResult?.totalCost ?? '0');
    if (isNaN(totalCost)) {
      totalCost = 0;
    }

    const metrics: PerformanceMetrics = {
      completionRate:
        statusCounts.total > 0
          ? Math.round((statusCounts.completed / statusCounts.total) * 100) / 100
          : 0,
      averageRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 100) / 100 : 0,
      onTimeCompletionRate:
        completedActivities.length > 0
          ? Math.round((onTimeCount / completedActivities.length) * 100) / 100
          : 0,
      participantSatisfaction: 0, // Would need participant feedback system
      resourceUtilization: 0, // Would need resource tracking
      costEffectiveness: totalCost > 0 ? Math.round((totalValue / totalCost) * 100) / 100 : 0,
    };

    return metrics;
  }

  // ==================== TREND ANALYSIS ====================

  /**
   * Get trend analysis for activities over time
   *
   * Groups activities by time period and calculates trends for:
   * - Activity creation counts
   * - Participation numbers
   * - Completion and cancellation rates
   * - Activity type popularity
   *
   * @param period - Time period granularity ('daily', 'weekly', or 'monthly')
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Trend analysis with activity, participation, and completion trends
   *
   * @example
   * ```typescript
   * const trends = await analyticsService.getTrendAnalysis('weekly', 'org-123');
   * trends.activityTrends.forEach(t => logger.debug(`${t.date}: ${t.count} activities`));
   * ```
   */
  async getTrendAnalysis(
    period: 'daily' | 'weekly' | 'monthly',
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<TrendAnalysis> {
    // Build date truncation expression based on period
    let dateTrunc: string;
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

    // Activity count trends using database aggregation
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

    const activityTrendsResult: TrendRow[] = await activityTrendsQuery
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const activityTrends = activityTrendsResult.map(row => ({
      date: String(row.date),
      count: parseInt(row.count, 10),
    }));

    // Participation trends
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

    const participationTrendsResult: ParticipationTrendRow[] = await participationTrendsQuery
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const participationTrends = participationTrendsResult.map(row => ({
      date: String(row.date),
      participants: parseInt(row.participants, 10) || 0,
    }));

    // Completion trends - using parameterized queries for security
    const completionTrendsQuery = this.repository
      .createQueryBuilder('activity')
      .select(`${dateTrunc}`, 'date')
      .addSelect(`SUM(CASE WHEN activity.status = :completedStatus THEN 1 ELSE 0 END)`, 'completed')
      .addSelect(`SUM(CASE WHEN activity.status = :cancelledStatus THEN 1 ELSE 0 END)`, 'cancelled')
      .setParameter('completedStatus', ActivityStatus.COMPLETED)
      .setParameter('cancelledStatus', ActivityStatus.CANCELLED);

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

    const completionTrendsResult: CompletionTrendRow[] = await completionTrendsQuery
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const completionTrends = completionTrendsResult.map(row => ({
      date: String(row.date),
      completed: parseInt(row.completed, 10) || 0,
      cancelled: parseInt(row.cancelled, 10) || 0,
    }));

    // Type trends - get current distribution
    const typeDistribution = await this.getTypeDistribution(organizationId, fromDate, toDate, 20);

    const typeTrends = typeDistribution.map(({ type }) => ({
      type,
      trend: 'stable' as const, // Would need historical comparison
      change: 0, // Would calculate from historical comparison
    }));

    return {
      period,
      activityTrends,
      participationTrends,
      completionTrends,
      typeTrends,
    };
  }

  // ==================== EXPORT AND REPORTING ====================

  /**
   * Generate comprehensive activity report
   *
   * Aggregates all analytics into a single report with metrics,
   * participation data, performance analysis, and trends.
   * Uses parallel queries for optimal performance.
   *
   * @param organizationId - Optional organization filter
   * @param fromDate - Optional start date filter
   * @param toDate - Optional end date filter
   * @returns Comprehensive report with all analytics
   *
   * @example
   * ```typescript
   * const report = await analyticsService.generateReport('org-123');
   * logger.debug(`Report generated at: ${report.generatedAt}`);
   * logger.debug(`Total activities: ${report.metrics.totalActivities}`);
   * ```
   */
  async generateReport(
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    metrics: ActivityMetrics;
    participation: ParticipationAnalytics;
    performance: PerformanceMetrics;
    trends: TrendAnalysis;
    generatedAt: Date;
  }> {
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

  // ==================== PRIVATE HELPERS ====================

  /**
   * Apply optional organizationId + date range filters to an Activity query builder.
   * Reduces cognitive complexity by centralizing the 3-clause filter pattern.
   */
  private applyOrgDateFilters(
    qb: SelectQueryBuilder<Activity>,
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): void {
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

  /**
   * Apply an activity-filtering IN subquery to a participant query builder.
   * Used by getParticipationAnalytics to filter participant rows by org/date.
   */
  private applyParticipantActivityFilter(
    qb: SelectQueryBuilder<ActivityParticipantEntity>,
    organizationId?: string,
    fromDate?: Date,
    toDate?: Date
  ): void {
    if (!organizationId && !fromDate && !toDate) {
      return;
    }

    qb.where(outerQb => {
      const sub = outerQb.subQuery().select('a.id').from(Activity, 'a');
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

  /**
   * Analyze completed activities for on-time, rating, and value metrics.
   */
  private analyzeCompletedActivities(activities: Activity[]): {
    onTimeCount: number;
    totalRating: number;
    ratingCount: number;
    totalValue: number;
  } {
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

