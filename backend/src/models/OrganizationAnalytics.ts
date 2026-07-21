import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Analytics period for aggregation
 */
export enum AnalyticsPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  ALL_TIME = 'ALL_TIME',
}

/**
 * Analytics metric types
 */
export enum MetricType {
  MEMBER_COUNT = 'MEMBER_COUNT',
  ACTIVITY_COUNT = 'ACTIVITY_COUNT',
  ENGAGEMENT_SCORE = 'ENGAGEMENT_SCORE',
  GROWTH_RATE = 'GROWTH_RATE',
  RETENTION_RATE = 'RETENTION_RATE',
  HIERARCHY_DEPTH = 'HIERARCHY_DEPTH',
  PERMISSION_USAGE = 'PERMISSION_USAGE',
  RESOURCE_USAGE = 'RESOURCE_USAGE',
}

/**
 * Member statistics
 */
export interface MemberStats {
  totalMembers: number;
  directMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newMembersThisPeriod: number;
  removedMembersThisPeriod: number;
  membersByRole: Record<string, number>;
  averageTenure: number; // Days
  memberGrowthRate: number; // Percentage
}

/**
 * Activity metrics
 */
export interface ActivityMetrics {
  totalActivities: number;
  activitiesByType: Record<string, number>;
  activitiesBySeverity: Record<string, number>;
  activityTrend: Array<{ date: string; count: number }>;
  mostActiveUsers: Array<{ userId: string; activityCount: number }>;
  peakActivityTimes: Array<{ hour: number; count: number }>;
  averageActivitiesPerDay: number;
}

/**
 * Engagement metrics
 */
