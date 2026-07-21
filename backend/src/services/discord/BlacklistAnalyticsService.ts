import { MoreThan } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { MirrorAction, MirrorActionStatus } from '../../models/MirrorAction';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  ModerationIncident,
} from '../../models/ModerationIncident';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';

/**
 * Repeat offender threshold configuration
 */
export const REPEAT_OFFENDER_THRESHOLDS = {
  // Number of incidents to be considered a repeat offender
  minIncidents: Number(process.env.REPEAT_OFFENDER_MIN_INCIDENTS ?? 3),
  // Time window in days to consider for repeat offender detection
  windowDays: Number(process.env.REPEAT_OFFENDER_WINDOW_DAYS ?? 90),
  // Minimum severity to consider for repeat offender detection
  minSeverity: Number(process.env.REPEAT_OFFENDER_MIN_SEVERITY ?? IncidentSeverity.TIMEOUT),
  // Risk score threshold for high-risk classification (0-100)
  highRiskThreshold: Number(process.env.REPEAT_OFFENDER_HIGH_RISK_THRESHOLD ?? 70),
};

/**
 * Time-based analytics periods
 */
export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
  label: string;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: string;
  count: number;
  label?: string;
}

/**
 * Repeat offender information
 */
export interface RepeatOffender {
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  activeIncidents: number;
  highestSeverity: IncidentSeverity;
  firstIncident: Date;
  lastIncident: Date;
  incidentsByType: Record<IncidentType, number>;
  riskScore: number;
  isHighRisk: boolean;
}

/**
 * Moderation analytics summary
 */
export interface ModerationAnalytics {
  // Summary statistics
  totalIncidents: number;
  activeIncidents: number;
  resolvedIncidents: number;
  sharedIncidents: number;
  autoDetectedIncidents: number;

  // By type breakdown
  byType: Record<IncidentType, number>;

  // By severity breakdown
  bySeverity: Record<IncidentSeverity, number>;

  // By status breakdown
  byStatus: Record<IncidentStatus, number>;

  // Trends
  dailyTrend: TrendDataPoint[];
  weeklyTrend: TrendDataPoint[];
  monthlyTrend: TrendDataPoint[];

  // Top metrics
  uniqueTargets: number;
  uniqueModerators: number;
  averageSeverity: number;

  // Repeat offenders
  repeatOffenders: RepeatOffender[];
  repeatOffenderCount: number;

  // Mirror action stats
  mirrorStats: {
    totalMirrors: number;
    confirmedMirrors: number;
    pendingMirrors: number;
    cancelledMirrors: number;
    failedMirrors: number;
  };

  // Time-based metrics
  incidentsLast24Hours: number;
  incidentsLast7Days: number;
  incidentsLast30Days: number;

  // Generated timestamp
  generatedAt: Date;
}

/**
 * BlacklistAnalyticsService
 *
 * Provides analytics and insights for the moderation incident system.
 * Part of Phase 4: Cross-Discord Blacklist System - Analytics & GDPR Compliance.
 *
 * Features:
 * - Moderation trend analysis (daily, weekly, monthly)
 * - Repeat offender detection and risk scoring
 * - Incident type and severity distribution
 * - Mirror action statistics
 * - Time-based metrics
 */
export class BlacklistAnalyticsService extends TenantService<ModerationIncident> {
  private static instance: BlacklistAnalyticsService | null = null;
  private _mirrorRepository?: import('typeorm').Repository<MirrorAction>;

  /** Lazy accessor for mirror repository to avoid crash if DB not yet initialized */
  private get mirrorRepository(): import('typeorm').Repository<MirrorAction> {
    this._mirrorRepository ??= AppDataSource.getRepository(MirrorAction);
    return this._mirrorRepository;
  }

