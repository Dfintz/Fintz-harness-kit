import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { MirrorAction, MirrorActionType, MirrorActionStatus } from '../../models/MirrorAction';
import {
  ModerationIncident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType as _IncidentType,
} from '../../models/ModerationIncident';
import { logAuditEvent, AuditEventType } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { emitToOrganization } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';

import {
  BlacklistSharingService,
  SharedIncident as _SharedIncident,
} from './BlacklistSharingService';

/**
 * Audit event types for mirror actions
 */
export enum MirrorAuditAction {
  MIRROR_INITIATED = 'MIRROR_ACTION_INITIATED',
  MIRROR_CONFIRMED = 'MIRROR_ACTION_CONFIRMED',
  MIRROR_CANCELLED = 'MIRROR_ACTION_CANCELLED',
  MIRROR_EXECUTED = 'MIRROR_ACTION_EXECUTED',
  MIRROR_FAILED = 'MIRROR_ACTION_FAILED',
  BULK_MIRROR_INITIATED = 'BULK_MIRROR_INITIATED',
  BULK_MIRROR_COMPLETED = 'BULK_MIRROR_COMPLETED',
}

/**
 * DTO for creating a mirror action
 */
export interface CreateMirrorActionDTO {
  sourceIncidentId: string;
  sourceOrganizationId: string;
  sourceGuildId?: string;
  sourceGuildName?: string;
  targetDiscordId: string;
  targetUsername?: string;
  targetGuildId: string;
  targetGuildName?: string;
  actionType: MirrorActionType;
  severity: IncidentSeverity;
  reason?: string;
  originalReason?: string;
  durationMinutes?: number;
  moderatorId: string;
  moderatorDiscordId?: string;
  moderatorUsername?: string;
  isBulkMirror?: boolean;
  bulkMirrorId?: string;
}

/**
 * Result of a mirror action
 */
export interface MirrorResult {
  success: boolean;
  action: MirrorAction;
  message: string;
  requiresConfirmation: boolean;
}

/**
 * Summary for bulk mirror operations
 */
export interface BulkMirrorSummary {
  bulkMirrorId: string;
  targetDiscordId: string;
  targetUsername?: string;
  totalIncidents: number;
  mirroredCount: number;
  pendingConfirmation: number;
  failedCount: number;
  actions: MirrorAction[];
}

/**
 * MirrorActionService
 *
 * Manages mirror action operations for Phase 3 of Cross-Discord Blacklist System.
 * Allows moderators to mirror moderation actions from allied servers to their own server.
 *
 * Features:
 * - One-click mirror action for individual incidents
 * - Bulk mirror for users with multiple incidents
 * - Confirmation step required for ban actions
 * - Comprehensive audit logging
 * - WebSocket notifications
 */
export class MirrorActionService extends TenantService<MirrorAction> {
  private static instance: MirrorActionService | null = null;
  private incidentRepository = AppDataSource.getRepository(ModerationIncident);
  private sharingService: BlacklistSharingService;