export interface EngagementMetrics {
  engagementScore: number; // 0-100
  activeUsersPercentage: number;
  averageActivitiesPerUser: number;
  lastActivityDate: Date | null;
  dormantMembers: number;
  highlyEngagedMembers: number;
  engagementTrend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

/**
 * Growth metrics
 */
export interface GrowthMetrics {
  memberGrowth: Array<{ date: string; count: number }>;
  growthRate: number; // Percentage
  projectedGrowth: number;
  churnRate: number; // Percentage
  retentionRate: number; // Percentage
  netGrowth: number;
  subOrgGrowth: number;
}

/**
 * Hierarchy health metrics
 */
export interface HierarchyHealth {
  depth: number;
  balance: number; // 0-100, higher is more balanced
  averageChildrenPerNode: number;
  leafNodeCount: number;
  middleNodeCount: number;
  totalSubOrgs: number;
  deepestPath: string[];
  widestLevel: number;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  storageUsed: number; // Bytes
  apiCallsThisPeriod: number;
  permissionChecks: number;
  averageResponseTime: number; // Milliseconds
  errorRate: number; // Percentage
  resourcesByType: Record<string, number>;
}

/**
 * OrganizationAnalytics entity
 * Stores analytics snapshots for organizations
 */
@Entity('organization_analytics')
export class OrganizationAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Organization reference
  @Column({ type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  // Analytics period
  @Column({
    type: 'enum',
    enum: AnalyticsPeriod,
    default: AnalyticsPeriod.DAILY,
  })
  period: AnalyticsPeriod;

  @Column({ type: 'timestamp' })
  periodStart: Date;

  @Column({ type: 'timestamp' })
  periodEnd: Date;

  // Member statistics
  @Column({ type: 'jsonb' })
  memberStats: MemberStats;

  // Activity metrics
  @Column({ type: 'jsonb' })
  activityMetrics: ActivityMetrics;

  // Engagement metrics
  @Column({ type: 'jsonb' })
  engagementMetrics: EngagementMetrics;

  // Growth metrics
  @Column({ type: 'jsonb' })
  growthMetrics: GrowthMetrics;

  // Hierarchy health
  @Column({ type: 'jsonb' })
  hierarchyHealth: HierarchyHealth;

  // Resource usage
  @Column({ type: 'jsonb' })
  resourceUsage: ResourceUsage;

  // Overall health score (0-100)
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  overallHealthScore: number;

  // Comparison with previous period
  @Column({ type: 'jsonb', nullable: true })
  comparison: {
    memberChange: number;
    activityChange: number;
    engagementChange: number;
    growthChange: number;
  } | null;

  // Alerts and recommendations
  @Column({ type: 'jsonb', nullable: true })
  alerts: Array<{
    type: 'WARNING' | 'INFO' | 'CRITICAL';
    message: string;
    metric: string;
    value: number;
    threshold: number;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  recommendations: Array<{
    category: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    message: string;
    action: string;
  }> | null;

  // Metadata
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed at query time flag
  @Column({ type: 'boolean', default: false })
  isSnapshot: boolean; // True if stored snapshot, false if computed on-demand

  /**
   * Calculate overall health score based on metrics
   */
  calculateHealthScore(): number {
    let score = 0;
    let weights = 0;

    // Member growth (25%)
    if (this.memberStats.memberGrowthRate >= 0) {
      score += Math.min(this.memberStats.memberGrowthRate * 2.5, 25);
    }
    weights += 25;

    // Engagement score (30%)
    score += this.engagementMetrics.engagementScore * 0.3;
    weights += 30;

    // Activity level (20%)
    const activityScore = Math.min((this.activityMetrics.averageActivitiesPerDay / 10) * 20, 20);
    score += activityScore;
    weights += 20;

    // Retention rate (15%)
    score += this.growthMetrics.retentionRate * 0.15;
    weights += 15;

    // Hierarchy balance (10%)
    score += this.hierarchyHealth.balance * 0.1;
    weights += 10;

    this.overallHealthScore = Math.round((score / weights) * 100);
    return this.overallHealthScore;
  }

  /**
   * Generate alerts based on thresholds
   */
  generateAlerts(): void {
    this.alerts = [];

    // Low engagement alert
    if (this.engagementMetrics.engagementScore < 30) {
      this.alerts.push({
        type: 'CRITICAL',
        message: 'Very low member engagement detected',
        metric: 'engagementScore',
        value: this.engagementMetrics.engagementScore,
        threshold: 30,
      });
    }

    // High churn rate alert
    if (this.growthMetrics.churnRate > 20) {
      this.alerts.push({
        type: 'WARNING',
        message: 'High member churn rate',
        metric: 'churnRate',
        value: this.growthMetrics.churnRate,
        threshold: 20,
      });
    }

    // Negative growth alert
    if (this.memberStats.memberGrowthRate < -5) {
      this.alerts.push({
        type: 'WARNING',
        message: 'Declining membership',
        metric: 'memberGrowthRate',
        value: this.memberStats.memberGrowthRate,
        threshold: -5,
      });
    }

    // Imbalanced hierarchy alert
    if (this.hierarchyHealth.balance < 40) {
      this.alerts.push({
        type: 'INFO',
        message: 'Unbalanced organization hierarchy',
        metric: 'hierarchyBalance',
        value: this.hierarchyHealth.balance,
        threshold: 40,
      });
    }

    // High error rate alert
    if (this.resourceUsage.errorRate > 5) {
      this.alerts.push({
        type: 'CRITICAL',
        message: 'High API error rate',
        metric: 'errorRate',
        value: this.resourceUsage.errorRate,
        threshold: 5,
      });
    }
  }

  /**
   * Generate recommendations based on analytics
   */
  generateRecommendations(): void {
    this.recommendations = [];

    // Engagement recommendations
    if (this.engagementMetrics.engagementScore < 50) {
      this.recommendations.push({
        category: 'Engagement',
        priority: 'HIGH',
        message: 'Increase member engagement through regular events and activities',
        action: 'Schedule weekly events and send activity reminders',
      });
    }

    // Growth recommendations
    if (this.memberStats.memberGrowthRate < 5) {
      this.recommendations.push({
        category: 'Growth',
        priority: 'MEDIUM',
        message: 'Boost recruitment efforts',
        action: 'Launch targeted recruitment campaign',
      });
    }

    // Retention recommendations
    if (this.growthMetrics.retentionRate < 70) {
      this.recommendations.push({
        category: 'Retention',
        priority: 'HIGH',
        message: 'Improve member retention with onboarding programs',
        action: 'Implement mentorship and onboarding system',
      });
    }

    // Hierarchy recommendations
    if (this.hierarchyHealth.depth > 7) {
      this.recommendations.push({
        category: 'Structure',
        priority: 'LOW',
        message: 'Consider flattening deep organizational hierarchy',
        action: 'Review and restructure deep organizational branches',
      });
    }

    // Dormant members
    if (this.engagementMetrics.dormantMembers > this.memberStats.totalMembers * 0.3) {
      this.recommendations.push({
        category: 'Engagement',
        priority: 'MEDIUM',
        message: 'Re-engage dormant members',
        action: 'Send re-engagement campaign to inactive members',
      });
    }
  }

  /**
   * Compare with previous period
   */
  compareWithPrevious(previous: OrganizationAnalytics | null): void {
    if (!previous) {
      this.comparison = null;
      return;
    }

    this.comparison = {
      memberChange: this.calculatePercentageChange(
        previous.memberStats.totalMembers,
        this.memberStats.totalMembers
      ),
      activityChange: this.calculatePercentageChange(
        previous.activityMetrics.totalActivities,
        this.activityMetrics.totalActivities
      ),
      engagementChange: this.calculatePercentageChange(
        previous.engagementMetrics.engagementScore,
        this.engagementMetrics.engagementScore
      ),
      growthChange: this.calculatePercentageChange(
        previous.growthMetrics.growthRate,
        this.growthMetrics.growthRate
      ),
    };
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Get summary for dashboard
   */
  getDashboardSummary() {
    return {
      organizationId: this.organizationId,
      period: this.period,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      healthScore: this.overallHealthScore,
      totalMembers: this.memberStats.totalMembers,
      activeMembers: this.memberStats.activeMembers,
      memberGrowth: this.memberStats.memberGrowthRate,
      totalActivities: this.activityMetrics.totalActivities,
      engagementScore: this.engagementMetrics.engagementScore,
      growthRate: this.growthMetrics.growthRate,
      retentionRate: this.growthMetrics.retentionRate,
      alertCount: this.alerts?.length || 0,
      criticalAlerts: this.alerts?.filter(a => a.type === 'CRITICAL').length || 0,
      comparison: this.comparison,
      topRecommendations: this.recommendations?.slice(0, 3) || [],
    };
  }
}
