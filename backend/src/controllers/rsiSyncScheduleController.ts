/**
 * RSI Sync Schedule Controller
 *
 * Handles HTTP requests for RSI sync scheduling and audit logging.
 * Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging
 *
 * Extends BaseController for automatic error handling and consistent responses.
 */

import { Response } from 'express';

import { triggerManualSync } from '../jobs/rsiSyncScheduler';
import { AuthRequest } from '../middleware/auth';
import { SyncType } from '../models/RsiSyncAuditLog';
import { VerificationMethod } from '../models/RsiUserLink';
import type { SyncScheduleInput } from '../services/rsi';
import {
  ReviewResolution,
  rsiSyncAuditService,
  rsiSyncReviewService,
  rsiSyncScheduleService,
  rsiUserLinkService,
} from '../services/rsi';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { logger } from '../utils/logger';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/** Request body for creating/updating a sync schedule (Joi-validated at route level) */
interface UpsertScheduleBody {
  rsiOrgSid: string;
  guildId?: string;
  isEnabled: boolean;
  intervalMinutes: number;
  notifyOnChanges?: boolean;
  notifyOnErrors?: boolean;
  notificationChannelId?: string;
  removeRolesOnLeave?: boolean;
  affiliateHandling?: 'include' | 'exclude' | 'special_role';
  affiliateRoleId?: string;
}

export class RsiSyncScheduleController extends BaseController {
  // ==================== SCHEDULE ENDPOINTS ====================

  /**
   * Get sync schedule for organization
   * GET /api/v2/rsi/sync/schedule/:orgId
   */
  public getSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const status = await rsiSyncScheduleService.getScheduleStatus(orgId);

