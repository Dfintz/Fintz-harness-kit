import { randomUUID } from 'node:crypto';

import { AuditEventType, logAuditEvent } from '../../../utils/auditLogger';
import { logger } from '../../../utils/logger';
import { getIO } from '../../../websocket/websocketServer';

import { PermissionCacheService } from './PermissionCacheService';
import { PermissionManagerService } from './PermissionManagerService';

export type PermissionChangeType =
  | 'permission_added'
  | 'permission_removed'
  | 'role_updated'
  | 'role_assigned'
  | 'role_revoked'
  | 'roles_reordered'
  | 'role_deleted';

type EmissionMode = 'per_user' | 'org_fallback';

interface ChangeProcessingContext {
  orgId: string;
  actorUserId: string;
  changeType: PermissionChangeType;
  affectedUserIds: string[];
}

export interface PermissionChangeProcessingMetrics {
  invalidatedCount: number;
  emittedCount: number;
  failedEmitCount: number;
  emissionMode: EmissionMode;
}

interface SessionRefreshEventPayload {
  orgId: string;
  changeType: PermissionChangeType;
  eventId: string;
  eventTimestamp: number;
  refreshVersion: number;
  emissionMode: EmissionMode;
}

interface EmissionDecision {
  mode: EmissionMode;
  fallbackReason?: 'unknown_affected_set' | 'threshold_exceeded';
}

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_ORG_FALLBACK_THRESHOLD = 400;

export class PermissionChangeEventService {
  private static instance: PermissionChangeEventService;

  private readonly permissionManager = new PermissionManagerService();
  private readonly permissionCacheService = PermissionCacheService.getInstance();
  private readonly refreshVersionByOrg = new Map<string, number>();
  private readonly batchSize: number;
  private readonly orgFallbackThreshold: number;

  private constructor() {
    this.batchSize = this.resolvePositiveNumber(
      process.env.PERMISSION_REFRESH_BATCH_SIZE,
      DEFAULT_BATCH_SIZE
    );
    this.orgFallbackThreshold = this.resolvePositiveNumber(
      process.env.PERMISSION_REFRESH_ORG_FALLBACK_THRESHOLD,
      DEFAULT_ORG_FALLBACK_THRESHOLD
    );
  }

  static getInstance(): PermissionChangeEventService {
    if (!PermissionChangeEventService.instance) {
      PermissionChangeEventService.instance = new PermissionChangeEventService();
    }
    return PermissionChangeEventService.instance;
  }

  async onRolePermissionChanged(
    orgId: string,
    affectedUserIds: string[],
    changeType: PermissionChangeType,
    actorUserId: string
  ): Promise<PermissionChangeProcessingMetrics> {
    return this.processChange({ orgId, actorUserId, changeType, affectedUserIds });
  }

  async onUserRoleChanged(
    orgId: string,
    userId: string,
    changeType: PermissionChangeType,
    actorUserId: string
  ): Promise<PermissionChangeProcessingMetrics> {
    return this.processChange({ orgId, actorUserId, changeType, affectedUserIds: [userId] });
  }

