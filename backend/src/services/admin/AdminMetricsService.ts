/**
 * Admin Metrics Service
 * Aggregates system metrics with full data obfuscation
 * Provides operational visibility without exposing user data
 */

import { MoreThanOrEqual } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { IncidentStatus, ModerationIncident } from '../../models/ModerationIncident';
import { logger } from '../../utils/logger';
import { enhancedCacheService } from '../caching/EnhancedCacheService';
import { queryAnalyzerService } from '../monitoring/QueryAnalyzerService';

import { AdminSecurityLogService } from './AdminSecurityLogService';

/**
 * System metrics interface
 * Field names aligned with frontend SystemMetrics interface
 */
export interface SystemMetrics {
  timestamp: Date;

  // User metrics (obfuscated)
  users: {
    total: number;
    active24h: number;
    active7d: number;
    active30d: number;
    newUsers24h: number;
    newUsers7d: number;
    newUsers30d: number;
  };

  // Organization metrics (obfuscated)
  organizations: {
    total: number;
    active: number;
    inactive: number;
    avgMembersPerOrg: number;
  };

  // Activity metrics
  activities: {
    total: number;
    created24h: number;
    created7d: number;
    created30d: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };

  // Performance metrics (rates as decimals 0-1)
  performance: {
    cacheHitRate: number;
    avgResponseTime: number;
    totalQueries24h: number;
    errorRate: number;
  };