  constructor() {
    super(AppDataSource.getRepository(ModerationIncident), {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      cacheCheckPeriod: 60,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): BlacklistAnalyticsService {
    BlacklistAnalyticsService.instance ??= new BlacklistAnalyticsService();
    return BlacklistAnalyticsService.instance;
  }

  // ==================== COMPREHENSIVE ANALYTICS ====================

  /**
   * Get comprehensive moderation analytics for an organization
   */
  async getAnalytics(organizationId: string): Promise<ModerationAnalytics> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      // Fetch all incidents for the organization
      const incidents = await this.findAll(organizationId);

      // Calculate basic statistics
      const activeIncidents = incidents.filter(i => i.status === IncidentStatus.ACTIVE);
      const resolvedIncidents = incidents.filter(
        i => i.status === IncidentStatus.REVOKED || i.status === IncidentStatus.EXPIRED
      );
      const sharedIncidents = incidents.filter(i => i.isShared);
      const autoDetectedIncidents = incidents.filter(i => i.isAutoDetected);

      // Time-based counts
      const incidentsLast24Hours = incidents.filter(i => i.createdAt >= oneDayAgo).length;
      const incidentsLast7Days = incidents.filter(i => i.createdAt >= sevenDaysAgo).length;
      const incidentsLast30Days = incidents.filter(i => i.createdAt >= thirtyDaysAgo).length;

      // Calculate breakdowns
      const byType = this.initializeByType();
      const bySeverity = this.initializeBySeverity();
      const byStatus = this.initializeByStatus();

      const uniqueTargets = new Set<string>();
      const uniqueModerators = new Set<string>();
      let totalSeverity = 0;

      for (const incident of incidents) {
        byType[incident.incidentType]++;
        bySeverity[incident.severity]++;
        byStatus[incident.status]++;
        uniqueTargets.add(incident.targetDiscordId);
        uniqueModerators.add(incident.moderatorId);
        totalSeverity += incident.severity;
      }

      // Calculate trends
      const dailyTrend = await this.calculateDailyTrend(organizationId, sevenDaysAgo);
      const weeklyTrend = await this.calculateWeeklyTrend(organizationId, thirtyDaysAgo);
      const monthlyTrend = await this.calculateMonthlyTrend(organizationId, ninetyDaysAgo);

      // Get repeat offenders
      const repeatOffenders = await this.getRepeatOffenders(organizationId);

      // Get mirror stats
      const mirrorStats = await this.getMirrorStatistics(organizationId);

      logger.info(`Analytics generated for org: ${organizationId}`, {
        totalIncidents: incidents.length,
        activeIncidents: activeIncidents.length,
        repeatOffenderCount: repeatOffenders.length,
      });

      return {
        totalIncidents: incidents.length,
        activeIncidents: activeIncidents.length,
        resolvedIncidents: resolvedIncidents.length,
        sharedIncidents: sharedIncidents.length,
        autoDetectedIncidents: autoDetectedIncidents.length,
        byType,
        bySeverity,
        byStatus,
        dailyTrend,
        weeklyTrend,
        monthlyTrend,
        uniqueTargets: uniqueTargets.size,
        uniqueModerators: uniqueModerators.size,
        averageSeverity: incidents.length > 0 ? totalSeverity / incidents.length : 0,
        repeatOffenders,
        repeatOffenderCount: repeatOffenders.length,
        mirrorStats,
        incidentsLast24Hours,
        incidentsLast7Days,
        incidentsLast30Days,
        generatedAt: now,
      };
    } catch (error: unknown) {
      logger.warn('Failed to generate moderation analytics, returning empty analytics', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.emptyAnalytics();
    }
  }

  /**
   * Returns an empty analytics object for graceful degradation
   */
  private emptyAnalytics(): ModerationAnalytics {
    return {
      totalIncidents: 0,
      activeIncidents: 0,
      resolvedIncidents: 0,
      sharedIncidents: 0,
      autoDetectedIncidents: 0,
      byType: this.initializeByType(),
      bySeverity: this.initializeBySeverity(),
      byStatus: this.initializeByStatus(),
      dailyTrend: [],
      weeklyTrend: [],
      monthlyTrend: [],
      uniqueTargets: 0,
      uniqueModerators: 0,
      averageSeverity: 0,
      repeatOffenders: [],
      repeatOffenderCount: 0,
      mirrorStats: {
        totalMirrors: 0,
        confirmedMirrors: 0,
        pendingMirrors: 0,
        cancelledMirrors: 0,
        failedMirrors: 0,
      },
      incidentsLast24Hours: 0,
      incidentsLast7Days: 0,
      incidentsLast30Days: 0,
      generatedAt: new Date(),
    };
  }

  // ==================== REPEAT OFFENDER DETECTION ====================

  /**
   * Get list of repeat offenders for an organization
   */
  /** Analyze a set of incidents for a single target to produce RepeatOffender data */
  private analyzeTargetIncidents(
    targetDiscordId: string,
    targetIncidents: ModerationIncident[]
  ): RepeatOffender {
    const byType = this.initializeByType();
    let highestSeverity = IncidentSeverity.WARNING;
    let activeCount = 0;

    for (const incident of targetIncidents) {
      byType[incident.incidentType]++;
      if (incident.severity > highestSeverity) {
        highestSeverity = incident.severity;
      }
      if (incident.status === IncidentStatus.ACTIVE) {
        activeCount++;
      }
    }

    const riskScore = this.calculateRiskScore(targetIncidents, highestSeverity);

    return {
      targetDiscordId,
      targetUsername: targetIncidents[0].targetUsername,
      totalIncidents: targetIncidents.length,
      activeIncidents: activeCount,
      highestSeverity,
      firstIncident: targetIncidents.at(-1)?.createdAt ?? targetIncidents[0].createdAt,
      lastIncident: targetIncidents[0].createdAt,
      incidentsByType: byType,
      riskScore,
      isHighRisk: riskScore >= REPEAT_OFFENDER_THRESHOLDS.highRiskThreshold,
    };
  }

  /**
   * Get list of repeat offenders for an organization
   */
  async getRepeatOffenders(organizationId: string): Promise<RepeatOffender[]> {
    try {
      const windowStart = new Date(
        Date.now() - REPEAT_OFFENDER_THRESHOLDS.windowDays * 24 * 60 * 60 * 1000
      );

      const incidents = await this.repository.find({
        where: {
          organizationId,
          createdAt: MoreThan(windowStart),
          severity: MoreThan(REPEAT_OFFENDER_THRESHOLDS.minSeverity - 1),
        },
        order: { createdAt: 'DESC' },
      });

      // Group by target Discord ID
      const incidentsByTarget = new Map<string, ModerationIncident[]>();
      for (const incident of incidents) {
        const existing = incidentsByTarget.get(incident.targetDiscordId) ?? [];
        existing.push(incident);
        incidentsByTarget.set(incident.targetDiscordId, existing);
      }

      // Build repeat offender list from targets meeting threshold
      const repeatOffenders: RepeatOffender[] = [];
      for (const [targetDiscordId, targetIncidents] of incidentsByTarget) {
        if (targetIncidents.length >= REPEAT_OFFENDER_THRESHOLDS.minIncidents) {
          repeatOffenders.push(this.analyzeTargetIncidents(targetDiscordId, targetIncidents));
        }
      }

      repeatOffenders.sort((a, b) => b.riskScore - a.riskScore);
      return repeatOffenders;
    } catch (error: unknown) {
      logger.warn('Failed to load repeat offenders, returning empty list', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Check if a specific user is a repeat offender
   */
  async isRepeatOffender(
    organizationId: string,
    targetDiscordId: string
  ): Promise<{ isRepeatOffender: boolean; details?: RepeatOffender }> {
    const repeatOffenders = await this.getRepeatOffenders(organizationId);
    const found = repeatOffenders.find(ro => ro.targetDiscordId === targetDiscordId);

    return {
      isRepeatOffender: !!found,
      details: found,
    };
  }

  /**
   * Calculate risk score for a user based on their incidents
   */
  private calculateRiskScore(
    incidents: ModerationIncident[],
    highestSeverity: IncidentSeverity
  ): number {
    let score = 0;

    // Base score from incident count (max 30 points)
    const countScore = Math.min(incidents.length * 5, 30);
    score += countScore;

    // Severity multiplier (max 30 points)
    score += highestSeverity * 6;

    // Recency factor - more recent incidents add more points (max 20 points)
    const now = new Date();
    const recentIncidents = incidents.filter(i => {
      const daysSince = (now.getTime() - i.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    });
    score += Math.min(recentIncidents.length * 5, 20);

    // Active incidents factor (max 20 points)
    const activeIncidents = incidents.filter(i => i.status === IncidentStatus.ACTIVE);
    score += Math.min(activeIncidents.length * 5, 20);

    return Math.min(score, 100);
  }

  // ==================== TREND CALCULATIONS ====================

  /**
   * Calculate daily trend for the past N days
   */
  private async calculateDailyTrend(
    organizationId: string,
    startDate: Date
  ): Promise<TrendDataPoint[]> {
    const incidents = await this.repository.find({
      where: {
        organizationId,
        createdAt: MoreThan(startDate),
      },
      order: { createdAt: 'ASC' },
    });

    const trendMap = new Map<string, number>();
    const now = new Date();

    // Initialize all days with 0
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      trendMap.set(dateStr, 0);
    }

    // Count incidents per day
    for (const incident of incidents) {
      const dateStr = incident.createdAt.toISOString().split('T')[0];
      trendMap.set(dateStr, (trendMap.get(dateStr) ?? 0) + 1);
    }

    // Convert to array
    return Array.from(trendMap.entries()).map(([date, count]) => ({
      date,
      count,
      label: new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    }));
  }

  /**
   * Calculate weekly trend for the past N weeks
   */
  private async calculateWeeklyTrend(
    organizationId: string,
    startDate: Date
  ): Promise<TrendDataPoint[]> {
    const incidents = await this.repository.find({
      where: {
        organizationId,
        createdAt: MoreThan(startDate),
      },
      order: { createdAt: 'ASC' },
    });

    const trendMap = new Map<string, number>();

    // Group by week
    for (const incident of incidents) {
      const weekStart = this.getWeekStart(incident.createdAt);
      const weekStr = weekStart.toISOString().split('T')[0];
      trendMap.set(weekStr, (trendMap.get(weekStr) ?? 0) + 1);
    }

    // Convert to array and sort
    return Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date,
        count,
        label: `Week of ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      }));
  }

  /**
   * Calculate monthly trend for the past N months
   */
  private async calculateMonthlyTrend(
    organizationId: string,
    startDate: Date
  ): Promise<TrendDataPoint[]> {
    const incidents = await this.repository.find({
      where: {
        organizationId,
        createdAt: MoreThan(startDate),
      },
      order: { createdAt: 'ASC' },
    });

    const trendMap = new Map<string, number>();

    // Group by month
    for (const incident of incidents) {
      const monthStr = `${incident.createdAt.getFullYear()}-${String(incident.createdAt.getMonth() + 1).padStart(2, '0')}`;
      trendMap.set(monthStr, (trendMap.get(monthStr) ?? 0) + 1);
    }

    // Convert to array and sort
    return Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => {
        const [year, month] = date.split('-');
        return {
          date,
          count,
          label: new Date(Number.parseInt(year), Number.parseInt(month) - 1).toLocaleDateString(
            'en-US',
            {
              month: 'long',
              year: 'numeric',
            }
          ),
        };
      });
  }

  /**
   * Get start of week (Monday) for a given date
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ==================== MIRROR STATISTICS ====================

  /**
   * Get mirror action statistics for organization
   */
  private async getMirrorStatistics(organizationId: string): Promise<{
    totalMirrors: number;
    confirmedMirrors: number;
    pendingMirrors: number;
    cancelledMirrors: number;
    failedMirrors: number;
  }> {
    const mirrors = await this.mirrorRepository.find({
      where: { organizationId },
    });

    return {
      totalMirrors: mirrors.length,
      confirmedMirrors: mirrors.filter(m => m.status === MirrorActionStatus.CONFIRMED).length,
      pendingMirrors: mirrors.filter(m => m.status === MirrorActionStatus.PENDING).length,
      cancelledMirrors: mirrors.filter(m => m.status === MirrorActionStatus.CANCELLED).length,
      failedMirrors: mirrors.filter(m => m.status === MirrorActionStatus.FAILED).length,
    };
  }

  // ==================== HELPER METHODS ====================

  private initializeByType(): Record<IncidentType, number> {
    return {
      [IncidentType.WARNING]: 0,
      [IncidentType.TIMEOUT]: 0,
      [IncidentType.LONG_TIMEOUT]: 0,
      [IncidentType.KICK]: 0,
      [IncidentType.BAN]: 0,
    };
  }

  private initializeBySeverity(): Record<IncidentSeverity, number> {
    return {
      [IncidentSeverity.WARNING]: 0,
      [IncidentSeverity.TIMEOUT]: 0,
      [IncidentSeverity.LONG_TIMEOUT]: 0,
      [IncidentSeverity.KICK]: 0,
      [IncidentSeverity.BAN]: 0,
    };
  }

  private initializeByStatus(): Record<IncidentStatus, number> {
    return {
      [IncidentStatus.ACTIVE]: 0,
      [IncidentStatus.EXPIRED]: 0,
      [IncidentStatus.REVOKED]: 0,
    };
  }
}