  private async processChange(
    context: ChangeProcessingContext
  ): Promise<PermissionChangeProcessingMetrics> {
    const startedAt = Date.now();
    const affectedUserIds = this.normalizeUserIds(context.affectedUserIds);
    const decision = this.decideEmissionMode(affectedUserIds);
    const emissionMode = decision.mode;

    let invalidatedCount = 0;
    invalidatedCount = this.invalidatePermissionCaches(
      context.orgId,
      emissionMode,
      affectedUserIds
    );

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: context.actorUserId,
      resource: 'permissions',
      action: 'invalidate',
      message: `Permission invalidation processed for org ${context.orgId}`,
      metadata: {
        orgId: context.orgId,
        actorUserId: context.actorUserId,
        changeType: context.changeType,
        affectedUserCount: affectedUserIds.length,
        emissionMode,
        timestamp: new Date().toISOString(),
      },
    });

    const payload: SessionRefreshEventPayload = {
      orgId: context.orgId,
      changeType: context.changeType,
      eventId: randomUUID(),
      eventTimestamp: Date.now(),
      refreshVersion: this.nextRefreshVersion(context.orgId),
      emissionMode,
    };

    const { emittedCount, failedEmitCount } = this.emitSessionRefresh(
      context.orgId,
      context.changeType,
      emissionMode,
      affectedUserIds,
      payload
    );

    logger.info('Permission change emission telemetry', {
      orgId: context.orgId,
      changeType: context.changeType,
      affectedCount: affectedUserIds.length,
      emissionMode,
      emittedCount,
      failedEmitCount,
      durationMs: Date.now() - startedAt,
      fallbackReason: decision.fallbackReason,
    });

    return {
      invalidatedCount,
      emittedCount,
      failedEmitCount,
      emissionMode,
    };
  }

  private decideEmissionMode(affectedUserIds: string[]): EmissionDecision {
    if (affectedUserIds.length === 0) {
      return { mode: 'org_fallback', fallbackReason: 'unknown_affected_set' };
    }

    if (affectedUserIds.length > this.orgFallbackThreshold) {
      return { mode: 'org_fallback', fallbackReason: 'threshold_exceeded' };
    }

    return { mode: 'per_user' };
  }

  private invalidatePermissionCaches(
    orgId: string,
    emissionMode: EmissionMode,
    affectedUserIds: string[]
  ): number {
    if (emissionMode === 'org_fallback') {
      this.permissionManager.clearOrganizationPermissionCache(orgId);
      this.permissionCacheService.invalidateOrganization(orgId);
      return affectedUserIds.length;
    }

    let invalidatedCount = 0;
    for (const chunk of this.toChunks(affectedUserIds, this.batchSize)) {
      for (const userId of chunk) {
        this.permissionManager.invalidateUserPermissionCacheForUser(orgId, userId);
        this.permissionCacheService.invalidate(userId, orgId);
        invalidatedCount += 1;
      }
    }

    return invalidatedCount;
  }

  private emitSessionRefresh(
    orgId: string,
    changeType: PermissionChangeType,
    emissionMode: EmissionMode,
    affectedUserIds: string[],
    payload: SessionRefreshEventPayload
  ): { emittedCount: number; failedEmitCount: number } {
    let emittedCount = 0;
    let failedEmitCount = 0;

    try {
      const io = getIO();
      if (emissionMode === 'org_fallback') {
        io.to(`org:${orgId}`).emit('session:refresh', payload);
        emittedCount = 1;
      } else {
        for (const chunk of this.toChunks(affectedUserIds, this.batchSize)) {
          for (const userId of chunk) {
            io.to(`user:${userId}`).emit('session:refresh', payload);
            emittedCount += 1;
          }
        }
      }
    } catch (error: unknown) {
      failedEmitCount = emissionMode === 'org_fallback' ? 1 : affectedUserIds.length;
      logger.warn('Failed to emit session refresh event', {
        orgId,
        changeType,
        emissionMode,
        failedEmitCount,
        error,
      });
    }

    return { emittedCount, failedEmitCount };
  }

  private normalizeUserIds(userIds: string[]): string[] {
    return Array.from(
      new Set(
        userIds.filter(
          (userId): userId is string => typeof userId === 'string' && userId.length > 0
        )
      )
    );
  }

  private toChunks<T>(items: T[], chunkSize: number): T[][] {
    if (items.length === 0) {
      return [];
    }

    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    return chunks;
  }

  private nextRefreshVersion(orgId: string): number {
    const nextVersion = (this.refreshVersionByOrg.get(orgId) ?? 0) + 1;
    this.refreshVersionByOrg.set(orgId, nextVersion);
    return nextVersion;
  }

  private resolvePositiveNumber(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

export const permissionChangeEventService = PermissionChangeEventService.getInstance();