  constructor() {
    super(AppDataSource.getRepository(MirrorAction), {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      cacheCheckPeriod: 60,
    });
    this.sharingService = BlacklistSharingService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MirrorActionService {
    if (!MirrorActionService.instance) {
      MirrorActionService.instance = new MirrorActionService();
    }
    return MirrorActionService.instance;
  }

  // ==================== MIRROR ACTION CREATION ====================

  /**
   * Create a mirror action for a single incident
   * @param organizationId - Organization creating the mirror action
   * @param dto - Mirror action data
   * @returns Mirror result with action and status
   */
  async createMirrorAction(
    organizationId: string,
    dto: CreateMirrorActionDTO
  ): Promise<MirrorResult> {
    // Check if already mirrored
    const existing = await this.findExistingMirror(
      organizationId,
      dto.sourceIncidentId,
      dto.targetGuildId
    );

    if (existing) {
      return {
        success: false,
        action: existing,
        message: 'This incident has already been mirrored to your server.',
        requiresConfirmation: false,
      };
    }

    // Determine if confirmation is required (bans require confirmation)
    const requiresConfirmation = dto.actionType === MirrorActionType.BAN;

    // Create the mirror action
    const mirrorAction = await this.create(organizationId, {
      sourceIncidentId: dto.sourceIncidentId,
      sourceOrganizationId: dto.sourceOrganizationId,
      sourceGuildId: dto.sourceGuildId,
      sourceGuildName: dto.sourceGuildName,
      targetDiscordId: dto.targetDiscordId,
      targetUsername: dto.targetUsername,
      targetGuildId: dto.targetGuildId,
      targetGuildName: dto.targetGuildName,
      actionType: dto.actionType,
      severity: dto.severity,
      status: MirrorActionStatus.PENDING,
      reason: dto.reason || dto.originalReason,
      originalReason: dto.originalReason,
      durationMinutes: dto.durationMinutes,
      moderatorId: dto.moderatorId,
      moderatorDiscordId: dto.moderatorDiscordId,
      moderatorUsername: dto.moderatorUsername,
      confirmationRequired: requiresConfirmation,
      isBulkMirror: dto.isBulkMirror || false,
      bulkMirrorId: dto.bulkMirrorId,
      metadata: {
        sourceIncidentType: dto.actionType,
        originalSeverity: dto.severity,
        createdFromAlliedIncident: true,
      },
    });

    // Log audit event
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: dto.moderatorId,
      username: dto.moderatorUsername || 'Unknown',
      resource: `mirror_action/${mirrorAction.id}`,
      action: MirrorAuditAction.MIRROR_INITIATED,
      message: `Mirror action initiated for ${dto.targetDiscordId} (${dto.actionType})`,
      metadata: {
        mirrorActionId: mirrorAction.id,
        sourceIncidentId: dto.sourceIncidentId,
        targetGuildId: dto.targetGuildId,
        actionType: dto.actionType,
        severity: dto.severity,
        requiresConfirmation,
      },
    });

    logger.info(`Mirror action created: ${mirrorAction.id} for ${dto.targetDiscordId}`, {
      organizationId,
      sourceIncidentId: dto.sourceIncidentId,
      actionType: dto.actionType,
      requiresConfirmation,
    });

    // Emit WebSocket notification
    emitToOrganization(organizationId, 'blacklist:mirror', {
      type: 'MIRROR_ACTION_CREATED',
      data: {
        mirrorActionId: mirrorAction.id,
        targetDiscordId: dto.targetDiscordId,
        targetUsername: dto.targetUsername,
        actionType: dto.actionType,
        requiresConfirmation,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      action: mirrorAction,
      message: requiresConfirmation
        ? 'Mirror action created. Confirmation required for ban actions.'
        : 'Mirror action created successfully.',
      requiresConfirmation,
    };
  }

  /**
   * Create mirror actions for all incidents of a user (bulk mirror)
   * @param organizationId - Organization performing the bulk mirror
   * @param targetDiscordId - Discord ID of the user to bulk mirror
   * @param targetGuildId - Guild where the action is being applied
   * @param targetGuildName - Name of the target guild
   * @param moderatorId - Platform user ID of the moderator
   * @param moderatorDiscordId - Discord ID of the moderator
   * @param moderatorUsername - Username of the moderator
   * @returns Summary of the bulk mirror operation
   */
  async createBulkMirror(
    organizationId: string,
    targetDiscordId: string,
    targetGuildId: string,
    targetGuildName: string | undefined,
    moderatorId: string,
    moderatorDiscordId: string | undefined,
    moderatorUsername: string | undefined
  ): Promise<BulkMirrorSummary> {
    const bulkMirrorId = uuidv4();
    const actions: MirrorAction[] = [];
    let mirroredCount = 0;
    let pendingConfirmation = 0;
    let failedCount = 0;

    // Get all allied incidents for this user
    const checkResult = await this.sharingService.checkUserAcrossAllies(
      organizationId,
      targetDiscordId
    );

    // Get target username from the first incident
    const targetUsername =
      checkResult.alliedIncidents[0]?.incident?.targetUsername ||
      checkResult.ownIncidents[0]?.targetUsername;

    // Log bulk mirror initiation
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: moderatorId,
      username: moderatorUsername || 'Unknown',
      resource: `bulk_mirror/${bulkMirrorId}`,
      action: MirrorAuditAction.BULK_MIRROR_INITIATED,
      message: `Bulk mirror initiated for ${targetDiscordId} with ${checkResult.alliedIncidents.length} allied incidents`,
      metadata: {
        bulkMirrorId,
        targetDiscordId,
        alliedIncidentCount: checkResult.alliedIncidents.length,
        targetGuildId,
      },
    });

