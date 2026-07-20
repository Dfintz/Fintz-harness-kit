/**
 * RSI Sync Dashboard Service
 *
 * Provides API calls for the RSI sync status dashboard.
 * Uses existing backend audit and schedule endpoints.
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface SyncScheduleStatus {
  enabled: boolean;
  interval: string;
  rsiOrgSid: string;
  lastSync: string | null;
  nextSync: string | null;
  failures: number;
  autoDisabled: boolean;
}

export interface SyncChangeDetails {
  rolesAdded?: Array<{
    userId: string;
    discordUserId?: string;
    rsiHandle: string;
    roleId: string;
    roleName?: string;
  }>;
  rolesRemoved?: Array<{
    userId: string;
    discordUserId?: string;
    rsiHandle: string;
    roleId: string;
    roleName?: string;
  }>;
  rankChanges?: Array<{
    userId: string;
    rsiHandle: string;
    previousRank: string;
    newRank: string;
  }>;
  removedMembers?: Array<{
    userId: string;
    rsiHandle: string;
    lastKnownRank?: string;
  }>;
  conflicts?: Array<{
    type: string;
    userId?: string;
    rsiHandle?: string;
    description: string;
    resolution: string;
  }>;
  errors?: Array<{
    userId?: string;
    rsiHandle?: string;
    error: string;
  }>;
  triggeredBy?: string;
  rsiOrgSid?: string;
  guildId?: string;
  durationMs?: number;
  memberSnapshot?: {
    total: number;
    main: number;
    affiliate: number;
    hidden: number;
    redacted: number;
  };
  delta?: {
    newMembers: Array<{ handle: string; rank?: string; isAffiliate: boolean }>;
    removedMembers: Array<{ handle: string; lastRank?: string }>;
    rankChanges: Array<{ handle: string; oldRank: string; newRank: string }>;
    statusChanges: Array<{
      handle: string;
      field: string;
      oldValue: string;
      newValue: string;
    }>;
  };
}

export interface SyncAuditLog {
  id: string;
  syncType: 'manual' | 'scheduled' | 'webhook';
  changesDetected: number;
  changesApplied: number;
  errors: number;
  syncedAt: string;
  summary: string;
  durationSeconds: number | null;
  details?: SyncChangeDetails;
}

export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalChangesApplied: number;
}

export interface SyncAuditResponse {
  logs: SyncAuditLog[];
  total: number;
  stats: SyncStats;
}

export interface SyncMember {
  id: string;
  userId: string;
  rsiHandle: string;
  verificationMethod: 'manual' | 'bio_code' | 'discord_match';
  verified: boolean;
  verifiedAt: string | null;
  syncStatus: 'pending' | 'synced' | 'failed' | 'removed' | 'needs_review';
  lastSyncedAt: string | null;
  lastKnownRank: string | null;
  isAffiliate: boolean;
  discordUserId: string | null;
  createdAt: string;
}

export interface MemberListResponse {
  members: SyncMember[];
  total: number;
  stats: {
    totalLinks: number;
    verified: number;
    pending: number;
    synced: number;
    failed: number;
    removed: number;
    needsReview: number;
    affiliates: number;
  };
}

export interface ManualAssignInput {
  userId: string;
  rsiHandle: string;
  discordUserId?: string;
  rank?: string;
}

export interface ReviewQueueItem {
  id: string;
  userId: string;
  rsiHandle: string;
  syncStatus: string;
  lastKnownRank: string | null;
  isAffiliate: boolean;
  discordUserId: string | null;
  reviewReason: string | null;
  reviewFlaggedAt: string | null;
  lastFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
}

export interface ReviewStats {
  totalPendingReview: number;
  byReason: Record<string, number>;
  oldestReviewItem: string | null;
  resolvedLast30Days: number;
}

export type ReviewResolution = 'approved' | 'rejected' | 'resynced' | 'removed';

export interface ResolveReviewInput {
  linkId: string;
  resolution: ReviewResolution;
  adminNotes?: string;
  updatedRank?: string;
}

export interface CreateScheduleInput {
  rsiOrgSid: string;
  intervalMinutes: number;
  isEnabled: boolean;
  notifyOnChanges?: boolean;
  notifyOnErrors?: boolean;
  guildId?: string;
}

class RsiSyncService extends BaseService {
  protected basePath = '/api/v2/rsi/sync';

  /**
   * Create or update a sync schedule for an organization
   */
  async createSchedule(
    organizationId: string,
    input: CreateScheduleInput
  ): Promise<SyncScheduleStatus> {
    try {
      this.log('createSchedule', { organizationId });
      const response = await apiClient.postRaw<{ message: string; schedule: SyncScheduleStatus }>(
        `${this.basePath}/schedule/${organizationId}`,
        input
      );
      return response.schedule;
    } catch (error: unknown) {
      this.handleError(error, 'createSchedule');
    }
  }

  /**
   * Get sync schedule status for an organization
   */
  async getScheduleStatus(organizationId: string): Promise<SyncScheduleStatus | null> {
    try {
      this.log('getScheduleStatus', { organizationId });
      const response = await apiClient.getRaw<{ schedule: SyncScheduleStatus | null }>(
        `${this.basePath}/schedule/${organizationId}`
      );
      return response.schedule ?? null;
    } catch (error: unknown) {
      this.handleError(error, 'getScheduleStatus');
    }
  }

  /**
   * Get audit logs with pagination and stats
   */
  async getAuditLogs(
    organizationId: string,
    options: { limit?: number; offset?: number; hasErrors?: boolean } = {}
  ): Promise<SyncAuditResponse> {
    try {
      this.log('getAuditLogs', { organizationId, options });
      const params: Record<string, string> = {};
      if (options.limit) params.limit = String(options.limit);
      if (options.offset) params.offset = String(options.offset);
      if (options.hasErrors !== undefined) params.hasErrors = String(options.hasErrors);

      return apiClient.getRaw<SyncAuditResponse>(`${this.basePath}/audit/${organizationId}`, {
        params,
      });
    } catch (error: unknown) {
      this.handleError(error, 'getAuditLogs');
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(organizationId: string): Promise<SyncStats> {
    try {
      this.log('getAuditStats', { organizationId });
      const response = await apiClient.getRaw<{ stats: SyncStats }>(
        `${this.basePath}/audit/${organizationId}/stats`
      );
      return response.stats;
    } catch (error: unknown) {
      this.handleError(error, 'getAuditStats');
    }
  }

  /**
   * Get a single audit log entry with full details
   */
  async getAuditLogById(organizationId: string, logId: string): Promise<SyncAuditLog> {
    try {
      this.log('getAuditLogById', { organizationId, logId });
      const response = await apiClient.getRaw<{ log: SyncAuditLog }>(
        `${this.basePath}/audit/${organizationId}/${logId}`
      );
      return response.log;
    } catch (error: unknown) {
      this.handleError(error, 'getAuditLogById');
    }
  }

  /**
   * Trigger a manual sync
   */
  async triggerManualSync(organizationId: string): Promise<void> {
    try {
      this.log('triggerManualSync', { organizationId });
      await apiClient.post(`${this.basePath}/trigger/${organizationId}`);
    } catch (error: unknown) {
      this.handleError(error, 'triggerManualSync');
    }
  }

  /**
   * Enable sync schedule
   */
  async enableSchedule(organizationId: string): Promise<void> {
    try {
      this.log('enableSchedule', { organizationId });
      await apiClient.post(`${this.basePath}/schedule/${organizationId}/enable`);
    } catch (error: unknown) {
      this.handleError(error, 'enableSchedule');
    }
  }

  /**
   * Disable sync schedule
   */
  async disableSchedule(organizationId: string): Promise<void> {
    try {
      this.log('disableSchedule', { organizationId });
      await apiClient.post(`${this.basePath}/schedule/${organizationId}/disable`);
    } catch (error: unknown) {
      this.handleError(error, 'disableSchedule');
    }
  }

  /**
   * List linked members for organization
   */
  async listMembers(organizationId: string, includeRemoved = false): Promise<MemberListResponse> {
    try {
      this.log('listMembers', { organizationId, includeRemoved });
      const params: Record<string, string> = {};
      if (includeRemoved) params.includeRemoved = 'true';

      return apiClient.getRaw<MemberListResponse>(`${this.basePath}/members/${organizationId}`, {
        params,
      });
    } catch (error: unknown) {
      this.handleError(error, 'listMembers');
    }
  }

  /**
   * Manually assign RSI handle to a user (admin action)
   */
  async manualAssign(organizationId: string, input: ManualAssignInput): Promise<void> {
    try {
      this.log('manualAssign', { organizationId, input });
      await apiClient.post(`${this.basePath}/manual-assign/${organizationId}`, input);
    } catch (error: unknown) {
      this.handleError(error, 'manualAssign');
    }
  }

  /**
   * Manually verify a member link (admin action)
   */
  async manualVerify(organizationId: string, linkId: string): Promise<void> {
    try {
      this.log('manualVerify', { organizationId, linkId });
      await apiClient.post(`${this.basePath}/members/${organizationId}/${linkId}/verify`);
    } catch (error: unknown) {
      this.handleError(error, 'manualVerify');
    }
  }

  /**
   * Remove a member link (admin action)
   */
  async removeMember(organizationId: string, linkId: string): Promise<void> {
    try {
      this.log('removeMember', { organizationId, linkId });
      await apiClient.delete(`${this.basePath}/members/${organizationId}/${linkId}`);
    } catch (error: unknown) {
      this.handleError(error, 'removeMember');
    }
  }

  /**
   * Bulk verify existing member links (admin action)
   */
  async bulkVerify(
    organizationId: string,
    linkIds: string[]
  ): Promise<{
    verified: number;
    failed: number;
    results: { linkId: string; success: boolean; error?: string }[];
  }> {
    try {
      this.log('bulkVerify', { organizationId, count: linkIds.length });
      return apiClient.postRaw<{
        verified: number;
        failed: number;
        results: { linkId: string; success: boolean; error?: string }[];
      }>(`${this.basePath}/bulk-verify/${organizationId}`, { linkIds });
    } catch (error: unknown) {
      this.handleError(error, 'bulkVerify');
    }
  }

  /**
   * Bulk create and verify member links (admin action)
   */
  async bulkAssign(
    organizationId: string,
    entries: { userId: string; rsiHandle: string; discordUserId?: string }[]
  ): Promise<{
    created: number;
    skipped: number;
    failed: number;
    results: { userId: string; rsiHandle: string; success: boolean; error?: string }[];
  }> {
    try {
      this.log('bulkAssign', { organizationId, count: entries.length });
      return apiClient.postRaw<{
        created: number;
        skipped: number;
        failed: number;
        results: { userId: string; rsiHandle: string; success: boolean; error?: string }[];
      }>(`${this.basePath}/bulk-assign/${organizationId}`, { entries });
    } catch (error: unknown) {
      this.handleError(error, 'bulkAssign');
    }
  }

  // ==================== REVIEW QUEUE ====================

  /**
   * Get review queue items for an organization
   */
  async getReviewQueue(
    organizationId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ReviewQueueResponse> {
    try {
      this.log('getReviewQueue', { organizationId, options });
      const params: Record<string, string> = {};
      if (options.limit) params.limit = String(options.limit);
      if (options.offset) params.offset = String(options.offset);

      return apiClient.getRaw<ReviewQueueResponse>(`${this.basePath}/review/${organizationId}`, {
        params,
      });
    } catch (error: unknown) {
      this.handleError(error, 'getReviewQueue');
    }
  }

  /**
   * Resolve a review queue item
   */
  async resolveReviewItem(organizationId: string, input: ResolveReviewInput): Promise<void> {
    try {
      this.log('resolveReviewItem', { organizationId, input });
      await apiClient.post(`${this.basePath}/review/${organizationId}/resolve`, input);
    } catch (error: unknown) {
      this.handleError(error, 'resolveReviewItem');
    }
  }

  /**
   * Get review statistics for an organization
   */
  async getReviewStats(organizationId: string): Promise<ReviewStats> {
    try {
      this.log('getReviewStats', { organizationId });
      const response = await apiClient.getRaw<{ stats: ReviewStats }>(
        `${this.basePath}/review/${organizationId}/stats`
      );
      return response.stats;
    } catch (error: unknown) {
      this.handleError(error, 'getReviewStats');
    }
  }

  /**
   * Manually flag a link for review
   */
  async flagForReview(organizationId: string, linkId: string, reason: string): Promise<void> {
    try {
      this.log('flagForReview', { organizationId, linkId });
      await apiClient.post(`${this.basePath}/review/${organizationId}/flag`, {
        linkId,
        reason,
      });
    } catch (error: unknown) {
      this.handleError(error, 'flagForReview');
    }
  }
}

export const rsiSyncService = new RsiSyncService();