      return {
        schedule: status.exists
          ? {
              enabled: status.enabled,
              interval: status.interval,
              rsiOrgSid: status.rsiOrgSid,
              lastSync: status.lastSync,
              nextSync: status.nextSync,
              failures: status.failures,
              autoDisabled: status.autoDisabled,
            }
          : null,
      };
    });
  };

  /**
   * Create or update sync schedule
   * POST /api/v2/rsi/sync/schedule/:orgId
   */
  public upsertSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const body = req.body as UpsertScheduleBody;

      const input: SyncScheduleInput = {
        organizationId: orgId,
        rsiOrgSid: body.rsiOrgSid,
        guildId: body.guildId,
        isEnabled: body.isEnabled,
        intervalMinutes: body.intervalMinutes,
        notifyOnChanges: body.notifyOnChanges,
        notifyOnErrors: body.notifyOnErrors,
        notificationChannelId: body.notificationChannelId,
        removeRolesOnLeave: body.removeRolesOnLeave,
        affiliateHandling: body.affiliateHandling,
        affiliateRoleId: body.affiliateRoleId,
      };

      const schedule = await rsiSyncScheduleService.upsertSchedule(input);

      return {
        message: 'Schedule saved successfully',
        schedule: {
          id: schedule.id,
          enabled: schedule.isEnabled,
          interval: schedule.getIntervalDisplay(),
          rsiOrgSid: schedule.rsiOrgSid,
          lastSync: schedule.lastSyncAt ?? null,
          nextSync: schedule.nextSyncAt ?? null,
          failures: schedule.consecutiveFailures,
          autoDisabled: schedule.isAutoDisabled(),
        },
      };
    });
  };

  /**
   * Enable sync schedule
   * POST /api/v2/rsi/sync/schedule/:orgId/enable
   */
  public enableSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const schedule = await rsiSyncScheduleService.enableSchedule(orgId);

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      return {
        message: 'Schedule enabled successfully',
        schedule: {
          enabled: schedule.isEnabled,
          nextSync: schedule.nextSyncAt,
        },
      };
    });
  };

  /**
   * Disable sync schedule
   * POST /api/v2/rsi/sync/schedule/:orgId/disable
   */
  public disableSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const schedule = await rsiSyncScheduleService.disableSchedule(orgId);

      if (!schedule) {
        throw new NotFoundError('Schedule not found');
      }

      return {
        message: 'Schedule disabled successfully',
        schedule: { enabled: schedule.isEnabled },
      };
    });
  };

  /**
   * Delete sync schedule
   * DELETE /api/v2/rsi/sync/schedule/:orgId
   */
  public deleteSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const deleted = await rsiSyncScheduleService.deleteSchedule(orgId);

      if (!deleted) {
        throw new NotFoundError('Schedule not found');
      }

      return { message: 'Schedule deleted successfully' };
    });
  };

  // ==================== AUDIT LOG ENDPOINTS ====================

  /**
   * Get audit logs for organization
   * GET /api/v2/rsi/sync/audit/:orgId
   */
  public getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 20, 200);
      const offset = Math.max(Number.parseInt(req.query.offset as string, 10) || 0, 0);
      const syncType = req.query.syncType as SyncType | undefined;
      let hasErrors: boolean | undefined;
      if (req.query.hasErrors !== undefined) {
        hasErrors = parseBooleanQuery(req.query.hasErrors);
      }

      const { logs, total } = await rsiSyncAuditService.getLogs({
        organizationId: orgId,
        syncType,
        hasErrors,
        limit,
        offset,
      });

      const stats = await rsiSyncAuditService.getStatistics(orgId);

      return {
        logs: logs.map(log => ({
          id: log.id,
          syncType: log.syncType,
          changesDetected: log.changesDetected,
          changesApplied: log.changesApplied,
          errors: log.errors,
          syncedAt: log.syncedAt,
          summary: log.getSummary(),
          durationSeconds: log.getDurationSeconds(),
        })),
        total,
        stats: {
          totalSyncs: stats.totalSyncs,
          successfulSyncs: stats.successfulSyncs,
          failedSyncs: stats.failedSyncs,
          totalChangesApplied: stats.totalChangesApplied,
        },
      };
    });
  };

  /**
   * Get audit statistics for organization
   * GET /api/v2/rsi/sync/audit/:orgId/stats
   */
  public getAuditStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;

      const stats = await rsiSyncAuditService.getStatistics(orgId, fromDate);
      return { stats };
    });
  };

  /**
   * Get single audit log entry
   * GET /api/v2/rsi/sync/audit/:orgId/:logId
   */
  public getAuditLogById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, logId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const log = await rsiSyncAuditService.getLogById(logId);

      if (!log || log.organizationId !== orgId) {
        throw new NotFoundError('Audit log not found');
      }

      return {
        log: {
          id: log.id,
          syncType: log.syncType,
          changesDetected: log.changesDetected,
          changesApplied: log.changesApplied,
          errors: log.errors,
          syncedAt: log.syncedAt,
          summary: log.getSummary(),
          durationSeconds: log.getDurationSeconds(),
          details: log.details,
        },
      };
    });
  };

  // ==================== MANUAL SYNC TRIGGER ====================

  /**
   * Trigger manual sync with audit logging
   * POST /api/v2/rsi/sync/trigger/:orgId
   */
  public triggerManualSync = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const triggeredBy = this.getAuthUser(req).id;

      await triggerManualSync(orgId, triggeredBy);

      return {
        message: 'Manual sync triggered successfully',
        note: 'Check the audit log for sync results',
      };
    });
  };

  // ==================== MEMBER MANAGEMENT ENDPOINTS ====================

  /**
   * List linked members for an organization with role status
   * GET /api/v2/rsi/sync/members/:orgId
   */
  public listMembers = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const includeRemoved = parseBooleanQuery(req.query.includeRemoved);

      const links = await rsiUserLinkService.getLinksByOrganization(orgId, includeRemoved);
      const stats = await rsiUserLinkService.getOrgSyncStats(orgId);

      return {
        members: links.map(link => ({
          id: link.id,
          userId: link.userId,
          rsiHandle: link.rsiHandle,
          verificationMethod: link.verificationMethod,
          verified: link.isVerified(),
          verifiedAt: link.verifiedAt,
          syncStatus: link.syncStatus,
          lastSyncedAt: link.lastSyncedAt,
          lastKnownRank: link.lastKnownRank,
          isAffiliate: link.isAffiliate,
          discordUserId: link.discordUserId,
          createdAt: link.createdAt,
        })),
        total: links.length,
        stats,
      };
    });
  };

  /**
   * Manually assign an RSI handle to a user (admin action)
   * POST /api/v2/rsi/sync/manual-assign/:orgId
   */
  public manualAssign = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const { orgId } = req.params;
        this.verifyOrgAccess(req, orgId);

        const { userId, rsiHandle, discordUserId, rank } = req.body as {
          userId: string;
          rsiHandle: string;
          discordUserId?: string;
          rank?: string;
        };
        const adminId = this.getAuthUser(req).id;

        if (!userId || !rsiHandle) {
          throw new ValidationError('userId and rsiHandle are required');
        }

        // Check if link already exists
        const existing = await rsiUserLinkService.getLinkByUserAndOrg(userId, orgId);
        if (existing) {
          throw new ConflictError(
            `User already has a link for this organization (handle: ${existing.rsiHandle})`
          );
        }

        // Create the link with manual verification
        const link = await rsiUserLinkService.createLink({
          userId,
          organizationId: orgId,
          rsiHandle,
          verificationMethod: VerificationMethod.MANUAL,
          discordUserId,
        });

        // Immediately verify it (admin action)
        await rsiUserLinkService.manuallyVerify(link.id);

        // If rank is provided, persist it via the service
        if (rank) {
          await rsiUserLinkService.updateLink(link.id, {
            lastKnownRank: rank,
            metadata: {
              manuallyAssignedBy: adminId,
              manuallyAssignedAt: new Date().toISOString(),
              manualRank: rank,
            },
          });
        }

        logger.info(
          `Admin ${adminId} manually assigned ${rsiHandle} to user ${userId} in org ${orgId}`
        );

        return {
          message: 'Member manually assigned and verified',
          link: {
            id: link.id,
            userId: link.userId,
            rsiHandle: link.rsiHandle,
            verified: true,
            verificationMethod: VerificationMethod.MANUAL,
            discordUserId: link.discordUserId,
          },
        };
      },
      201
    );
  };

  /**
   * Manually verify an existing link (admin action)
   * POST /api/v2/rsi/sync/members/:orgId/:linkId/verify
   */
  public manualVerify = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, linkId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const adminId = this.getAuthUser(req).id;

      const link = await rsiUserLinkService.manuallyVerify(linkId);
      if (!link) {
        throw new NotFoundError('Link not found');
      }

      // Assign the "Verified" Discord role immediately if user has a Discord ID.
      // Role assignment is best-effort: a failure should not block the verification
      // response — the link is already persisted as verified at this point.
      if (link.discordUserId) {
        const { VerifiedRoleSyncService } = await import(
          '../services/discord/VerifiedRoleSyncService'
        );
        VerifiedRoleSyncService.getInstance()
          .assignVerifiedRole(link.discordUserId, [orgId])
          .catch(err => logger.warn('Failed to assign verified role after manual verify', err));
      }

      logger.info(`Admin ${adminId} manually verified link ${linkId}`);
      return { message: 'Link verified successfully' };
    });
  };

  /**
   * Remove a member link (admin action)
   * DELETE /api/v2/rsi/sync/members/:orgId/:linkId
   */
  public removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId, linkId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const adminId = this.getAuthUser(req).id;

      const deleted = await rsiUserLinkService.deleteLink(linkId);
      if (!deleted) {
        throw new NotFoundError('Link not found');
      }

      logger.info(`Admin ${adminId} removed member link ${linkId}`);
      return { message: 'Member link removed successfully' };
    });
  };

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk verify existing member links (admin action)
   * POST /api/v2/rsi/sync/bulk-verify/:orgId
   */
  public bulkVerify = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const { linkIds } = req.body as { linkIds: string[] };
      const adminId = this.getAuthUser(req).id;

      if (!Array.isArray(linkIds) || linkIds.length === 0) {
        throw new ValidationError('linkIds array is required and must not be empty');
      }
      if (linkIds.length > 100) {
        throw new ValidationError('Maximum 100 links per bulk operation');
      }

      const result = await rsiUserLinkService.bulkManuallyVerify(linkIds);

      logger.info(`Admin ${adminId} bulk verified ${result.verified} links`);

      return {
        message: `Bulk verification complete: ${result.verified} verified, ${result.failed} failed`,
        ...result,
      };
    });
  };

  /**
   * Bulk create and verify member links (admin action)
   * POST /api/v2/rsi/sync/bulk-assign/:orgId
   */
  public bulkAssign = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(
      req,
      res,
      async () => {
        const { orgId } = req.params;
        this.verifyOrgAccess(req, orgId);

        const { entries } = req.body as {
          entries: { userId: string; rsiHandle: string; discordUserId?: string }[];
        };
        const adminId = this.getAuthUser(req).id;

        if (!Array.isArray(entries) || entries.length === 0) {
          throw new ValidationError('entries array is required and must not be empty');
        }
        if (entries.length > 100) {
          throw new ValidationError('Maximum 100 entries per bulk operation');
        }

        for (const entry of entries) {
          if (!entry.userId || !entry.rsiHandle) {
            throw new ValidationError('Each entry must have userId and rsiHandle');
          }
        }

        const result = await rsiUserLinkService.bulkCreateAndVerify(orgId, entries);

        logger.info(`Admin ${adminId} bulk assigned ${result.created} members in org ${orgId}`);

        return {
          message: `Bulk assign complete: ${result.created} created, ${result.skipped} skipped, ${result.failed} failed`,
          ...result,
        };
      },
      201
    );
  };

  // ==================== REVIEW QUEUE ENDPOINTS ====================

  /**
   * Get review queue for an organization
   * GET /api/v2/rsi/sync/review/:orgId
   */
  public getReviewQueue = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 50, 100);
      const offset = Math.max(Number.parseInt(req.query.offset as string, 10) || 0, 0);

      const { items, total } = await rsiSyncReviewService.getReviewQueue(orgId, {
        limit,
        offset,
      });

      return { items, total };
    });
  };

  /**
   * Resolve a review queue item
   * POST /api/v2/rsi/sync/review/:orgId/resolve
   */
  public resolveReviewItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const { linkId, resolution, adminNotes, updatedRank } = req.body as {
        linkId: string;
        resolution: string;
        adminNotes?: string;
        updatedRank?: string;
      };
      const adminId = this.getAuthUser(req).id;

      if (!linkId || !resolution) {
        throw new ValidationError('linkId and resolution are required');
      }

      const validResolutions = Object.values(ReviewResolution);
      if (!validResolutions.includes(resolution as ReviewResolution)) {
        throw new ValidationError(`resolution must be one of: ${validResolutions.join(', ')}`);
      }

      const result = await rsiSyncReviewService.resolveReviewItem(
        { linkId, resolution: resolution as ReviewResolution, adminNotes, updatedRank },
        adminId
      );

      if (!result) {
        throw new NotFoundError('Link not found');
      }

      return {
        message: `Review item resolved as ${resolution}`,
        link: {
          id: result.id,
          syncStatus: result.syncStatus,
          rsiHandle: result.rsiHandle,
        },
      };
    });
  };

  /**
   * Get review statistics for an organization
   * GET /api/v2/rsi/sync/review/:orgId/stats
   */
  public getReviewStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const stats = await rsiSyncReviewService.getReviewStats(orgId);
      return { stats };
    });
  };

  /**
   * Manually flag a link for review (admin action)
   * POST /api/v2/rsi/sync/review/:orgId/flag
   */
  public flagForReview = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { orgId } = req.params;
      this.verifyOrgAccess(req, orgId);

      const { linkId, reason } = req.body as { linkId: string; reason: string };

      if (!linkId || !reason) {
        throw new ValidationError('linkId and reason are required');
      }

      const result = await rsiSyncReviewService.flagForReview(linkId, reason);

      if (!result) {
        throw new NotFoundError('Link not found');
      }

      return {
        message: 'Link flagged for review',
        link: {
          id: result.id,
          syncStatus: result.syncStatus,
          rsiHandle: result.rsiHandle,
        },
      };
    });
  };

  // ==================== PRIVATE HELPERS ====================

  /** Defense-in-depth: verify user belongs to the requested organization */
  private verifyOrgAccess(req: AuthRequest, orgId: string): void {
    if (req.orgMembership?.organizationId !== orgId) {
      logger.warn('Unauthorized org access attempt', {
        userId: req.user?.id,
        requestedOrgId: orgId,
      });
      throw new ForbiddenError('You are not authorized to access this organization');
    }
  }
}