  // System health
  health: {
    databaseStatus: string;
    cacheStatus: string;
    uptime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * User action metrics (obfuscated)
 */
export interface UserActionMetrics {
  timestamp: Date;
  period: '24h' | '7d' | '30d';

  // Action counts (no user identification)
  totalActions: number;
  actionsByType: Record<string, number>;

  // Top actions (anonymized)
  topActions: Array<{
    action: string;
    count: number;
    // No user info
  }>;

  // Error metrics
  errors: {
    total: number;
    byType: Record<string, number>;
    // No user info, just counts
  };
}

export class AdminMetricsService {
  /**
   * Get comprehensive system metrics
   */
  static async getSystemMetrics(): Promise<SystemMetrics> {
    const [userMetrics, orgMetrics, activityMetrics, performanceMetrics, healthMetrics] =
      await Promise.all([
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

  /**
   * Get user metrics (fully obfuscated)
   */
  private static async getUserMetrics() {
    try {
      const userRepo = AppDataSource.getRepository('User');

      const now = new Date();
      const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [total, active24h, active7d, active30d, newUsers24h, newUsers7d, newUsers30d] =
        await Promise.all([
          userRepo.count(),
          userRepo.count({ where: { lastLoginAt: MoreThanOrEqual(day24Ago) } }).catch(() => 0),
          userRepo.count({ where: { lastLoginAt: MoreThanOrEqual(day7Ago) } }).catch(() => 0),
          userRepo.count({ where: { lastLoginAt: MoreThanOrEqual(day30Ago) } }).catch(() => 0),
          userRepo.count({ where: { createdAt: MoreThanOrEqual(day24Ago) } }).catch(() => 0),
          userRepo.count({ where: { createdAt: MoreThanOrEqual(day7Ago) } }).catch(() => 0),
          userRepo.count({ where: { createdAt: MoreThanOrEqual(day30Ago) } }).catch(() => 0),
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
    } catch (error: unknown) {
      logger.error('Error fetching user metrics', { error });
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

  /**
   * Get organization metrics (obfuscated)
   */
  private static async getOrganizationMetrics() {
    try {
      const orgRepo = AppDataSource.getRepository('Organization');

      const total = await orgRepo.count();

      // Get active/inactive counts (based on recent activity)
      const now = new Date();
      const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const active = await orgRepo
        .count({
          where: { updatedAt: MoreThanOrEqual(day30Ago) },
        })
        .catch(() => Math.floor(total * 0.7)); // Estimate if query fails

      // Calculate average members (aggregated, no org details)
      const avgMembers = await this.calculateAverageMembersPerOrg();

      return {
        total,
        active,
        inactive: total - active,
        avgMembersPerOrg: avgMembers,
      };
    } catch (error: unknown) {
      logger.error('Error fetching organization metrics', { error });
      return {
        total: 0,
        active: 0,
        inactive: 0,
        avgMembersPerOrg: 0,
      };
    }
  }

  /**
   * Calculate average members per organization (aggregated)
   */
  private static async calculateAverageMembersPerOrg(): Promise<number> {
    try {
      const userOrgRepo = AppDataSource.getRepository('OrganizationMembership');
      const orgRepo = AppDataSource.getRepository('Organization');

      const [totalMembers, totalOrgs] = await Promise.all([userOrgRepo.count(), orgRepo.count()]);

      return totalOrgs > 0 ? Math.round(totalMembers / totalOrgs) : 0;
    } catch (_error: unknown) {
      return 0;
    }
  }

  /**
   * Get activity metrics
   */
  private static async getActivityMetrics() {
    try {
      const activityRepo = AppDataSource.getRepository('Activity');

      const now = new Date();
      const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const day30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [total, created24h, created7d, created30d] = await Promise.all([
        activityRepo.count(),
        activityRepo.count({ where: { createdAt: MoreThanOrEqual(day24Ago) } }).catch(() => 0),
        activityRepo.count({ where: { createdAt: MoreThanOrEqual(day7Ago) } }).catch(() => 0),
        activityRepo.count({ where: { createdAt: MoreThanOrEqual(day30Ago) } }).catch(() => 0),
      ]);

      // Get breakdown by type and status via GROUP BY (no user info)
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};

      try {
        const typeResults: Array<{ type: string; count: string }> = await activityRepo
          .createQueryBuilder('activity')
          .select('activity.type', 'type')
          .addSelect('COUNT(*)', 'count')
          .groupBy('activity.type')
          .getRawMany();

        for (const row of typeResults) {
          byType[row.type] = Number(row.count);
        }
      } catch {
        // Activity table may not have type column populated
      }

      try {
        const statusResults: Array<{ status: string; count: string }> = await activityRepo
          .createQueryBuilder('activity')
          .select('activity.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('activity.status')
          .getRawMany();

        for (const row of statusResults) {
          byStatus[row.status] = Number(row.count);
        }
      } catch {
        // Activity table may not have status column populated
      }

      return {
        total,
        created24h,
        created7d,
        created30d,
        byType,
        byStatus,
      };
    } catch (error: unknown) {
      logger.error('Error fetching activity metrics', { error });
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

  /**
   * Get performance metrics from live monitoring services
   */
  private static async getPerformanceMetrics() {
    try {
      const cacheMetrics = enhancedCacheService.getMetrics();
      const queryStats = queryAnalyzerService.getQueryStats();

      // Cache hit rate as decimal (0-1) for frontend multiplication
      const totalCacheOps = cacheMetrics.hits + cacheMetrics.misses;
      const cacheHitRate = totalCacheOps > 0 ? cacheMetrics.hits / totalCacheOps : 0;

      // Average response time from query stats
      const avgResponseTime =
        queryStats.averageDuration > 0 ? Math.round(queryStats.averageDuration) : 0;

      // Total queries tracked
      const totalQueries24h = queryStats.totalQueries;

      // Error rate from security log (failed requests / total activity)
      const securitySummary = AdminSecurityLogService.getLogSummary('24h');
      const totalEvents = securitySummary.totalEvents;
      const errorEvents =
        (securitySummary.bySeverity?.['critical'] ?? 0) +
        (securitySummary.bySeverity?.['warning'] ?? 0);
      const errorRate = totalEvents > 0 ? errorEvents / totalEvents : 0;

      return {
        cacheHitRate,
        avgResponseTime,
        totalQueries24h,
        errorRate,
      };
    } catch (error: unknown) {
      logger.error('Error fetching performance metrics', { error });
      return {
        cacheHitRate: 0,
        avgResponseTime: 0,
        totalQueries24h: 0,
        errorRate: 0,
      };
    }
  }

  /**
   * Get system health metrics
   */
  private static async getHealthMetrics() {
    const memUsage = process.memoryUsage();

    return {
      databaseStatus: AppDataSource.isInitialized ? 'connected' : 'disconnected',
      cacheStatus: 'operational',
      uptime: process.uptime(),
      memoryUsage: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
    };
  }

  /**
   * Get user action metrics (obfuscated)
   */
  static async getUserActionMetrics(
    period: '24h' | '7d' | '30d' = '24h'
  ): Promise<UserActionMetrics> {
    try {
      const securitySummary = AdminSecurityLogService.getLogSummary(period);

      // Build action counts from security events
      const actionsByType: Record<string, number> = {};
      if (securitySummary.byType) {
        for (const [type, count] of Object.entries(securitySummary.byType)) {
          if (count > 0) {
            actionsByType[type] = count;
          }
        }
      }

      // Build top actions sorted by count
      const topActions = Object.entries(actionsByType)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Error counts from security severity
      const errorTotal =
        (securitySummary.bySeverity?.['critical'] ?? 0) +
        (securitySummary.bySeverity?.['warning'] ?? 0);
      const errorsByType: Record<string, number> = {};
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
    } catch (error: unknown) {
      logger.error('Error fetching user action metrics', { error });
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

  /**
   * Get per-day counts for a repository entity using a date column
   */
  private static async getDailyCountsFromRepo(
    entityName: string,
    dateColumn: string,
    days: number,
    now: Date
  ): Promise<Array<{ date: string; value: number }>> {
    const repo = AppDataSource.getRepository(entityName);
    const data: Array<{ date: string; value: number }> = [];

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

  /**
   * Get per-day error counts from in-memory security log
   */
  private static getErrorTimeSeries(
    days: number,
    now: Date
  ): Array<{ date: string; value: number }> {
    const allEvents = AdminSecurityLogService.getRecentEvents(10000);
    const errorsByDate: Record<string, number> = {};

    for (const event of allEvents) {
      if (event.severity === 'warning' || event.severity === 'critical') {
        const dateStr = new Date(event.timestamp).toISOString().split('T')[0];
        errorsByDate[dateStr] = (errorsByDate[dateStr] ?? 0) + 1;
      }
    }

    const data: Array<{ date: string; value: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = dayStart.toISOString().split('T')[0];
      data.push({ date: dateStr, value: errorsByDate[dateStr] ?? 0 });
    }

    return data;
  }

  /**
   * Get time-series metrics for graphs from real database data
   */
  static async getTimeSeriesMetrics(
    metric: 'users' | 'activities' | 'errors',
    days: number = 7
  ): Promise<Array<{ date: string; value: number }>> {
    const now = new Date();

    try {
      if (metric === 'users') {
        return await this.getDailyCountsFromRepo('User', 'lastLoginAt', days, now);
      }
      if (metric === 'activities') {
        return await this.getDailyCountsFromRepo('Activity', 'createdAt', days, now);
      }
      return this.getErrorTimeSeries(days, now);
    } catch (error: unknown) {
      logger.error('Error fetching time series metrics', { error, metric, days });
      const data: Array<{ date: string; value: number }> = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        data.push({ date: date.toISOString().split('T')[0], value: 0 });
      }
      return data;
    }
  }

  /**
   * Get platform-wide moderation analytics (admin only, no tenant scoping)
   * Aggregates moderation incidents across all organizations
   */
  static async getPlatformModerationAnalytics(): Promise<Record<string, unknown>> {
    try {
      const repo = AppDataSource.getRepository(ModerationIncident);

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [total, active, last24h, last7d, last30d] = await Promise.all([
        repo.count(),
        repo.count({ where: { status: IncidentStatus.ACTIVE } }),
        repo.count({ where: { createdAt: MoreThanOrEqual(oneDayAgo) } }),
        repo.count({ where: { createdAt: MoreThanOrEqual(sevenDaysAgo) } }),
        repo.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
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
    } catch (error: unknown) {
      logger.error('Failed to get platform moderation analytics', { error });
      // Return safe defaults if moderation table doesn't exist yet
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

