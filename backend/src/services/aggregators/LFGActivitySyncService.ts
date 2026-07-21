import {
  ActivityParticipant,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ParticipantRole,
} from '../../models/Activity';
import { logger } from '../../utils/logger';
import { ActivityParticipantService } from '../activity/ActivityParticipantService';
import { ActivityService, CreateActivityDTO } from '../activity/ActivityService';
import { LFGSession, LFGSessionService, LFGSessionStatus } from '../social/LFGSessionService';

/**
 * Result of syncing an LFG session to a persistent Activity
 */
export interface LFGSyncResult {
  success: boolean;
  activityId?: string;
  sessionId: string;
  participantsSynced: number;
  statusMapped: ActivityStatus | null;
  errors: string[];
}

/**
 * Options for controlling sync behavior
 */
export interface LFGSyncOptions {
  /** Whether to sync participants into the created activity */
  syncParticipants?: boolean;
  /** Creator display name (falls back to hostUserId) */
  creatorName?: string;
  /** Organization display name */
  organizationName?: string;
}

/**
 * Maps LFGSessionStatus to ActivityStatus
 */
const LFG_TO_ACTIVITY_STATUS: Record<LFGSessionStatus, ActivityStatus> = {
  [LFGSessionStatus.OPEN]: ActivityStatus.RECRUITING,
  [LFGSessionStatus.FULL]: ActivityStatus.READY,
  [LFGSessionStatus.IN_PROGRESS]: ActivityStatus.IN_PROGRESS,
  [LFGSessionStatus.COMPLETED]: ActivityStatus.COMPLETED,
  [LFGSessionStatus.CANCELLED]: ActivityStatus.CANCELLED,
};

/**
 * LFG-Activity Sync Service
 *
 * Bridges Redis-based LFG sessions with persistent PostgreSQL Activities.
 * Handles:
 * - Creating an Activity from an LFG session
 * - Mapping LFG participants (string[]) to ActivityParticipant objects
 * - Mapping LFGSessionStatus to ActivityStatus
 * - Bidirectional metadata linking between LFG session and Activity
 */
export class LFGActivitySyncService {
  private readonly activityService: ActivityService;
  private readonly participantService: ActivityParticipantService;
  private readonly lfgSessionService: LFGSessionService;

  constructor(
    activityService?: ActivityService,
    participantService?: ActivityParticipantService,
    lfgSessionService?: LFGSessionService
  ) {
    this.activityService = activityService ?? new ActivityService();
    this.participantService = participantService ?? new ActivityParticipantService();
    this.lfgSessionService = lfgSessionService ?? new LFGSessionService();
  }

