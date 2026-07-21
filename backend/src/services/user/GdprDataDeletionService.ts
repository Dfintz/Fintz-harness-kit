import crypto from 'node:crypto';

import { Repository } from 'typeorm';

import { DELETION_GRACE_PERIOD_MS, MS_PER_DAY } from '../../config/gdpr';
import { AppDataSource } from '../../data-source';
import { AccountAccessLog } from '../../models/AccountAccessLog';
import { AccountPermission } from '../../models/AccountPermission';
import { Activity } from '../../models/Activity';
import { CrewAssignment } from '../../models/CrewAssignment';
import { DeletionRequest, DeletionRequestStatus } from '../../models/DeletionRequest';
import { DiscordUserPreference } from '../../models/DiscordUserPreference';
import { EventAttendanceConfirmation } from '../../models/EventAttendanceConfirmation';
import { IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelOfficer } from '../../models/IntelOfficer';
import { LegalHold } from '../../models/LegalHold';
import { LFGGroupHistory } from '../../models/LFGGroupHistory';
import { LFGReputationRating } from '../../models/LFGReputationRating';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { LogisticsAlert } from '../../models/LogisticsAlert';
import { MiningOperation } from '../../models/MiningOperation';
import { MAX_GRACE_PERIOD_DAYS, MIN_GRACE_PERIOD_DAYS } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import { OrgApplication } from '../../models/OrgApplication';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { Permission } from '../../models/Permission';
import { RecoveryToken } from '../../models/RecoveryToken';
import { RefreshToken } from '../../models/RefreshToken';
import { Reputation } from '../../models/Reputation';
import { TeamMember } from '../../models/TeamMember';
import { TokenBlacklist } from '../../models/TokenBlacklist';
import { TrustedDevice } from '../../models/TrustedDevice';
import { User } from '../../models/User';
import { UserActivity } from '../../models/UserActivity';
import { UserConsent } from '../../models/UserConsent';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { UserSession } from '../../models/UserSession';
import { UserShip } from '../../models/UserShip';
import { getUserPrimaryOrganization } from '../../utils/gdprUtils';
import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';
import { domainEvents } from '../shared/DomainEventBus';

/**
 * Legal hold status for a user
 */
export interface LegalHoldStatus {
  isOnHold: boolean;
  reason?: string;
  holdUntil?: Date;
  createdBy?: string;
}

/**
 * Deletion result with counts per entity type
 */
export interface GdprDeletionResult {
  success: boolean;
  userId: string;
  deletedCounts: Record<string, number>;
  totalDeleted: number;
  errors: string[];
  completedAt: Date;
}

/**
 * GDPR Data Deletion Service
 *
 * Implements full cascade deletion for GDPR Article 17 (Right to be Forgotten).
 * Handles deletion of all user-related data across all tables in the correct order
 * to respect foreign key constraints.
 *
 * Features:
 * - Full cascade deletion across all user-related tables
 * - Legal hold check before deletion (persisted in database)
 * - Transaction support for atomicity
 * - Audit logging of deletion operations
 * - Anonymization option for audit trails
 */
export class GdprDataDeletionService {
  private readonly legalHoldRepository: Repository<LegalHold>;
  private readonly deletionRequestRepository: Repository<DeletionRequest>;

  constructor() {
    this.legalHoldRepository = AppDataSource.getRepository(LegalHold);
    this.deletionRequestRepository = AppDataSource.getRepository(DeletionRequest);
  }

  /**
   * Get the grace period in milliseconds for a user
   * Uses organization-specific settings or global defaults
   * @param userId User ID
   * @returns Grace period in milliseconds
   */
  private async getGracePeriodMs(userId: string): Promise<number> {
    const organization = await getUserPrimaryOrganization(userId);

    if (organization) {
      const gdprSettings = organization.getGdprSettings();
      // Validate the grace period is within bounds
      const gracePeriodDays = Math.max(
        MIN_GRACE_PERIOD_DAYS,
        Math.min(MAX_GRACE_PERIOD_DAYS, gdprSettings.deletionGracePeriodDays)
      );
      return gracePeriodDays * MS_PER_DAY;
    }

    // Fall back to global default
    return DELETION_GRACE_PERIOD_MS;
  }

