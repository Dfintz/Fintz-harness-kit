import { IsNull, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelCategory, IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

import { IntelEncryptionService, IntelMetadata } from './IntelEncryptionService';

export interface ScheduleDeclassificationInput {
  intelEntryId: string;
  organizationId: string;
  declassificationDate: Date;
  targetClassification: IntelClassification;
  autoDeclassify: boolean;
  reason?: string;
}

export interface ScheduleReviewInput {
  intelEntryId: string;
  organizationId: string;
  reviewDate: Date;
  reviewIntervalDays?: number;
}

export interface AgingReviewResult {
  entryId: string;
  title: string;
  currentClassification: IntelClassification;
  reviewDate: Date;
  daysPastDue: number;
  lastReviewedAt?: Date;
  recommendation: 'maintain' | 'declassify' | 'archive' | 'delete';
}

export interface DeclassificationResult {
  entryId: string;
  title: string;
  previousClassification: IntelClassification;
  newClassification: IntelClassification;
  declassifiedAt: Date;
  success: boolean;
  error?: string;
}

/**
 * Service for managing Intel aging and declassification
 */
export class IntelAgingService {
  private readonly intelEntryRepo: Repository<IntelEntry>;
  private readonly intelOfficerRepo: Repository<IntelOfficer>;
  private readonly auditLogRepo: Repository<IntelAuditLog>;
  private readonly userOrgRepo: Repository<OrganizationMembership>;

  // Classification order for comparison
  private readonly classificationOrder: Record<IntelClassification, number> = {
    [IntelClassification.PUBLIC]: 0,
    [IntelClassification.RESTRICTED]: 1,
    [IntelClassification.CONFIDENTIAL]: 2,
    [IntelClassification.SECRET]: 3,
    [IntelClassification.TOP_SECRET]: 4,
  };

  // Default review intervals by classification (in days)
  private readonly defaultReviewIntervals: Record<IntelClassification, number> = {
    [IntelClassification.PUBLIC]: 365, // 1 year
    [IntelClassification.RESTRICTED]: 180, // 6 months
    [IntelClassification.CONFIDENTIAL]: 90, // 3 months
    [IntelClassification.SECRET]: 60, // 2 months
    [IntelClassification.TOP_SECRET]: 30, // 1 month
  };

  // Aging thresholds (in days) for review recommendations
  private static readonly TACTICAL_STALENESS_DAYS = 30;
  private static readonly HIGH_CLASSIFICATION_DECLASSIFY_DAYS = 365;
  private static readonly OLD_INTEL_ARCHIVE_DAYS = 730;

  constructor() {
    this.intelEntryRepo = AppDataSource.getRepository(IntelEntry);
    this.intelOfficerRepo = AppDataSource.getRepository(IntelOfficer);
    this.auditLogRepo = AppDataSource.getRepository(IntelAuditLog);
    this.userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
  }

  /**
   * Check if user can manage intel aging (must be owner or senior Intel officer)
   */
  async canManageAging(userId: string, organizationId: string): Promise<boolean> {
    try {
      const userOrg = await this.userOrgRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder') {
        return true;
      }

      const officer = await this.intelOfficerRepo.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!officer) {
        return false;
      }

      return [IntelOfficerRank.CHIEF, IntelOfficerRank.LEAD, IntelOfficerRank.SENIOR].includes(
        officer.rank
      );
    } catch (error: unknown) {
      logger.error('Error checking aging management permission:', error);
      return false;
    }
  }

  /**
   * Schedule declassification for an intel entry
   */
  async scheduleDeclassification(
    input: ScheduleDeclassificationInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      // Check permission
      const canManage = await this.canManageAging(userId, input.organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to schedule declassification');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: input.intelEntryId, organizationId: input.organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      // Validate target classification is lower than current
      if (
        this.classificationOrder[input.targetClassification] >=
        this.classificationOrder[entry.classification]
      ) {
        throw new Error('Target classification must be lower than current classification');
      }

      // Validate date is in the future
      if (input.declassificationDate <= new Date()) {
        throw new Error('Declassification date must be in the future');
      }

      // Update entry
      entry.declassificationDate = input.declassificationDate;
      entry.targetClassification = input.targetClassification;
      entry.autoDeclassify = input.autoDeclassify;

      // Add to aging history
      const agingHistory = entry.metadata?.agingHistory || [];
      agingHistory.push({
        date: new Date(),
        action: 'declassification_scheduled',
        fromClassification: entry.classification,
        toClassification: input.targetClassification,
        performedBy: userId,
        reason: input.reason,
      });

      entry.metadata = {
        ...entry.metadata,
        agingHistory,
      };

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId: input.organizationId,
        userId,
        intelEntryId: input.intelEntryId,
        action: IntelAuditAction.DECLASSIFICATION_SCHEDULED,
        description: `Scheduled declassification to ${input.targetClassification} on ${input.declassificationDate.toISOString()}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          currentClassification: entry.classification,
          targetClassification: input.targetClassification,
          declassificationDate: input.declassificationDate,
          autoDeclassify: input.autoDeclassify,
          reason: input.reason,
        },
      });

      logger.info('Declassification scheduled', {
        entryId: input.intelEntryId,
        currentClassification: entry.classification,
        targetClassification: input.targetClassification,
        declassificationDate: input.declassificationDate,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error scheduling declassification:', error);
      throw error;
    }
  }

  /**
   * Cancel scheduled declassification
   */
  async cancelDeclassification(
    intelEntryId: string,
    organizationId: string,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to cancel declassification');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId, organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      if (!entry.declassificationDate) {
        throw new Error('No declassification scheduled for this entry');
      }

      const previousDate = entry.declassificationDate;
      const previousTarget = entry.targetClassification;

      // Clear declassification fields
      entry.declassificationDate = undefined;
      entry.targetClassification = undefined;
      entry.autoDeclassify = false;

      // Add to aging history
      const agingHistory = entry.metadata?.agingHistory || [];
      agingHistory.push({
        date: new Date(),
        action: 'declassification_cancelled',
        toClassification: previousTarget,
        performedBy: userId,
        reason,
      });

      entry.metadata = {
        ...entry.metadata,
        agingHistory,
      };

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId,
        action: IntelAuditAction.DECLASSIFICATION_CANCELLED,
        description: `Cancelled scheduled declassification to ${previousTarget}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          previousDate,
          previousTarget,
          reason,
        },
      });

      logger.info('Declassification cancelled', {
        entryId: intelEntryId,
        previousDate,
        previousTarget,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error cancelling declassification:', error);
      throw error;
    }
  }

  /**
   * Execute immediate declassification
   */
  async executeDeclassification(
    intelEntryId: string,
    organizationId: string,
    targetClassification: IntelClassification,
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to declassify intel');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId, organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      // Validate target classification is lower than current
      if (
        this.classificationOrder[targetClassification] >=
        this.classificationOrder[entry.classification]
      ) {
        throw new Error('Target classification must be lower than current classification');
      }

      const previousClassification = entry.classification;

      // Handle content re-encryption based on new classification
      const decryptedContent = IntelEncryptionService.decryptContent(entry.content);
      const newContent = IntelEncryptionService.encryptContent(
        decryptedContent,
        targetClassification
      );

      const decryptedMetadata = IntelEncryptionService.decryptMetadata(
        entry.metadata as IntelMetadata
      );
      const newMetadata = IntelEncryptionService.encryptMetadata(
        decryptedMetadata,
        targetClassification
      );

      // Update entry
      entry.classification = targetClassification;
      entry.content = newContent;
      entry.declassificationDate = undefined;
      entry.targetClassification = undefined;
      entry.autoDeclassify = false;

      // Add to aging history
      const agingHistory = decryptedMetadata?.agingHistory || [];
      agingHistory.push({
        date: new Date(),
        action: 'declassification_executed',
        fromClassification: previousClassification,
        toClassification: targetClassification,
        performedBy: userId,
        reason,
      });

      entry.metadata = {
        ...newMetadata,
        agingHistory,
      };

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId,
        action: IntelAuditAction.DECLASSIFICATION_EXECUTED,
        description: `Declassified intel from ${previousClassification} to ${targetClassification}`,
        ipAddress,
        userAgent,
        severity: 'warning',
        metadata: {
          previousClassification,
          newClassification: targetClassification,
          reason,
        },
      });

      logger.info('Declassification executed', {
        entryId: intelEntryId,
        previousClassification,
        newClassification: targetClassification,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error executing declassification:', error);
      throw error;
    }
  }

  /**
   * Schedule review for an intel entry
   */
  async scheduleReview(
    input: ScheduleReviewInput,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const canManage = await this.canManageAging(userId, input.organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to schedule reviews');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: input.intelEntryId, organizationId: input.organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      // Update review schedule
      entry.reviewDate = input.reviewDate;
      entry.reviewIntervalDays =
        input.reviewIntervalDays || this.defaultReviewIntervals[entry.classification];

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId: input.organizationId,
        userId,
        intelEntryId: input.intelEntryId,
        action: IntelAuditAction.AGING_REVIEW_DUE,
        description: `Scheduled review for ${input.reviewDate.toISOString()}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          reviewDate: input.reviewDate,
          reviewIntervalDays: entry.reviewIntervalDays,
        },
      });

      logger.info('Review scheduled', {
        entryId: input.intelEntryId,
        reviewDate: input.reviewDate,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error scheduling review:', error);
      throw error;
    }
  }

  /**
   * Complete review for an intel entry
   */
  async completeReview(
    intelEntryId: string,
    organizationId: string,
    userId: string,
    notes?: string,
    scheduleNextReview?: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to complete reviews');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId, organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      // Update review status
      entry.lastReviewedAt = new Date();
      entry.lastReviewedBy = userId;

      // Schedule next review if requested
      if (scheduleNextReview !== false && entry.reviewIntervalDays) {
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + entry.reviewIntervalDays);
        entry.reviewDate = nextReview;
      } else {
        entry.reviewDate = undefined;
      }

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId,
        action: IntelAuditAction.AGING_REVIEW_COMPLETED,
        description: 'Completed intel review',
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          notes,
          nextReviewDate: entry.reviewDate,
          reviewIntervalDays: entry.reviewIntervalDays,
        },
      });

      logger.info('Review completed', {
        entryId: intelEntryId,
        reviewedBy: userId,
        nextReviewDate: entry.reviewDate,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error completing review:', error);
      throw error;
    }
  }

  /**
   * Set expiration date for an intel entry
   */
  async setExpiration(
    intelEntryId: string,
    organizationId: string,
    expirationDate: Date,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelEntry> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to set expiration');
      }

      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId, organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      if (expirationDate <= new Date()) {
        throw new Error('Expiration date must be in the future');
      }

      entry.expirationDate = expirationDate;

      const saved = await this.intelEntryRepo.save(entry);

      // Log audit
      await this.logAudit({
        organizationId,
        userId,
        intelEntryId,
        action: IntelAuditAction.EXPIRATION_WARNING,
        description: `Set expiration date to ${expirationDate.toISOString()}`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: { expirationDate },
      });

      logger.info('Expiration set', {
        entryId: intelEntryId,
        expirationDate,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error setting expiration:', error);
      throw error;
    }
  }

  /**
   * Get entries due for review
   */
  async getEntriesDueForReview(
    organizationId: string,
    userId: string,
    options: {
      includeOverdue?: boolean;
      daysAhead?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: AgingReviewResult[]; total: number }> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to view reviews');
      }

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + (options.daysAhead || 7));

      const queryBuilder = this.intelEntryRepo
        .createQueryBuilder('entry')
        .where('entry.organizationId = :organizationId', { organizationId })
        .andWhere('entry.isArchived = :isArchived', { isArchived: false })
        .andWhere('entry.reviewDate IS NOT NULL')
        .andWhere('entry.reviewDate <= :futureDate', { futureDate });

      if (!options.includeOverdue) {
        queryBuilder.andWhere('entry.reviewDate >= :now', { now });
      }

      const total = await queryBuilder.getCount();

      queryBuilder
        .orderBy('entry.reviewDate', 'ASC')
        .skip(options.offset || 0)
        .take(options.limit || 50);

      const entries = await queryBuilder.getMany();

      const results: AgingReviewResult[] = entries.map(entry => {
        // reviewDate is filtered to be non-null by the query, fallback is for TypeScript type safety
        const reviewDate = entry.reviewDate || new Date();
        return {
          entryId: entry.id,
          title: entry.title,
          currentClassification: entry.classification,
          reviewDate,
          daysPastDue:
            reviewDate < now
              ? Math.ceil((now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24))
              : 0,
          lastReviewedAt: entry.lastReviewedAt,
          recommendation: this.getReviewRecommendation(entry),
        };
      });

      return { entries: results, total };
    } catch (error: unknown) {
      logger.error('Error getting entries due for review:', error);
      throw error;
    }
  }

  /**
   * Get entries pending declassification
   */
  async getEntriesPendingDeclassification(
    organizationId: string,
    userId: string,
    options: {
      includeOverdue?: boolean;
      daysAhead?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ entries: IntelEntry[]; total: number }> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to view declassifications');
      }

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + (options.daysAhead || 30));

      const queryBuilder = this.intelEntryRepo
        .createQueryBuilder('entry')
        .where('entry.organizationId = :organizationId', { organizationId })
        .andWhere('entry.isArchived = :isArchived', { isArchived: false })
        .andWhere('entry.declassificationDate IS NOT NULL')
        .andWhere('entry.declassificationDate <= :futureDate', { futureDate });

      if (!options.includeOverdue) {
        queryBuilder.andWhere('entry.declassificationDate >= :now', { now });
      }

      const total = await queryBuilder.getCount();

      queryBuilder
        .orderBy('entry.declassificationDate', 'ASC')
        .skip(options.offset || 0)
        .take(options.limit || 50);

      const entries = await queryBuilder.getMany();

      return { entries, total };
    } catch (error: unknown) {
      logger.error('Error getting pending declassifications:', error);
      throw error;
    }
  }

  /**
   * Process automatic declassifications (to be called by a scheduled job)
   */
  async processAutoDeclassifications(): Promise<DeclassificationResult[]> {
    const results: DeclassificationResult[] = [];
    const now = new Date();
    const BATCH_SIZE = 100;

    try {
      // Process in batches — always fetch from offset 0 since processed entries
      // no longer match the WHERE clause (autoDeclassify set to false after save)
      let hasMore = true;

      while (hasMore) {
        const entries = await this.intelEntryRepo.find({
          where: {
            autoDeclassify: true,
            declassificationDate: LessThanOrEqual(now),
            isArchived: false,
            targetClassification: Not(IsNull()),
          },
          take: BATCH_SIZE,
        });

        hasMore = entries.length === BATCH_SIZE;

        for (const entry of entries) {
          try {
            if (!entry.targetClassification) {
              continue;
            }

            const previousClassification = entry.classification;

            // Handle content re-encryption
            const decryptedContent = IntelEncryptionService.decryptContent(entry.content);
            const newContent = IntelEncryptionService.encryptContent(
              decryptedContent,
              entry.targetClassification
            );

            const decryptedMetadata = IntelEncryptionService.decryptMetadata(
              entry.metadata as IntelMetadata
            );
            const newMetadata = IntelEncryptionService.encryptMetadata(
              decryptedMetadata,
              entry.targetClassification
            );

            // Add to aging history
            const agingHistory = decryptedMetadata?.agingHistory || [];
            agingHistory.push({
              date: new Date(),
              action: 'auto_declassification',
              fromClassification: previousClassification,
              toClassification: entry.targetClassification,
              reason: 'Automatic declassification per schedule',
            });

            // Update entry
            entry.classification = entry.targetClassification;
            entry.content = newContent;
            entry.declassificationDate = undefined;
            entry.targetClassification = undefined;
            entry.autoDeclassify = false;
            entry.metadata = {
              ...newMetadata,
              agingHistory,
            };

            await this.intelEntryRepo.save(entry);

            // Log audit
            await this.logAudit({
              organizationId: entry.organizationId,
              userId: 'system',
              intelEntryId: entry.id,
              action: IntelAuditAction.DECLASSIFICATION_EXECUTED,
              description: `Auto-declassified from ${previousClassification} to ${entry.classification}`,
              severity: 'warning',
              metadata: {
                previousClassification,
                newClassification: entry.classification,
                automatic: true,
              },
            });

            results.push({
              entryId: entry.id,
              title: entry.title,
              previousClassification,
              newClassification: entry.classification,
              declassifiedAt: new Date(),
              success: true,
            });

            logger.info('Auto-declassification executed', {
              entryId: entry.id,
              previousClassification,
              newClassification: entry.classification,
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({
              entryId: entry.id,
              title: entry.title,
              previousClassification: entry.classification,
              newClassification: entry.targetClassification || entry.classification,
              declassifiedAt: new Date(),
              success: false,
              error: errorMessage,
            });

            logger.error('Error auto-declassifying entry:', {
              entryId: entry.id,
              error: errorMessage,
            });
          }
        }
      } // end while (hasMore)

      if (results.length > 0) {
        logger.info(`Processed ${results.length} auto-declassifications`, {
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        });
      }

      return results;
    } catch (error: unknown) {
      logger.error('Error processing auto-declassifications:', error);
      throw error;
    }
  }

  /**
   * Process expired intel entries (to be called by a scheduled job)
   */
  async processExpiredEntries(): Promise<number> {
    const now = new Date();

    try {
      const expiredEntries = await this.intelEntryRepo.find({
        where: {
          expirationDate: LessThan(now),
          isExpired: false,
          isArchived: false,
        },
      });

      for (const entry of expiredEntries) {
        entry.isExpired = true;
        entry.isArchived = true;

        await this.intelEntryRepo.save(entry);

        // Log audit
        await this.logAudit({
          organizationId: entry.organizationId,
          userId: 'system',
          intelEntryId: entry.id,
          action: IntelAuditAction.ENTRY_EXPIRED,
          description: 'Intel entry expired and archived',
          severity: 'info',
          metadata: {
            expirationDate: entry.expirationDate,
            classification: entry.classification,
          },
        });
      }

      if (expiredEntries.length > 0) {
        logger.info(`Processed ${expiredEntries.length} expired intel entries`);
      }

      return expiredEntries.length;
    } catch (error: unknown) {
      logger.error('Error processing expired entries:', error);
      throw error;
    }
  }

  /**
   * Get aging statistics for an organization
   */
  async getAgingStatistics(
    organizationId: string,
    userId: string
  ): Promise<{
    totalEntries: number;
    pendingReviews: number;
    overdueReviews: number;
    pendingDeclassifications: number;
    expiringSoon: number;
    byClassification: Record<IntelClassification, number>;
  }> {
    try {
      const canManage = await this.canManageAging(userId, organizationId);
      if (!canManage) {
        throw new Error('User does not have permission to view aging statistics');
      }

      const now = new Date();
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 30);

      const [
        totalEntries,
        pendingReviews,
        overdueReviews,
        pendingDeclassifications,
        expiringSoon,
        classificationCounts,
      ] = await Promise.all([
        this.intelEntryRepo.count({
          where: { organizationId, isArchived: false },
        }),
        this.intelEntryRepo.count({
          where: {
            organizationId,
            isArchived: false,
            reviewDate: Not(IsNull()),
          },
        }),
        this.intelEntryRepo.count({
          where: {
            organizationId,
            isArchived: false,
            reviewDate: LessThan(now),
          },
        }),
        this.intelEntryRepo.count({
          where: {
            organizationId,
            isArchived: false,
            declassificationDate: Not(IsNull()),
          },
        }),
        this.intelEntryRepo.count({
          where: {
            organizationId,
            isArchived: false,
            expirationDate: LessThanOrEqual(soonDate),
          },
        }),
        this.intelEntryRepo
          .createQueryBuilder('entry')
          .select('entry.classification', 'classification')
          .addSelect('COUNT(*)', 'count')
          .where('entry.organizationId = :organizationId', { organizationId })
          .andWhere('entry.isArchived = :isArchived', { isArchived: false })
          .groupBy('entry.classification')
          .getRawMany(),
      ]);

      const byClassification: Record<IntelClassification, number> = {
        [IntelClassification.PUBLIC]: 0,
        [IntelClassification.RESTRICTED]: 0,
        [IntelClassification.CONFIDENTIAL]: 0,
        [IntelClassification.SECRET]: 0,
        [IntelClassification.TOP_SECRET]: 0,
      };

      for (const row of classificationCounts as { classification: string; count: string }[]) {
        const classification = row.classification as IntelClassification;
        const count = Number.parseInt(row.count, 10);
        byClassification[classification] = count;
      }

      return {
        totalEntries,
        pendingReviews,
        overdueReviews,
        pendingDeclassifications,
        expiringSoon,
        byClassification,
      };
    } catch (error: unknown) {
      logger.error('Error getting aging statistics:', error);
      throw error;
    }
  }

  /**
   * Get review recommendation based on entry age and classification
   */
  private getReviewRecommendation(
    entry: IntelEntry
  ): 'maintain' | 'declassify' | 'archive' | 'delete' {
    const now = new Date();
    const ageInDays = Math.ceil(
      (now.getTime() - entry.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Tactical intel becomes stale faster
    if (
      entry.category === IntelCategory.TACTICAL &&
      ageInDays > IntelAgingService.TACTICAL_STALENESS_DAYS
    ) {
      return 'archive';
    }

    // High classification older than 1 year - consider declassification
    if (
      this.classificationOrder[entry.classification] >=
        this.classificationOrder[IntelClassification.SECRET] &&
      ageInDays > IntelAgingService.HIGH_CLASSIFICATION_DECLASSIFY_DAYS
    ) {
      return 'declassify';
    }

    // Very old intel - consider archiving
    if (ageInDays > IntelAgingService.OLD_INTEL_ARCHIVE_DAYS) {
      return 'archive';
    }

    return 'maintain';
  }

  /**
   * Log audit entry
   */
  private async logAudit(data: {
    organizationId: string;
    userId: string;
    intelEntryId?: string;
    action: IntelAuditAction;
    description?: string;
    ipAddress?: string;
    userAgent?: string;
    severity?: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        id: uuidv4(),
        ...data,
        severity: data.severity || 'info',
      });

      await this.auditLogRepo.save(auditLog);
    } catch (error: unknown) {
      logger.error('Error logging Intel audit:', error);
    }
  }
}