    // Mirror each allied incident
    for (const sharedIncident of checkResult.alliedIncidents) {
      const incident = sharedIncident.incident;

      // Skip non-active incidents
      if (incident.status !== IncidentStatus.ACTIVE) {
        continue;
      }

      try {
        const result = await this.createMirrorAction(organizationId, {
          sourceIncidentId: incident.id,
          sourceOrganizationId: sharedIncident.sourceOrganizationId,
          sourceGuildId: incident.guildId,
          sourceGuildName: incident.guildName,
          targetDiscordId: incident.targetDiscordId,
          targetUsername: incident.targetUsername,
          targetGuildId,
          targetGuildName,
          actionType: MirrorAction.actionTypeFromIncidentType(incident.incidentType),
          severity: incident.severity,
          reason: incident.reason,
          originalReason: incident.reason,
          durationMinutes: incident.durationMinutes,
          moderatorId,
          moderatorDiscordId,
          moderatorUsername,
          isBulkMirror: true,
          bulkMirrorId,
        });

        if (result.success) {
          actions.push(result.action);
          if (result.requiresConfirmation) {
            pendingConfirmation++;
          } else {
            mirroredCount++;
          }
        } else {
          failedCount++;
        }
      } catch (error: unknown) {
        logger.error(`Failed to create mirror action for incident ${incident.id}:`, error);
        failedCount++;
      }
    }