  /**
   * Create a new deletion request with grace period
   * @param userId User ID
   * @param ipAddress IP address of the request
   * @param userAgent User agent of the request
   * @returns Created deletion request
   */
  public async createDeletionRequest(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<DeletionRequest> {
    // Check if there's already a pending deletion request
    const existingRequest = await this.deletionRequestRepository.findOne({
      where: {
        userId,
        status: DeletionRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      logger.info(`User ${userId} already has a pending deletion request`);
      return existingRequest;
    }

    // Get deletion preview
    const preview = await this.getDataDeletionPreview(userId);

    // Get organization-specific grace period
    const gracePeriodMs = await this.getGracePeriodMs(userId);
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + gracePeriodMs);

    const deletionRequest = this.deletionRequestRepository.create({
      id: crypto.randomUUID(),
      userId,
      status: DeletionRequestStatus.PENDING,
      requestedAt: now,
      scheduledFor,
      requestIpAddress: ipAddress,
      requestUserAgent: userAgent,
      deletionPreview: preview,
    });

    await this.deletionRequestRepository.save(deletionRequest);
    logger.info(
      `Deletion request created for user ${userId}, scheduled for ${scheduledFor.toISOString()} (grace period: ${gracePeriodMs / MS_PER_DAY} days)`
    );

    // Emit audit log (GDPR critical)
    auditService.log({
      category: AuditCategory.USER,
      action: 'USER_DELETION_REQUESTED',
      message: `User deletion request created`,
      userId,
      resource: `user/${userId}/deletion-request`,
      metadata: {
        requestId: deletionRequest.id,
        scheduledFor: scheduledFor.toISOString(),
        gracePeriodDays: gracePeriodMs / MS_PER_DAY,
        previewCounts: preview,
      },
    });

    return deletionRequest;
  }

  /**
   * Cancel a pending deletion request
   * @param userId User ID
   * @param reason Optional cancellation reason
   * @returns Updated deletion request or null if not found
   */
  public async cancelDeletionRequest(
    userId: string,
    reason?: string
  ): Promise<DeletionRequest | null> {
    const deletionRequest = await this.deletionRequestRepository.findOne({
      where: {
        userId,
        status: DeletionRequestStatus.PENDING,
      },
    });

    if (!deletionRequest) {
      logger.warn(`No pending deletion request found for user ${userId}`);
      return null;
    }

    // Check if grace period has already expired
    if (new Date() >= deletionRequest.scheduledFor) {
      logger.warn(`Cannot cancel deletion request for user ${userId}: grace period expired`);
      throw new Error('Grace period has expired, cannot cancel deletion');
    }

    deletionRequest.status = DeletionRequestStatus.CANCELLED;
    deletionRequest.cancelledAt = new Date();
    deletionRequest.cancelledBy = userId;
    deletionRequest.cancellationReason = reason;

    await this.deletionRequestRepository.save(deletionRequest);
    logger.info(`Deletion request cancelled for user ${userId}`);

    return deletionRequest;
  }

  /**
   * Get pending deletion request for a user
   * @param userId User ID
   * @returns Deletion request or null if not found
   */
  public async getPendingDeletionRequest(userId: string): Promise<DeletionRequest | null> {
    return this.deletionRequestRepository.findOne({
      where: {
        userId,
        status: DeletionRequestStatus.PENDING,
      },
    });
  }

  /**
   * Get all pending deletion requests (for admin dashboard)
   * @returns Array of pending deletion requests
   */
  public async getAllPendingDeletionRequests(): Promise<DeletionRequest[]> {
    return this.deletionRequestRepository.find({
      where: { status: DeletionRequestStatus.PENDING },
      order: { scheduledFor: 'ASC' },
    });
  }

  /**
   * Get count of pending deletion requests
   * @returns Number of pending requests
   */
  public async getPendingDeletionCount(): Promise<number> {
    return this.deletionRequestRepository.count({
      where: { status: DeletionRequestStatus.PENDING },
    });
  }

  /**
   * Get all deletion requests across all statuses (for admin dashboard)
   * @param limit Maximum number of requests to return
   * @returns Array of deletion requests ordered by most recent first
   */
  public async getAllDeletionRequests(limit = 50): Promise<DeletionRequest[]> {
    return this.deletionRequestRepository.find({
      order: { requestedAt: 'DESC' },
      take: limit,
      select: [
        'id',
        'userId',
        'status',
        'requestedAt',
        'scheduledFor',
        'completedAt',
        'cancelledAt',
      ],
    });
  }

  /**
   * Mark a deletion request as completed
   * @param requestId Deletion request ID
   * @param result Deletion result
   */
  public async markDeletionComplete(requestId: string, result: GdprDeletionResult): Promise<void> {
    const deletionRequest = await this.deletionRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!deletionRequest) {
      logger.warn(`Deletion request ${requestId} not found`);
      return;
    }

    deletionRequest.status = result.success
      ? DeletionRequestStatus.COMPLETED
      : DeletionRequestStatus.FAILED;
    deletionRequest.completedAt = new Date();

    if (!result.success && result.errors.length > 0) {
      deletionRequest.failureReason = result.errors.join('; ');
    }

    await this.deletionRequestRepository.save(deletionRequest);
    logger.info(`Deletion request ${requestId} marked as ${deletionRequest.status}`);
  }

  /**
   * Process due deletion requests (called by scheduled job)
   * @returns Array of processing results
   */
  public async processDueDeletions(): Promise<
    Array<{ userId: string; result: GdprDeletionResult }>
  > {
    const now = new Date();
    const dueRequests = await this.deletionRequestRepository.find({
      where: { status: DeletionRequestStatus.PENDING },
      order: { scheduledFor: 'ASC' },
    });

    const results: Array<{ userId: string; result: GdprDeletionResult }> = [];

    for (const request of dueRequests) {
      // Only process if scheduled time has passed
      if (request.scheduledFor <= now) {
        if (!request.userId) {
          logger.warn(`Skipping deletion request ${request.id} with no userId`);
          continue;
        }

        const userId = request.userId; // Store in local variable for type narrowing
        logger.info(`Processing due deletion request for user ${userId}`);

        try {
          const result = await this.deleteAllUserData(userId);
          await this.markDeletionComplete(request.id, result);
          results.push({ userId, result });
        } catch (error: unknown) {
          logger.error(`Error processing deletion for user ${userId}:`, error);
          const errorResult: GdprDeletionResult = {
            success: false,
            userId,
            deletedCounts: {},
            totalDeleted: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            completedAt: new Date(),
          };
          await this.markDeletionComplete(request.id, errorResult);
          results.push({ userId, result: errorResult });
        }
      }
    }

    return results;
  }

  /**
   * Check if a user is under legal hold
   * @param userId User ID to check
   * @returns Legal hold status
   */
  public async checkLegalHold(userId: string): Promise<LegalHoldStatus> {
    try {
      const hold = await this.legalHoldRepository.findOne({
        where: { userId, isActive: true },
      });

      if (!hold) {
        return { isOnHold: false };
      }

      // Check if hold has expired
      if (hold.holdUntil && hold.holdUntil < new Date()) {
        hold.isActive = false;
        await this.legalHoldRepository.save(hold);
        logger.info(`Legal hold expired for user ${userId}`);
        return { isOnHold: false };
      }

      return {
        isOnHold: true,
        reason: hold.reason,
        holdUntil: hold.holdUntil,
        createdBy: hold.createdBy,
      };
    } catch (error: unknown) {
      logger.error(`Error checking legal hold for user ${userId}:`, error);
      // Default to allowing deletion if we can't check (fail open for user rights)
      return { isOnHold: false };
    }
  }

  /**
   * Set a legal hold on a user
   * @param userId User ID
   * @param reason Reason for legal hold
   * @param holdUntil Optional expiration date
   * @param createdBy Admin who created the hold
   */
  public async setLegalHold(
    userId: string,
    reason: string,
    holdUntil?: Date,
    createdBy?: string
  ): Promise<void> {
    const hold = this.legalHoldRepository.create({
      id: crypto.randomUUID(),
      userId,
      reason,
      holdUntil,
      createdBy,
      isActive: true,
    });

    await this.legalHoldRepository.save(hold);
    logger.warn(`Legal hold set for user ${userId}: ${reason}`);
  }

  /**
   * Remove a legal hold from a user
   * @param userId User ID
   */
  public async removeLegalHold(userId: string): Promise<void> {
    await this.legalHoldRepository.update({ userId, isActive: true }, { isActive: false });
    logger.info(`Legal hold removed for user ${userId}`);
  }

  /**
   * Delete all user data (GDPR Article 17 - Right to be Forgotten)
   *
   * This method performs a full cascade deletion of all user-related data
   * across all tables in the correct order to respect foreign key constraints.
   *
   * @param userId User ID to delete
   * @param bypassLegalHold Admin override for legal hold (use with caution)
   * @returns Deletion result with counts per entity type
   */
  public async deleteAllUserData(
    userId: string,
    bypassLegalHold: boolean = false
  ): Promise<GdprDeletionResult> {
    const result: GdprDeletionResult = {
      success: false,
      userId,
      deletedCounts: {},
      totalDeleted: 0,
      errors: [],
      completedAt: new Date(),
    };

    try {
      // Check for legal hold
      if (!bypassLegalHold) {
        const holdStatus = await this.checkLegalHold(userId);
        if (holdStatus.isOnHold) {
          result.errors.push(`User is under legal hold: ${holdStatus.reason}`);
          logger.warn(`GDPR deletion blocked by legal hold for user ${userId}`);
          return result;
        }
      }

      logger.info(`Starting GDPR cascade deletion for user ${userId}`);

      // Emit audit log (GDPR critical deletion operation)
      auditService.log({
        category: AuditCategory.USER,
        action: 'USER_DATA_DELETION_STARTED',
        message: `GDPR cascade deletion started for user`,
        userId,
        resource: `user/${userId}/data-deletion`,
        metadata: {
          bypassLegalHold,
          timestamp: new Date().toISOString(),
        },
      });

      // Wave 2.1 — capture user data and memberships before deletion for domain events
      const userForEvent = await AppDataSource.getRepository(User).findOne({
        where: { id: userId },
      });
      const membershipsForEvent = await AppDataSource.getRepository(OrganizationMembership).find({
        where: { userId, isActive: true },
        select: ['organizationId'],
      });
      const username = userForEvent?.username ?? 'deleted-user';

      // Use a transaction for atomicity
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Delete in order of dependencies (leaf tables first)

        // 1. Session and token related data
        result.deletedCounts.refreshTokens = await this.deleteFromTable(
          queryRunner,
          RefreshToken,
          'userId',
          userId
        );
        result.deletedCounts.tokenBlacklist = await this.deleteFromTable(
          queryRunner,
          TokenBlacklist,
          'userId',
          userId
        );
        result.deletedCounts.userSessions = await this.deleteFromTableNumericId(
          queryRunner,
          UserSession,
          'userId',
          userId
        );
        result.deletedCounts.passwordResetTokens = await this.deleteFromTable(
          queryRunner,
          PasswordResetToken,
          'userId',
          userId
        );
        result.deletedCounts.recoveryTokens = await this.deleteFromTable(
          queryRunner,
          RecoveryToken,
          'userId',
          userId
        );
        result.deletedCounts.trustedDevices = await this.deleteFromTable(
          queryRunner,
          TrustedDevice,
          'userId',
          userId
        );
        // Discord per-user notification preferences (one row per guild). Composite PK
        // (userId, guildId) — filtering by userId column removes all of them in one query.
        result.deletedCounts.discordPreferences = await this.deleteFromTable(
          queryRunner,
          DiscordUserPreference,
          'userId',
          userId
        );

        // 2. Permission and access related data
        result.deletedCounts.permissions = await this.deleteFromTable(
          queryRunner,
          Permission,
          'userId',
          userId
        );
        result.deletedCounts.accountPermissions = await this.deleteFromTable(
          queryRunner,
          AccountPermission,
          'userId',
          userId
        );
        result.deletedCounts.organizationPermissions = await this.deleteFromTable(
          queryRunner,
          OrganizationPermission,
          'userId',
          userId
        );
        result.deletedCounts.accountAccessLogs = await this.deleteFromTable(
          queryRunner,
          AccountAccessLog,
          'userId',
          userId
        );

        // 3. Organization membership data
        result.deletedCounts.orgApplications = await this.deleteFromTable(
          queryRunner,
          OrgApplication,
          'applicantUserId',
          userId
        );
        result.deletedCounts.userOrganizations = await this.deleteFromTable(
          queryRunner,
          OrganizationMembership,
          'userId',
          userId
        );
        result.deletedCounts.organizationMemberships = await this.deleteFromTable(
          queryRunner,
          OrganizationMembership,
          'userId',
          userId
        );

        // 4. Fleet and ship related data
        result.deletedCounts.userShips = await this.deleteFromTable(
          queryRunner,
          UserShip,
          'userId',
          userId
        );
        result.deletedCounts.teamMembers = await this.deleteFromTable(
          queryRunner,
          TeamMember,
          'userId',
          userId
        );
        result.deletedCounts.crewAssignments = await this.deleteFromTable(
          queryRunner,
          CrewAssignment,
          'userId',
          userId
        );

        // 5. Activity and event related data
        result.deletedCounts.userActivities = await this.deleteFromTable(
          queryRunner,
          UserActivity,
          'userId',
          userId
        );
        result.deletedCounts.eventAttendance = await this.deleteFromTable(
          queryRunner,
          EventAttendanceConfirmation,
          'userId',
          userId
        );

        // Activities created by user (anonymize instead of delete to preserve history)
        result.deletedCounts.activitiesAnonymized = await this.anonymizeActivities(
          queryRunner,
          userId
        );

        // 6. Intel and security related data
        result.deletedCounts.intelOfficers = await this.deleteFromTable(
          queryRunner,
          IntelOfficer,
          'userId',
          userId
        );
        result.deletedCounts.intelAuditLogs = await this.anonymizeIntelAuditLogs(
          queryRunner,
          userId
        );

        // 7. LFG and reputation data
        result.deletedCounts.lfgUserReputation = await this.deleteFromTable(
          queryRunner,
          LFGUserReputation,
          'userId',
          userId
        );
        result.deletedCounts.lfgReputationRatings = await this.deleteFromTableByRater(
          queryRunner,
          userId
        );
        result.deletedCounts.lfgGroupHistory = await this.deleteFromTable(
          queryRunner,
          LFGGroupHistory,
          'userId',
          userId
        );
        result.deletedCounts.reputation = await this.deleteFromTable(
          queryRunner,
          Reputation,
          'userId',
          userId
        );

        // 8. Operations and logistics data
        result.deletedCounts.miningOperations = await this.deleteFromTable(
          queryRunner,
          MiningOperation,
          'leaderId',
          userId
        );
        result.deletedCounts.logisticsAlerts = await this.deleteFromTable(
          queryRunner,
          LogisticsAlert,
          'userId',
          userId
        );

        // 8b. SCStats data (Wave 2.5 — clear imported gameplay analytics)
        result.deletedCounts.scstatsData = await this.clearSCStatsData(queryRunner, userId);

        // 9. Consent records (delete last for audit purposes)
        result.deletedCounts.consents = await this.deleteFromTable(
          queryRunner,
          UserConsent,
          'userId',
          userId
        );

        // 10. Finally, delete the user record
        const userRepo = queryRunner.manager.getRepository(User);
        const userResult = await userRepo.delete({ id: userId });
        result.deletedCounts.user = userResult.affected || 0;

        // Calculate total
        result.totalDeleted = Object.values(result.deletedCounts).reduce((a, b) => a + b, 0);

        // Commit transaction
        await queryRunner.commitTransaction();
        result.success = true;
        result.completedAt = new Date();

        logger.info(`GDPR cascade deletion completed for user ${userId}`, {
          totalDeleted: result.totalDeleted,
          deletedCounts: result.deletedCounts,
        });

        // Emit audit log (GDPR critical)
        auditService.log({
          category: AuditCategory.USER,
          action: 'USER_DATA_DELETION_COMPLETED',
          message: `GDPR cascade deletion completed for user`,
          userId,
          resource: `user/${userId}/data-deletion`,
          metadata: {
            totalDeleted: result.totalDeleted,
            deletedCounts: result.deletedCounts,
            completedAt: result.completedAt.toISOString(),
          },
        });

        // Wave 2.1 — emit platform_left for each org the user was in
        for (const membership of membershipsForEvent) {
          domainEvents.emit('member:platform_left', {
            timestamp: new Date().toISOString(),
            userId,
            organizationId: membership.organizationId,
            username,
          });
        }
      } catch (error: unknown) {
        // Rollback on error
        await queryRunner.rollbackTransaction();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(errorMessage);
        logger.error(`GDPR deletion failed for user ${userId}:`, error);
      } finally {
        await queryRunner.release();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      logger.error(`GDPR deletion error for user ${userId}:`, error);
    }

    return result;
  }

  /**
   * Helper to delete from a table by userId (string)
   */
  private async deleteFromTable<T extends object>(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    entity: new () => T,
    column: string,
    userId: string
  ): Promise<number> {
    try {
      const repo = queryRunner.manager.getRepository(entity);
      // Use query builder to avoid type issues with dynamic column names
      const result = await repo
        .createQueryBuilder()
        .delete()
        .where(`${column} = :userId`, { userId })
        .execute();
      return result.affected || 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Log specific errors but don't fail the whole deletion
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        logger.debug(`Table ${entity.name} may not exist, skipping: ${errorMessage}`);
      } else {
        logger.warn(`Error deleting from ${entity.name}: ${errorMessage}`);
      }
      return 0;
    }
  }