  /**
   * Create a persistent Activity from an LFG session.
   * The host becomes the LEADER; other players become MEMBERs.
   * Metadata is linked bidirectionally.
   */
  async syncLFGToActivity(sessionId: string, options: LFGSyncOptions = {}): Promise<LFGSyncResult> {
    const result: LFGSyncResult = {
      success: false,
      sessionId,
      participantsSynced: 0,
      statusMapped: null,
      errors: [],
    };

    try {
      // 1. Fetch the LFG session from Redis
      const session = await this.lfgSessionService.getSession(sessionId);
      if (!session) {
        result.errors.push('LFG session not found');
        return result;
      }

      // 2. Map status
      result.statusMapped = this.mapStatus(session.status);

      // 3. Build DTO and create the activity
      const dto = this.buildCreateDto(session, options);
      const activity = await this.activityService.createActivity(session.organizationId, dto);

      result.activityId = activity.id;
      result.participantsSynced = 1; // creator is auto-added

      // 4. Sync additional participants if requested
      if (options.syncParticipants !== false) {
        await this.syncParticipantsToActivity(session, activity.id, result);
      }

      // 5. If the LFG session is already past OPEN, transition the activity status
      if (session.status !== LFGSessionStatus.OPEN && result.statusMapped) {
        await this.tryUpdateActivityStatus(
          activity.id,
          result.statusMapped,
          session.hostUserId,
          sessionId,
          result
        );
      }

      result.success = true;
      logger.info('LFG session synced to activity', {
        sessionId,
        activityId: activity.id,
        participantsSynced: result.participantsSynced,
        status: result.statusMapped,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(msg);
      logger.error('Failed to sync LFG session to activity', {
        sessionId,
        error: msg,
      });
    }

    return result;
  }

  /**
   * Build CreateActivityDTO from an LFG session.
   */
  private buildCreateDto(session: LFGSession, options: LFGSyncOptions): CreateActivityDTO {
    return {
      title: session.title,
      description: session.description ?? `LFG session: ${session.title}`,
      activityType: ActivityType.LFG,
      creatorId: session.hostUserId,
      creatorName: options.creatorName ?? session.hostUserId,
      organizationId: session.organizationId,
      organizationName: options.organizationName,
      visibility: ActivityVisibility.ORGANIZATION,
      scheduledStartDate: session.scheduledAt,
      maxParticipants: session.maxPlayers,
      minParticipants: session.minPlayers,
      tags: session.tags,
      metadata: {
        linkedLfgSessionId: session.id,
        lfgActivityType: session.activityType,
        syncedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Sync non-host participants from LFG session to activity.
   * Errors are collected without failing the overall sync.
   */
  private async syncParticipantsToActivity(
    session: LFGSession,
    activityId: string,
    result: LFGSyncResult
  ): Promise<void> {
    const otherPlayers = session.currentPlayers.filter(uid => uid !== session.hostUserId);

    for (const userId of otherPlayers) {
      try {
        await this.participantService.joinActivity(activityId, {
          userId,
          userName: userId,
          organizationId: session.organizationId,
          role: ParticipantRole.MEMBER,
        });
        result.participantsSynced++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to sync participant ${userId}: ${msg}`);
        logger.warn('Failed to sync LFG participant to activity', {
          sessionId: session.id,
          activityId,
          userId,
          error: msg,
        });
      }
    }
  }

  /**
   * Attempt to update activity status; collect error without failing sync.
   */
  private async tryUpdateActivityStatus(
    activityId: string,
    status: ActivityStatus,
    hostUserId: string,
    sessionId: string,
    result: LFGSyncResult
  ): Promise<void> {
    try {
      await this.activityService.updateStatus(activityId, status, hostUserId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Failed to update activity status: ${msg}`);
      logger.warn('Failed to sync activity status', {
        sessionId,
        activityId,
        targetStatus: status,
        error: msg,
      });
    }
  }

  /**
   * Map LFGSessionStatus to ActivityStatus.
   */
  mapStatus(lfgStatus: LFGSessionStatus): ActivityStatus {
    return LFG_TO_ACTIVITY_STATUS[lfgStatus];
  }

  /**
   * Build ActivityParticipant objects from an LFG session's player list.
   * The host gets LEADER role; everyone else gets MEMBER.
   */
  mapParticipants(session: LFGSession): ActivityParticipant[] {
    return session.currentPlayers.map(userId => ({
      userId,
      userName: userId,
      organizationId: session.organizationId,
      role: userId === session.hostUserId ? ParticipantRole.LEADER : ParticipantRole.MEMBER,
      status: 'accepted' as const,
      joinedAt: session.createdAt,
      metadata: {
        linkedLfgSessionId: session.id,
      },
    }));
  }

  /**
   * Sync LFG session status change to a linked Activity.
   * Finds the activity via metadata and updates its status.
   */
  async syncStatusToActivity(
    sessionId: string,
    newLfgStatus: LFGSessionStatus,
    hostUserId: string,
    activityId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const activityStatus = this.mapStatus(newLfgStatus);
      await this.activityService.updateStatus(activityId, activityStatus, hostUserId);

      logger.info('LFG status synced to activity', {
        sessionId,
        activityId,
        lfgStatus: newLfgStatus,
        activityStatus,
      });

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to sync LFG status to activity', {
        sessionId,
        activityId,
        error: msg,
      });
      return { success: false, error: msg };
    }
  }
}