    // Log bulk mirror completion
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: moderatorId,
      username: moderatorUsername || 'Unknown',
      resource: `bulk_mirror/${bulkMirrorId}`,
      action: MirrorAuditAction.BULK_MIRROR_COMPLETED,
      message: `Bulk mirror completed for ${targetDiscordId}: ${mirroredCount} mirrored, ${pendingConfirmation} pending, ${failedCount} failed`,
      metadata: {
        bulkMirrorId,
        targetDiscordId,
        mirroredCount,
        pendingConfirmation,
        failedCount,
      },
    });

    logger.info(`Bulk mirror completed: ${bulkMirrorId}`, {
      targetDiscordId,
      mirroredCount,
      pendingConfirmation,
      failedCount,
    });

    // Emit WebSocket notification
    emitToOrganization(organizationId, 'blacklist:bulk-mirror', {
      type: 'BULK_MIRROR_COMPLETED',
      data: {
        bulkMirrorId,
        targetDiscordId,
        targetUsername,
        totalIncidents: checkResult.alliedIncidents.length,
        mirroredCount,
        pendingConfirmation,
        failedCount,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      bulkMirrorId,
      targetDiscordId,
      targetUsername,
      totalIncidents: checkResult.alliedIncidents.length,
      mirroredCount,
      pendingConfirmation,
      failedCount,
      actions,
    };
  }

  // ==================== CONFIRMATION HANDLING ====================

  /**
   * Confirm a pending mirror action (required for bans)
   * @param organizationId - Organization confirming the action
   * @param mirrorActionId - ID of the mirror action to confirm
   * @param userId - User ID confirming the action
   * @param userName - Username confirming the action
   * @returns Updated mirror action
   */
  async confirmMirrorAction(
    organizationId: string,
    mirrorActionId: string,
    userId: string,
    userName: string
  ): Promise<MirrorAction | null> {
    const action = await this.findById(organizationId, mirrorActionId);

    if (!action) {
      throw new Error('Mirror action not found');
    }

    if (!action.confirmationRequired) {
      throw new Error('This action does not require confirmation');
    }

    if (action.status !== MirrorActionStatus.PENDING) {
      throw new Error('Only pending actions can be confirmed');
    }

    // Update the action to confirmed status
    const updated = await this.update(organizationId, mirrorActionId, {
      status: MirrorActionStatus.CONFIRMED,
      confirmedAt: new Date(),
    });

    if (updated) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        username: userName,
        resource: `mirror_action/${mirrorActionId}`,
        action: MirrorAuditAction.MIRROR_CONFIRMED,
        message: `Mirror action confirmed for ${action.targetDiscordId}`,
        metadata: {
          mirrorActionId,
          actionType: action.actionType,
          targetDiscordId: action.targetDiscordId,
        },
      });

      logger.info(`Mirror action confirmed: ${mirrorActionId} by ${userName}`);
    }

    return updated;
  }

  /**
   * Cancel a pending mirror action
   * @param organizationId - Organization cancelling the action
   * @param mirrorActionId - ID of the mirror action to cancel
   * @param userId - User ID cancelling the action
   * @param userName - Username cancelling the action
   * @returns Updated mirror action
   */
  async cancelMirrorAction(
    organizationId: string,
    mirrorActionId: string,
    userId: string,
    userName: string
  ): Promise<MirrorAction | null> {
    const action = await this.findById(organizationId, mirrorActionId);

    if (!action) {
      throw new Error('Mirror action not found');
    }

    if (action.status !== MirrorActionStatus.PENDING) {
      throw new Error('Only pending actions can be cancelled');
    }

    // Update the action to cancelled status
    const updated = await this.update(organizationId, mirrorActionId, {
      status: MirrorActionStatus.CANCELLED,
    });

    if (updated) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        userId,
        username: userName,
        resource: `mirror_action/${mirrorActionId}`,
        action: MirrorAuditAction.MIRROR_CANCELLED,
        message: `Mirror action cancelled for ${action.targetDiscordId}`,
        metadata: {
          mirrorActionId,
          actionType: action.actionType,
          targetDiscordId: action.targetDiscordId,
        },
      });

      logger.info(`Mirror action cancelled: ${mirrorActionId} by ${userName}`);
    }

    return updated;
  }

  /**
   * Mark a mirror action as executed
   * @param organizationId - Organization
   * @param mirrorActionId - ID of the mirror action
   * @returns Updated mirror action
   */
  async markAsExecuted(
    organizationId: string,
    mirrorActionId: string
  ): Promise<MirrorAction | null> {
    const action = await this.findById(organizationId, mirrorActionId);

    if (!action) {
      throw new Error('Mirror action not found');
    }

    // For non-ban actions, can be executed directly from pending
    // For ban actions, must be confirmed first
    if (action.confirmationRequired && action.status !== MirrorActionStatus.CONFIRMED) {
      throw new Error('Ban actions must be confirmed before execution');
    }

    const updated = await this.update(organizationId, mirrorActionId, {
      status: MirrorActionStatus.CONFIRMED,
      executedAt: new Date(),
    });

    if (updated) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        resource: `mirror_action/${mirrorActionId}`,
        action: MirrorAuditAction.MIRROR_EXECUTED,
        message: `Mirror action executed for ${action.targetDiscordId}`,
        metadata: {
          mirrorActionId,
          actionType: action.actionType,
          targetDiscordId: action.targetDiscordId,
        },
      });

      logger.info(`Mirror action executed: ${mirrorActionId}`);
    }

    return updated;
  }

  /**
   * Mark a mirror action as failed
   * @param organizationId - Organization
   * @param mirrorActionId - ID of the mirror action
   * @param errorMessage - Error message describing the failure
   * @returns Updated mirror action
   */
  async markAsFailed(
    organizationId: string,
    mirrorActionId: string,
    errorMessage: string
  ): Promise<MirrorAction | null> {
    const action = await this.findById(organizationId, mirrorActionId);

    if (!action) {
      throw new Error('Mirror action not found');
    }

    const updated = await this.update(organizationId, mirrorActionId, {
      status: MirrorActionStatus.FAILED,
      errorMessage,
    });

    if (updated) {
      logAuditEvent({
        eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
        resource: `mirror_action/${mirrorActionId}`,
        action: MirrorAuditAction.MIRROR_FAILED,
        message: `Mirror action failed for ${action.targetDiscordId}: ${errorMessage}`,
        metadata: {
          mirrorActionId,
          actionType: action.actionType,
          targetDiscordId: action.targetDiscordId,
          errorMessage,
        },
      });

      logger.warn(`Mirror action failed: ${mirrorActionId}`, { errorMessage });
    }

    return updated;
  }

  // ==================== QUERY METHODS ====================

  /**
   * Find existing mirror for a source incident and target guild
   * Checks for any non-cancelled and non-failed mirrors to prevent duplicates
   */
  private async findExistingMirror(
    organizationId: string,
    sourceIncidentId: string,
    targetGuildId: string
  ): Promise<MirrorAction | null> {
    // Check for any existing mirror that is pending or confirmed (not cancelled/failed)
    const existing = await this.repository.findOne({
      where: [
        {
          organizationId,
          sourceIncidentId,
          targetGuildId,
          status: MirrorActionStatus.PENDING,
        },
        {
          organizationId,
          sourceIncidentId,
          targetGuildId,
          status: MirrorActionStatus.CONFIRMED,
        },
      ],
    });

    return existing || null;
  }

  /**
   * Get mirror action by ID
   */
  async getMirrorAction(
    organizationId: string,
    mirrorActionId: string
  ): Promise<MirrorAction | null> {
    return this.findById(organizationId, mirrorActionId);
  }

  /**
   * Get pending mirror actions for organization
   */
  async getPendingMirrorActions(
    organizationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ actions: MirrorAction[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository.createQueryBuilder('mirror');
    queryBuilder.where('mirror.organizationId = :organizationId', { organizationId });
    queryBuilder.andWhere('mirror.status = :status', { status: MirrorActionStatus.PENDING });
    queryBuilder.andWhere('mirror.deletedAt IS NULL');
    queryBuilder.orderBy('mirror.createdAt', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const actions = await queryBuilder.getMany();

    return {
      actions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get mirror action history for organization
   */
  async getMirrorActionHistory(
    organizationId: string,
    options?: {
      targetDiscordId?: string;
      status?: MirrorActionStatus;
      actionType?: MirrorActionType;
      page?: number;
      limit?: number;
    }
  ): Promise<{ actions: MirrorAction[]; total: number; page: number; totalPages: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository.createQueryBuilder('mirror');
    queryBuilder.where('mirror.organizationId = :organizationId', { organizationId });
    queryBuilder.andWhere('mirror.deletedAt IS NULL');

    if (options?.targetDiscordId) {
      queryBuilder.andWhere('mirror.targetDiscordId = :targetDiscordId', {
        targetDiscordId: options.targetDiscordId,
      });
    }

    if (options?.status) {
      queryBuilder.andWhere('mirror.status = :status', { status: options.status });
    }

    if (options?.actionType) {
      queryBuilder.andWhere('mirror.actionType = :actionType', { actionType: options.actionType });
    }

    queryBuilder.orderBy('mirror.createdAt', 'DESC');

    const total = await queryBuilder.getCount();
    queryBuilder.skip(skip).take(limit);
    const actions = await queryBuilder.getMany();

    return {
      actions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get mirror statistics for organization
   */
  async getMirrorStatistics(organizationId: string): Promise<{
    totalMirrors: number;
    confirmedMirrors: number;
    pendingMirrors: number;
    cancelledMirrors: number;
    failedMirrors: number;
    byActionType: Record<MirrorActionType, number>;
  }> {
    const actions = await this.findAll(organizationId);

    const stats = {
      totalMirrors: actions.length,
      confirmedMirrors: 0,
      pendingMirrors: 0,
      cancelledMirrors: 0,
      failedMirrors: 0,
      byActionType: {
        [MirrorActionType.WARNING]: 0,
        [MirrorActionType.TIMEOUT]: 0,
        [MirrorActionType.KICK]: 0,
        [MirrorActionType.BAN]: 0,
      },
    };

    for (const action of actions) {
      switch (action.status) {
        case MirrorActionStatus.CONFIRMED:
          stats.confirmedMirrors++;
          break;
        case MirrorActionStatus.PENDING:
          stats.pendingMirrors++;
          break;
        case MirrorActionStatus.CANCELLED:
          stats.cancelledMirrors++;
          break;
        case MirrorActionStatus.FAILED:
          stats.failedMirrors++;
          break;
      }
      stats.byActionType[action.actionType]++;
    }

    return stats;
  }
}