  /**
   * Helper to delete from a table by userId (numeric, requires parsing)
   * Some tables use numeric IDs for user references
   */
  private async deleteFromTableNumericId<T extends object>(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    entity: new () => T,
    column: string,
    userId: string
  ): Promise<number> {
    try {
      const numericId = Number.parseInt(userId, 10);
      if (Number.isNaN(numericId)) {
        logger.debug(`Could not parse numeric userId for ${entity.name}: ${userId}`);
        return 0;
      }
      const repo = queryRunner.manager.getRepository(entity);
      // Use query builder to avoid type issues with dynamic column names
      const result = await repo
        .createQueryBuilder()
        .delete()
        .where(`${column} = :numericId`, { numericId })
        .execute();
      return result.affected || 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        logger.debug(`Table ${entity.name} may not exist, skipping: ${errorMessage}`);
      } else {
        logger.warn(`Error deleting from ${entity.name}: ${errorMessage}`);
      }
      return 0;
    }
  }

  /**
   * Delete LFG reputation ratings where user is the rater
   */
  private async deleteFromTableByRater(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    userId: string
  ): Promise<number> {
    try {
      const repo = queryRunner.manager.getRepository(LFGReputationRating);
      const result = await repo.delete({ raterId: userId });
      return result.affected || 0;
    } catch (error: unknown) {
      logger.debug(`Could not delete LFG ratings by rater: ${error}`);
      return 0;
    }
  }

  /**
   * Clear SCStats data from user gameplay preferences (Wave 2.5)
   * Nullifies all SCStats-specific columns rather than deleting the row
   */
  private async clearSCStatsData(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    userId: string
  ): Promise<number> {
    try {
      const repo = queryRunner.manager.getRepository(UserGameplayPreferences);
      const result = await repo.update(
        { userId },
        {
          scstatsRawData: null,
          scstatsLastImport: null,
          scstatsVerified: false,
          scstatsTotalHours: null,
          scstatsKdRatio: null,
          scstatsMissionsCompleted: null,
          scstatsFavoriteVehicle: null,
          scstatsConsentGranted: false,
          scstatsConsentDate: null,
        }
      );
      return result.affected || 0;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(`Error clearing SCStats data: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Anonymize activities created by the user instead of deleting
   * This preserves the activity record for other participants
   */
  private async anonymizeActivities(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    userId: string
  ): Promise<number> {
    try {
      const repo = queryRunner.manager.getRepository(Activity);
      const result = await repo.update(
        { creatorId: userId },
        {
          creatorId: 'DELETED_USER',
          // Optionally anonymize other fields
        }
      );
      return result.affected || 0;
    } catch (error: unknown) {
      logger.debug(`Could not anonymize activities: ${error}`);
      return 0;
    }
  }

  /**
   * Anonymize intel audit logs instead of deleting for security audit trail
   */
  private async anonymizeIntelAuditLogs(
    queryRunner: ReturnType<typeof AppDataSource.createQueryRunner>,
    userId: string
  ): Promise<number> {
    try {
      const repo = queryRunner.manager.getRepository(IntelAuditLog);
      // CWE-798: Use environment variable for anonymized user sentinel
      // NOSONAR: Hardcoded-credential false positive — 'DELETED_USER' is a non-secret
      // anonymization sentinel, not a password or credential.
      const anonymizedUserId = process.env.ANONYMIZED_USER_ID || 'DELETED_USER'; // NOSONAR
      const result = await repo.update(
        { userId },
        {
          userId: anonymizedUserId,
        }
      );
      return result.affected || 0;
    } catch (error: unknown) {
      logger.debug(`Could not anonymize intel audit logs: ${error}`);
      return 0;
    }
  }

  /**
   * Get a summary of data that would be deleted for a user
   * Useful for preview before actual deletion
   */
  public async getDataDeletionPreview(userId: string): Promise<Record<string, number>> {
    const preview: Record<string, number> = {};

    try {
      preview.user = await AppDataSource.getRepository(User).count({ where: { id: userId } });
      preview.refreshTokens = await AppDataSource.getRepository(RefreshToken).count({
        where: { userId },
      });
      preview.userSessions = await AppDataSource.getRepository(UserSession).count({
        where: { userId: Number.parseInt(userId, 10) || 0 },
      });
      preview.consents = await AppDataSource.getRepository(UserConsent).count({
        where: { userId },
      });
      preview.userShips = await AppDataSource.getRepository(UserShip).count({ where: { userId } });
      preview.userOrganizations = await AppDataSource.getRepository(OrganizationMembership).count({
        where: { userId },
      });
      preview.activities = await AppDataSource.getRepository(Activity).count({
        where: { creatorId: userId },
      });
      preview.trustedDevices = await AppDataSource.getRepository(TrustedDevice).count({
        where: { userId },
      });
      preview.discordPreferences = await AppDataSource.getRepository(DiscordUserPreference).count({
        where: { userId },
      });
      // Add more counts as needed
    } catch (error: unknown) {
      logger.error(`Error getting deletion preview for user ${userId}:`, error);
    }

    return preview;
  }
}

// Singleton instance
let instance: GdprDataDeletionService | null = null;

export const getGdprDataDeletionService = (): GdprDataDeletionService => {
  if (!instance) {
    instance = new GdprDataDeletionService();
    logger.info('GdprDataDeletionService initialized');
  }
  return instance;
};
