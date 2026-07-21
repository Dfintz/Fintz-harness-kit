/**
 * Feature Flag Service
 * Manages feature toggles for gradual rollout and A/B testing
 * Admin-controlled flags with tenant-level and user-level granularity
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { FeatureFlag, FeatureFlagScope, FeatureFlagStatus } from '../../models/FeatureFlag';
import { FeatureFlagAction, FeatureFlagAuditLog } from '../../models/FeatureFlagAuditLog';
import { logger } from '../../utils/logger';
import { findInBatches } from '../../utils/query';
import { notifyFeatureFlagChange } from '../../websocket/controllers/featureFlagWebSocketController';

// Re-export enums for backwards compatibility
export { FeatureFlagScope, FeatureFlagStatus };

export class FeatureFlagService {
  private static flagRepository: Repository<FeatureFlag>;
  private static auditRepository: Repository<FeatureFlagAuditLog>;

  /**
   * Initialize repositories
   */
  private static getRepositories() {
    if (!this.flagRepository) {
      this.flagRepository = AppDataSource.getRepository(FeatureFlag);
      this.auditRepository = AppDataSource.getRepository(FeatureFlagAuditLog);
    }
    return { flagRepository: this.flagRepository, auditRepository: this.auditRepository };
  }

  /**
   * Initialize default feature flags
   */
  static async initializeDefaultFlags(): Promise<void> {
    const { flagRepository } = this.getRepositories();

    const defaultFlags: Partial<FeatureFlag>[] = [
      {
        id: 'advanced-analytics',
        name: 'Advanced Analytics',
        description: 'Access to advanced analytics dashboard',
        status: FeatureFlagStatus.BETA,
        scope: FeatureFlagScope.BETA_USERS,
        createdBy: undefined, // System-created flag
      },
      {
        id: 'dataloader-optimization',
        name: 'DataLoader Query Optimization',
        description: 'Use DataLoader pattern for N+1 query elimination',
        status: FeatureFlagStatus.PERCENTAGE,
        scope: FeatureFlagScope.GLOBAL,
        percentage: 25,
        createdBy: undefined, // System-created flag
      },
      {
        id: 'enhanced-caching',
        name: 'Enhanced Service Caching',
        description: 'Extended cache TTL and advanced invalidation',
        status: FeatureFlagStatus.ENABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: undefined, // System-created flag
      },
      {
        id: 'ai-mission-planning',
        name: 'AI Mission Planning',
        description: 'AI-powered mission planning and optimization',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: undefined, // System-created flag
      },
      {
        id: 'real-time-collaboration',
        name: 'Real-time Collaboration',
        description: 'WebSocket-based real-time updates',
        status: FeatureFlagStatus.DISABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: undefined, // System-created flag
      },
      {
        id: 'titles-badges',
        name: 'Custom Titles & Badges',
        description:
          'Per-organization custom titles and badges system (controlled via org settings)',
        status: FeatureFlagStatus.ENABLED,
        scope: FeatureFlagScope.GLOBAL,
        createdBy: undefined, // System-created flag
      },
    ];

    for (const flagData of defaultFlags) {
      const existing = await flagRepository.findOne({ where: { id: flagData.id } });
      if (!existing) {
        await flagRepository.save(flagData);
        logger.info('Initialized default feature flag', { flagId: flagData.id });
      }
    }
  }

  /**
   * Log flag evaluation for analytics
   */
  private static async logEvaluation(
    featureFlagId: string,
    result: boolean,
    userId?: string,
    organizationId?: string
  ): Promise<void> {
    try {
      const { auditRepository } = this.getRepositories();
      await auditRepository.save({
        featureFlagId,
        action: FeatureFlagAction.EVALUATED,
        userId,
        organizationId,
        evaluationResult: result,
        metadata: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    } catch (error: unknown) {
      // Don't throw on audit log failure - it shouldn't block flag evaluation
      // Audit logging is important but not critical for the evaluation flow
      logger.error('Failed to log feature flag evaluation', { error, featureFlagId });
    }
  }

  /**
   * Check if a feature is enabled for a specific user/organization
   */
  static async isEnabled(
    featureId: string,
    userId?: string,
    organizationId?: string
  ): Promise<boolean> {
    const { flagRepository } = this.getRepositories();
    const flag = await flagRepository.findOne({ where: { id: featureId } });

    if (!flag) {
      logger.warn('Feature flag not found', { featureId });
      return false;
    }

    let result = false;

    // Check status
    switch (flag.status) {
      case FeatureFlagStatus.DISABLED:
        result = false;
        break;

      case FeatureFlagStatus.ENABLED:
        result = true;
        break;

      case FeatureFlagStatus.BETA:
        result = this.checkBetaAccess(flag, userId, organizationId);
        break;

      case FeatureFlagStatus.PERCENTAGE:
        result = this.checkPercentageRollout(flag, userId, organizationId);
        break;

      default:
        result = false;
    }

    // Log evaluation for analytics (async, non-blocking)
    this.logEvaluation(featureId, result, userId, organizationId).catch(() => {});

    return result;
  }

  /**
   * Check beta access
   */
  private static checkBetaAccess(
    flag: FeatureFlag,
    userId?: string,
    organizationId?: string
  ): boolean {
    if (flag.scope === FeatureFlagScope.ORGANIZATION && organizationId) {
      return flag.targetOrganizations?.includes(organizationId) || false;
    }

    if (flag.scope === FeatureFlagScope.USER && userId) {
      return flag.targetUsers?.includes(userId) || false;
    }

    // Check if user/org is in beta program (would query database in production)
    return false;
  }

  /**
   * Check percentage-based rollout
   */
  private static checkPercentageRollout(
    flag: FeatureFlag,
    userId?: string,
    organizationId?: string
  ): boolean {
    if (!flag.percentage) {
      return false;
    }

    // Deterministic hash-based rollout
    const identifier = userId || organizationId || 'anonymous';
    const hash = this.hashString(identifier + flag.id);
    const bucket = hash % 100;

    return bucket < flag.percentage;
  }

  /**
   * Simple hash function for deterministic rollout
   */
  private static hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get all feature flags (admin only)
   */
  static async getAllFlags(): Promise<FeatureFlag[]> {
    const { flagRepository } = this.getRepositories();
    return flagRepository.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Get specific feature flag (admin only)
   */
  static async getFlag(featureId: string): Promise<FeatureFlag | null> {
    const { flagRepository } = this.getRepositories();
    return flagRepository.findOne({ where: { id: featureId } });
  }

  /**
   * Create new feature flag (admin only)
   */
  static async createFlag(
    flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>,
    adminUserId: string
  ): Promise<FeatureFlag> {
    const { flagRepository, auditRepository } = this.getRepositories();

    const newFlag = flagRepository.create({
      ...flag,
      createdBy: adminUserId,
    });

    const savedFlag = await flagRepository.save(newFlag);

    // Audit log
    const auditEntry = auditRepository.create({
      featureFlagId: savedFlag.id,
      action: FeatureFlagAction.CREATED,
      userId: adminUserId,
      newValue: savedFlag as unknown as Record<string, unknown>,
    });
    await auditRepository.save(auditEntry);

    logger.info('Feature flag created', {
      flagId: savedFlag.id,
      adminUserId,
    });

    // Notify clients via WebSocket (non-blocking)
    // WebSocket notification failures should not affect the main operation
    notifyFeatureFlagChange(
      savedFlag.id,
      'created',
      savedFlag.scope,
      savedFlag.status,
      savedFlag.percentage,
      savedFlag.targetOrganizations,
      savedFlag.targetUsers
    ).catch(err => {
      logger.error('Failed to notify feature flag creation via WebSocket', {
        error: err,
        flagId: savedFlag.id,
      });
    });

    return savedFlag;
  }

  /**
   * Update feature flag (admin only)
   */
  static async updateFlag(
    featureId: string,
    updates: Partial<FeatureFlag>,
    adminUserId: string
  ): Promise<FeatureFlag | null> {
    const { flagRepository, auditRepository } = this.getRepositories();
    const existing = await flagRepository.findOne({ where: { id: featureId } });

    if (!existing) {
      return null;
    }

    // Store previous value for audit
    const previousValue = { ...existing };

    // Apply updates
    Object.assign(existing, updates);
    existing.id = featureId; // Prevent ID change

    const updated = await flagRepository.save(existing);

    // Audit log
    const auditEntry = auditRepository.create({
      featureFlagId: featureId,
      action: FeatureFlagAction.UPDATED,
      userId: adminUserId,
      previousValue: previousValue as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
    });
    await auditRepository.save(auditEntry);

    logger.info('Feature flag updated', {
      flagId: featureId,
      adminUserId,
      changes: updates,
    });

    // Notify clients via WebSocket (non-blocking)
    // WebSocket notification failures should not affect the main operation
    notifyFeatureFlagChange(
      featureId,
      'updated',
      updated.scope,
      updated.status,
      updated.percentage,
      updated.targetOrganizations,
      updated.targetUsers
    ).catch(err => {
      logger.error('Failed to notify feature flag update via WebSocket', {
        error: err,
        flagId: featureId,
      });
    });

    return updated;
  }

  /**
   * Delete feature flag (admin only)
   */
  static async deleteFlag(featureId: string, adminUserId: string): Promise<boolean> {
    const { flagRepository, auditRepository } = this.getRepositories();
    const existing = await flagRepository.findOne({ where: { id: featureId } });

    if (!existing) {
      return false;
    }

    // Audit log before deletion
    const auditEntry = auditRepository.create({
      featureFlagId: featureId,
      action: FeatureFlagAction.DELETED,
      userId: adminUserId,
      previousValue: existing as unknown as Record<string, unknown>,
    });
    await auditRepository.save(auditEntry);

    await flagRepository.delete(featureId);

    logger.info('Feature flag deleted', {
      flagId: featureId,
      adminUserId,
    });

    // Notify clients via WebSocket (non-blocking)
    // WebSocket notification failures should not affect the main operation
    notifyFeatureFlagChange(featureId, 'deleted', existing.scope).catch(err => {
      logger.error('Failed to notify feature flag deletion via WebSocket', {
        error: err,
        flagId: featureId,
      });
    });

    return true;
  }

  /**
   * Get feature flags for a specific user/organization
   */
  static async getEnabledFeatures(userId?: string, organizationId?: string): Promise<string[]> {
    const { flagRepository } = this.getRepositories();
    const enabledFeatures: string[] = [];

    // PERF-03: iterate flags in bounded keyset batches instead of loading the
    // entire feature_flags table into memory at once.
    await findInBatches(flagRepository, {}, async batch => {
      for (const flag of batch) {
        if (await this.isEnabled(flag.id, userId, organizationId)) {
          enabledFeatures.push(flag.id);
        }
      }
    });

    return enabledFeatures;
  }

  /**
   * Get feature flag statistics (admin only)
   */
  static async getStatistics(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    beta: number;
    percentageRollout: number;
  }> {
    const { flagRepository } = this.getRepositories();

    // PERF-03: accumulate counts over bounded keyset batches instead of loading
    // the entire feature_flags table into memory at once.
    const stats = {
      total: 0,
      enabled: 0,
      disabled: 0,
      beta: 0,
      percentageRollout: 0,
    };

    await findInBatches(flagRepository, {}, batch => {
      for (const flag of batch) {
        stats.total += 1;
        if (flag.status === FeatureFlagStatus.ENABLED) {
          stats.enabled += 1;
        }
        if (flag.status === FeatureFlagStatus.DISABLED) {
          stats.disabled += 1;
        }
        if (flag.status === FeatureFlagStatus.BETA) {
          stats.beta += 1;
        }
        if (flag.status === FeatureFlagStatus.PERCENTAGE) {
          stats.percentageRollout += 1;
        }
      }
    });

    return stats;
  }

  /**
   * Get analytics for a specific feature flag
   */
  static async getAnalytics(
    featureFlagId: string,
    days: number = 30
  ): Promise<{
    totalEvaluations: number;
    enabledCount: number;
    disabledCount: number;
    uniqueUsers: number;
    uniqueOrganizations: number;
    evaluationsByDay: Array<{ date: string; enabled: number; disabled: number }>;
  }> {
    const { auditRepository } = this.getRepositories();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await auditRepository
      .createQueryBuilder('log')
      .where('log.featureFlagId = :featureFlagId', { featureFlagId })
      .andWhere('log.action = :action', { action: FeatureFlagAction.EVALUATED })
      .andWhere('log.createdAt >= :startDate', { startDate })
      .getMany();

    const enabledCount = logs.filter(l => l.evaluationResult === true).length;
    const disabledCount = logs.filter(l => l.evaluationResult === false).length;
    const uniqueUsers = new Set(logs.map(l => l.userId).filter(Boolean)).size;
    const uniqueOrganizations = new Set(logs.map(l => l.organizationId).filter(Boolean)).size;

    // Group by day
    const evaluationsByDay = new Map<string, { enabled: number; disabled: number }>();
    logs.forEach(log => {
      const dateKey = log.createdAt.toISOString().split('T')[0];
      const existing = evaluationsByDay.get(dateKey) || { enabled: 0, disabled: 0 };
      if (log.evaluationResult) {
        existing.enabled++;
      } else {
        existing.disabled++;
      }
      evaluationsByDay.set(dateKey, existing);
    });

    return {
      totalEvaluations: logs.length,
      enabledCount,
      disabledCount,
      uniqueUsers,
      uniqueOrganizations,
      evaluationsByDay: Array.from(evaluationsByDay.entries()).map(([date, counts]) => ({
        date,
        ...counts,
      })),
    };
  }
}

