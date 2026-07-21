import { Client, EmbedBuilder, TextChannel } from 'discord.js';

import { BotIPCService } from '../bot/BotIPCService';
import { buildSignedRoleIpcPayload, isRoleIpcSigningSecretConfigured } from '../bot/roleIpcAuth';
import { ROLE_ASSIGN_ACTION, ROLE_REMOVE_ACTION } from '../bot/roleIpcHandler';
import { AppDataSource } from '../config/database';
import { RsiCrawledMember } from '../models/RsiCrawledMember';
import { RsiSyncAuditLog, SyncChangeDetails, SyncType } from '../models/RsiSyncAuditLog';
import { RsiSyncMemberSnapshot } from '../models/RsiSyncMemberSnapshot';
import { RsiSyncSchedule } from '../models/RsiSyncSchedule';
import { getDiscordService } from '../services/discord/DiscordService';
import { rsiCrawlerDataService } from '../services/external/RsiCrawlerDataService';
import { rsiMemberIntelService } from '../services/external/RsiMemberIntelService';
import type { AffiliateHandling, OrgSyncConfig } from '../services/rsi';
import { rsiSyncAuditService, rsiSyncScheduleService, rsiUserLinkService } from '../services/rsi';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

const SYNC_LOCK_KEY = 'rsi-sync:scheduler-lock';
const SYNC_LOCK_TTL = 600; // 10 minutes max lock

let discordClient: Client | null = null;
let isRunning = false;

/**
 * RSI Sync Scheduler Job
 *
 * Automatically runs RSI role synchronization for organizations
 * based on their configured schedules.
 *
 * Phase 4: RSI Role Sync System - Automatic Scheduling & Audit Logging
 *
 * Features:
 * - Runs every minute to check for due syncs
 * - Full audit logging
 * - Discord notifications for changes and errors
 * - Automatic failure handling
 */

/**
 * Start the RSI sync scheduler job
 * @param client - Discord client for role management and notifications
 */
export const startRsiSyncSchedulerJob = (client?: Client): void => {
  logger.info('Starting RSI sync scheduler job (runs every 15 minutes)');

  if (!isRoleIpcSigningSecretConfigured()) {
    logger.error(
      'RSI sync: role IPC signing secret (BOT_IPC_ROLE_SIGNING_SECRET / INTERNAL_SERVICE_SECRET) is not configured — Discord role changes via IPC will fail'
    );
  }

  if (client) {
    discordClient = client;
  }

  // Run immediately on startup
  void processScheduledSyncs();

  // Check for due syncs every 15 minutes — individual org intervals are 15–1440 min
  setInterval(
    () => {
      void processScheduledSyncs();
    },
    15 * 60 * 1000
  ).unref(); // 15 minutes
};

/**
 * Set or update the Discord client for the scheduler
 */
export const setRsiSyncSchedulerClient = (client: Client): void => {
  discordClient = client;
};

/**
 * Process all schedules that are due for sync
 */
async function processScheduledSyncs(): Promise<void> {
  // Prevent concurrent runs (local + distributed)
  if (isRunning) {
    logger.debug('RSI sync scheduler already running, skipping');
    return;
  }

  // Distributed lock — prevents multiple instances from syncing simultaneously
  const lockAcquired = await redisClient.acquireLock(SYNC_LOCK_KEY, SYNC_LOCK_TTL);
  if (!lockAcquired) {
    logger.debug('RSI sync scheduler lock held by another instance, skipping');
    return;
  }

  isRunning = true;

  try {
    // Get all schedules due for sync
    const dueSchedules = await rsiSyncScheduleService.getSchedulesDueForSync();

    if (dueSchedules.length === 0) {
      return;
    }

    logger.info(`Processing ${dueSchedules.length} scheduled RSI sync(s)`);

    for (const schedule of dueSchedules) {
      try {
        await processScheduleSync(schedule);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to process scheduled sync for org ${schedule.organizationId}`, {
          error: errorMessage,
        });

        // Mark as failed
        await rsiSyncScheduleService.markSyncFailed(schedule.organizationId, errorMessage);

        // Log failure to audit
        await rsiSyncAuditService.logFailure(schedule.organizationId, SyncType.SCHEDULED, {
          message: errorMessage,
        });

        // Send error notification
        await sendErrorNotification(schedule, errorMessage);
      }
    }
  } catch (error) {
    logger.error('RSI sync scheduler job failed', { error });
  } finally {
    isRunning = false;
    await redisClient.releaseLock(SYNC_LOCK_KEY);
  }
}

/**
 * Helper function to get Discord service for role management.
 * Tries direct DiscordService first (co-located mode), then falls back
 * to IPC via the bot container (worker / separate-container mode).
 *
 * @param organizationId - Organization ID for logging
 * @param syncType - Type of sync for logging
 * @returns Discord service wrapper or undefined if unavailable
 */
function getDiscordServiceForSync(
  organizationId: string,
  syncType: 'scheduled' | 'manual'
):
  | {
      assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
      removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }
  | undefined {
  // 1. Try direct DiscordService (available when bot is co-located)
  try {
    const service = getDiscordService();
    return {
      assignRole: (guildId, userId, roleId) => service.assignRole(guildId, userId, roleId),
      removeRole: (guildId, userId, roleId) => service.removeRole(guildId, userId, roleId),
    };
  } catch {
    // DiscordService not initialized — expected in worker container
  }

  // 2. Fall back to IPC via bot container
  const ipc = BotIPCService.getInstance();
  if (ipc.isAvailable()) {
    logger.debug(`Using IPC for ${syncType} sync role management of org ${organizationId}`);
    return {
      assignRole: async (guildId, userId, roleId) => {
        const payload = buildSignedRoleIpcPayload(ROLE_ASSIGN_ACTION, {
          organizationId,
          guildId,
          userId,
          roleId,
        });

        const response = await ipc.request(ROLE_ASSIGN_ACTION, payload, {
          timeoutMs: 15_000,
          requireDefinitiveResponse: true,
          definitiveWaitMs: 500,
          routing: {
            scope: 'guild',
            guildId,
          },
        });
        const isDefinitive = response?.definitive ?? response?.status !== 'not_handled';
        if (!isDefinitive || response?.status === 'not_handled') {
          throw new Error('IPC role:assign was not handled by any connected shard');
        }
        if (!response?.success) {
          throw new Error(response?.error ?? 'IPC role:assign failed (no response)');
        }
        return (response.data?.message as string) ?? `Role assigned to user ${userId}`;
      },
      removeRole: async (guildId, userId, roleId) => {
        const payload = buildSignedRoleIpcPayload(ROLE_REMOVE_ACTION, {
          organizationId,
          guildId,
          userId,
          roleId,
        });

        const response = await ipc.request(ROLE_REMOVE_ACTION, payload, {
          timeoutMs: 15_000,
          requireDefinitiveResponse: true,
          definitiveWaitMs: 500,
          routing: {
            scope: 'guild',
            guildId,
          },
        });
        const isDefinitive = response?.definitive ?? response?.status !== 'not_handled';
        if (!isDefinitive || response?.status === 'not_handled') {
          throw new Error('IPC role:remove was not handled by any connected shard');
        }
        if (!response?.success) {
          throw new Error(response?.error ?? 'IPC role:remove failed (no response)');
        }
        return (response.data?.message as string) ?? `Role removed from user ${userId}`;
      },
    };
  }

  logger.debug(`No Discord service or IPC available for ${syncType} sync of org ${organizationId}`);
  return undefined;
}

/**
 * Crawl RSI organization members before syncing roles.
 * Ensures rsi_crawled_members (and rsi_crawled_organizations) are populated
 * so that Member Intelligence and snapshot deltas have data to work with.
 * Also syncs RSI org metadata (archetype, commitment, etc.) to the public profile.
 */
async function crawlOrgMembers(
  rsiOrgSid: string,
  organizationId: string,
  syncType: string
): Promise<void> {
  // Manual syncs should always force-refresh from RSI to pick up latest data.
  // Scheduled syncs can reuse cached data if it's < 60 min old.
  const force = syncType === 'manual';
  try {
    logger.info(`Crawling RSI org members for ${rsiOrgSid} (${syncType} sync, force=${force})`);
    await rsiCrawlerDataService.fetchAndStoreOrganization(rsiOrgSid, force);
    await rsiCrawlerDataService.fetchAndStoreMembers(rsiOrgSid, force);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Member crawl failed for ${rsiOrgSid}, continuing with sync: ${msg}`);
  }

  // Sync RSI org metadata to the public profile (non-fatal)
  try {
    const { PublicOrgDirectoryService } =
      await import('../services/organization/PublicOrgDirectoryService');
    const directoryService = new PublicOrgDirectoryService();
    await directoryService.syncFromRsi(organizationId, rsiOrgSid);
    logger.debug(`Synced RSI metadata to public profile for org ${organizationId}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`RSI metadata sync to profile failed for ${rsiOrgSid}: ${msg}`);
  }
}

/**
 * Build audit detail records from sync user results.
 * Extracted from processScheduleSync to reduce cognitive complexity.
 */
function buildAuditDetails(
  schedule: RsiSyncSchedule,
  duration: number,
  userResults: Array<{
    userId: string;
    rsiHandle: string;
    rolesAdded: string[];
    rolesRemoved: string[];
    previousRank?: string;
    newRank?: string;
    isRemoved?: boolean;
    error?: string;
  }>
): SyncChangeDetails {
  const details: SyncChangeDetails = {
    rsiOrgSid: schedule.rsiOrgSid,
    guildId: schedule.guildId,
    durationMs: duration,
    rolesAdded: [],
    rolesRemoved: [],
    rankChanges: [],
    removedMembers: [],
    errors: [],
  };

  for (const userResult of userResults) {
    for (const roleId of userResult.rolesAdded) {
      details.rolesAdded?.push({
        userId: userResult.userId,
        rsiHandle: userResult.rsiHandle,
        roleId,
      });
    }

    for (const roleId of userResult.rolesRemoved) {
      details.rolesRemoved?.push({
        userId: userResult.userId,
        rsiHandle: userResult.rsiHandle,
        roleId,
      });
    }

    if (
      userResult.previousRank &&
      userResult.newRank &&
      userResult.previousRank !== userResult.newRank
    ) {
      details.rankChanges?.push({
        userId: userResult.userId,
        rsiHandle: userResult.rsiHandle,
        previousRank: userResult.previousRank,
        newRank: userResult.newRank,
      });
    }

    if (userResult.isRemoved) {
      details.removedMembers?.push({
        userId: userResult.userId,
        rsiHandle: userResult.rsiHandle,
        lastKnownRank: userResult.previousRank,
      });
    }

    if (userResult.error) {
      details.errors?.push({
        userId: userResult.userId,
        rsiHandle: userResult.rsiHandle,
        error: userResult.error,
      });
    }
  }

  return details;
}

/**
 * Process sync for a single schedule
 */
async function processScheduleSync(schedule: RsiSyncSchedule): Promise<void> {
  const startTime = Date.now();

  logger.info(`Starting scheduled sync for org ${schedule.organizationId}`, {
    rsiOrgSid: schedule.rsiOrgSid,
    guildId: schedule.guildId,
  });

  // Build sync config
  const config: OrgSyncConfig = {
    rsiOrgSid: schedule.rsiOrgSid,
    guildId: schedule.guildId ?? '',
    removeRolesOnLeave: schedule.removeRolesOnLeave,
    affiliateHandling: schedule.affiliateHandling as AffiliateHandling,
    affiliateRoleId: schedule.affiliateRoleId,
  };

  // Get Discord service for role management
  const discordService = getDiscordServiceForSync(schedule.organizationId, 'scheduled');

  // Crawl RSI org members before syncing roles so Member Intelligence has data
  await crawlOrgMembers(schedule.rsiOrgSid, schedule.organizationId, 'scheduled');

  // Run the sync
  const result = await rsiUserLinkService.runOrganizationSync(
    schedule.organizationId,
    config,
    discordService
  );

  const duration = Date.now() - startTime;

  // Build audit details from user results
  const details = buildAuditDetails(schedule, duration, result.userResults);

  // Calculate changes detected
  const changesDetected =
    (details.rolesAdded?.length ?? 0) +
    (details.rolesRemoved?.length ?? 0) +
    (details.rankChanges?.length ?? 0) +
    (details.removedMembers?.length ?? 0);

  // Build member snapshot and delta from crawled data
  const snapshotMembers = await buildSnapshotAndDelta(schedule, details);

  // Create audit log
  const auditLog = await rsiSyncAuditService.createLog({
    organizationId: schedule.organizationId,
    syncType: SyncType.SCHEDULED,
    changesDetected,
    changesApplied: result.synced,
    errors: result.failed,
    details,
  });

  // Persist member snapshots (linked to the audit log just created)
  if (snapshotMembers && auditLog?.id) {
    await persistMemberSnapshot(auditLog.id, schedule.organizationId, snapshotMembers);
  }

  // Post-sync: run enrichment and audit in background (non-blocking)
  void runPostSyncIntel(schedule.organizationId, schedule.guildId);

  // Update schedule status
  if (result.failed > 0 && result.synced === 0) {
    const { autoDisabled } = await rsiSyncScheduleService.markSyncFailed(
      schedule.organizationId,
      `Sync failed: ${result.errors.join(', ')}`
    );

    if (autoDisabled) {
      await sendAutoDisabledNotification(schedule, result.errors);
    }
  } else {
    await rsiSyncScheduleService.markSyncSuccess(schedule.organizationId);
  }

  // Send change notifications
  if (changesDetected > 0 && schedule.notifyOnChanges) {
    await sendChangeNotification(schedule, details, result);
  }

  // Send error notifications
  if (result.failed > 0 && schedule.notifyOnErrors) {
    await sendErrorNotification(
      schedule,
      `${result.failed} user(s) failed to sync: ${result.errors.slice(0, 3).join(', ')}`
    );
  }

  logger.info(`Completed scheduled sync for org ${schedule.organizationId}`, {
    synced: result.synced,
    failed: result.failed,
    removed: result.removed,
    duration,
  });
}

/**
 * Compute delta between current crawled members and previous sync snapshot.
 * Returns the delta object or null if no previous snapshot exists.
 */
function computeMemberDelta(
  currentMembers: RsiCrawledMember[],
  prevSnapshots: RsiSyncMemberSnapshot[]
): SyncChangeDetails['delta'] {
  const prevByHandle = new Map(prevSnapshots.map(s => [s.rsiHandle.toLowerCase(), s]));
  const currByHandle = new Map(currentMembers.map(m => [m.handle.toLowerCase(), m]));

  // New members: in current but not in previous
  const newMembers = currentMembers
    .filter(m => !prevByHandle.has(m.handle.toLowerCase()))
    .map(m => ({ handle: m.handle, rank: m.rank, isAffiliate: m.isAffiliate }));

  // Removed members: in previous but not in current
  const removedMembers = prevSnapshots
    .filter(s => !currByHandle.has(s.rsiHandle.toLowerCase()))
    .map(s => ({ handle: s.rsiHandle, lastRank: s.rank }));

  // Rank and status changes: present in both snapshots
  const rankChanges: Array<{ handle: string; oldRank: string; newRank: string }> = [];
  const statusChanges: Array<{
    handle: string;
    field: string;
    oldValue: string;
    newValue: string;
  }> = [];

  for (const member of currentMembers) {
    const prev = prevByHandle.get(member.handle.toLowerCase());
    if (!prev) {
      continue;
    }

    const rankChanged = prev.rank && member.rank && prev.rank !== member.rank;
    if (rankChanged) {
      rankChanges.push({ handle: member.handle, oldRank: prev.rank!, newRank: member.rank! });
    }
    if (prev.isMain !== member.isMain) {
      statusChanges.push({
        handle: member.handle,
        field: 'isMain',
        oldValue: String(prev.isMain),
        newValue: String(member.isMain),
      });
    }
    if (prev.isAffiliate !== member.isAffiliate) {
      statusChanges.push({
        handle: member.handle,
        field: 'isAffiliate',
        oldValue: String(prev.isAffiliate),
        newValue: String(member.isAffiliate),
      });
    }
  }

  return { newMembers, removedMembers, rankChanges, statusChanges };
}

/**
 * Build member snapshot from crawled data and compute delta against previous sync.
 * Enriches the SyncChangeDetails with memberSnapshot summary and delta.
 * Returns the crawled member data for snapshot persistence (after audit log creation).
 */
async function buildSnapshotAndDelta(
  schedule: RsiSyncSchedule,
  details: SyncChangeDetails
): Promise<RsiCrawledMember[] | null> {
  try {
    const crawledRepo = AppDataSource.getRepository(RsiCrawledMember);
    const snapshotRepo = AppDataSource.getRepository(RsiSyncMemberSnapshot);

    // Fetch current crawled members for this RSI org
    const currentMembers = await crawledRepo.find({
      where: { organizationSid: schedule.rsiOrgSid },
    });

    if (currentMembers.length === 0) {
      return null;
    }

    // Build member snapshot summary
    details.memberSnapshot = {
      total: currentMembers.length,
      main: currentMembers.filter(m => m.isMain).length,
      affiliate: currentMembers.filter(m => m.isAffiliate).length,
      hidden: currentMembers.filter(m => m.isHidden).length,
      redacted: currentMembers.filter(m => m.isRedacted).length,
    };

    // Find previous sync's audit log to get its snapshot for delta
    const prevAuditLog = await AppDataSource.getRepository(RsiSyncAuditLog)
      .createQueryBuilder('log')
      .where('log.organizationId = :orgId', { orgId: schedule.organizationId })
      .orderBy('log.syncedAt', 'DESC')
      .take(1)
      .getOne();

    const prevSnapshots = prevAuditLog
      ? await snapshotRepo.find({ where: { syncLogId: prevAuditLog.id } })
      : [];

    if (prevSnapshots.length > 0) {
      details.delta = computeMemberDelta(currentMembers, prevSnapshots);
    }

    return currentMembers;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to build sync snapshot/delta: ${msg}`, {
      organizationId: schedule.organizationId,
    });
    return null;
  }
}

/**
 * Persist member snapshot rows after the audit log has been created.
 */
async function persistMemberSnapshot(
  auditLogId: string,
  organizationId: string,
  members: RsiCrawledMember[]
): Promise<void> {
  try {
    const snapshotRepo = AppDataSource.getRepository(RsiSyncMemberSnapshot);
    const snapshots = members.map(m =>
      snapshotRepo.create({
        syncLogId: auditLogId,
        organizationId,
        rsiHandle: m.handle,
        displayName: m.displayName,
        rank: m.rank,
        stars: m.stars,
        isMain: m.isMain,
        isAffiliate: m.isAffiliate,
        isHidden: m.isHidden,
        isRedacted: m.isRedacted ?? false,
        avatar: m.avatar,
        enlisted: m.enlisted,
      })
    );

    // Batch insert in a single transaction to prevent partial saves
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const chunkSize = 100;
      for (let i = 0; i < snapshots.length; i += chunkSize) {
        await queryRunner.manager.save(snapshots.slice(i, i + chunkSize));
      }
      await queryRunner.commitTransaction();
    } catch (txErr) {
      await queryRunner.rollbackTransaction();
      throw txErr;
    } finally {
      await queryRunner.release();
    }

    logger.debug(`Persisted ${snapshots.length} member snapshots for audit log ${auditLogId}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to persist member snapshots: ${msg}`);
  }
}

/**
 * Run post-sync intelligence: enrichment → audit → role validation.
 * All operations are non-fatal — errors are logged but don't fail the sync.
 * Exported so standalone crawl triggers can reuse the same pipeline.
 */
export async function runPostSyncIntel(organizationId: string, guildId?: string): Promise<void> {
  // Step 1: Enrichment — fetch other RSI org affiliations for all members
  try {
    const enrichResult = await rsiMemberIntelService.enrichOrganizationMembers(organizationId);
    logger.info('Post-sync enrichment complete', {
      organizationId,
      total: enrichResult.total,
      enriched: enrichResult.enriched,
      failed: enrichResult.failed,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Post-sync enrichment failed for org ${organizationId}: ${msg}`);
  }

  // Step 2: Audit — create flags for detected issues (missing members, role mismatches, etc.)
  try {
    const auditResult = await rsiMemberIntelService.runMemberAudit(organizationId, guildId);
    logger.info('Post-sync member audit complete', {
      organizationId,
      totalChecked: auditResult.totalChecked,
      flagsCreated: auditResult.flagsCreated,
      flagsSkipped: auditResult.flagsSkipped,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Post-sync member audit failed for org ${organizationId}: ${msg}`);
  }

  // Step 3: Role validation — compare RSI ranks against configured role mappings
  try {
    const validationResult = await rsiMemberIntelService.validateRoleMappings(
      organizationId,
      guildId
    );
    logger.info('Post-sync role validation complete', {
      organizationId,
      totalMembers: validationResult.totalMembers,
      validatedMembers: validationResult.validatedMembers,
      mismatches: validationResult.mismatches.length,
      unmappedRanks: validationResult.unmappedRanks,
      summary: validationResult.summary,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`Post-sync role validation failed for org ${organizationId}: ${msg}`);
  }
}

/**
 * Send Discord notification for changes
 */
async function sendChangeNotification(
  schedule: RsiSyncSchedule,
  details: SyncChangeDetails,
  result: { synced: number; failed: number; removed: number }
): Promise<void> {
  if (!discordClient || !schedule.notificationChannelId) {
    return;
  }

  try {
    const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
    if (!channel || !(channel instanceof TextChannel)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(result.failed > 0 ? 0xffff00 : 0x00ff00)
      .setTitle('🔄 RSI Role Sync Completed')
      .setDescription(`Automatic sync for organization completed`)
      .addFields(
        { name: 'Synced Users', value: `✅ ${result.synced}`, inline: true },
        { name: 'Failed', value: `❌ ${result.failed}`, inline: true },
        { name: 'Removed', value: `🚪 ${result.removed}`, inline: true }
      )
      .setTimestamp();

    // Add role changes summary
    const rolesAdded = details.rolesAdded?.length ?? 0;
    const rolesRemoved = details.rolesRemoved?.length ?? 0;
    if (rolesAdded > 0 || rolesRemoved > 0) {
      embed.addFields({
        name: 'Role Changes',
        value: `➕ ${rolesAdded} added, ➖ ${rolesRemoved} removed`,
        inline: false,
      });
    }

    // Add rank changes summary
    const rankChanges = details.rankChanges?.length ?? 0;
    if (rankChanges > 0 && details.rankChanges) {
      const examples = details.rankChanges
        .slice(0, 3)
        .map(c => `• ${c.rsiHandle}: ${c.previousRank} → ${c.newRank}`)
        .join('\n');
      embed.addFields({
        name: `Rank Changes (${rankChanges})`,
        value: examples + (rankChanges > 3 ? `\n...and ${rankChanges - 3} more` : ''),
        inline: false,
      });
    }

    // Add removed members summary
    const removedCount = details.removedMembers?.length ?? 0;
    if (removedCount > 0 && details.removedMembers) {
      const examples = details.removedMembers
        .slice(0, 3)
        .map(m => `• ${m.rsiHandle}`)
        .join('\n');
      embed.addFields({
        name: `Members Left Organization (${removedCount})`,
        value: examples + (removedCount > 3 ? `\n...and ${removedCount - 3} more` : ''),
        inline: false,
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send change notification', {
      error,
      organizationId: schedule.organizationId,
    });
  }
}

/**
 * Send Discord notification for errors
 */
async function sendErrorNotification(
  schedule: RsiSyncSchedule,
  errorMessage: string
): Promise<void> {
  if (!discordClient || !schedule.notificationChannelId || !schedule.notifyOnErrors) {
    return;
  }

  try {
    const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
    if (!channel || !(channel instanceof TextChannel)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⚠️ RSI Role Sync Error')
      .setDescription(`Automatic sync encountered an error`)
      .addFields(
        { name: 'Error', value: errorMessage.substring(0, 1024), inline: false },
        { name: 'Consecutive Failures', value: `${schedule.consecutiveFailures + 1}`, inline: true }
      )
      .setTimestamp();

    if (schedule.consecutiveFailures + 1 >= schedule.maxConsecutiveFailures) {
      embed.addFields({
        name: '⛔ Auto-Disable Warning',
        value: 'This schedule will be automatically disabled if the next sync fails.',
        inline: false,
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send error notification', {
      error,
      organizationId: schedule.organizationId,
    });
  }
}

/**
 * Send Discord notification for auto-disabled schedule
 */
async function sendAutoDisabledNotification(
  schedule: RsiSyncSchedule,
  errors: string[]
): Promise<void> {
  if (!discordClient || !schedule.notificationChannelId) {
    return;
  }

  try {
    const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
    if (!channel || !(channel instanceof TextChannel)) {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('⛔ RSI Role Sync Auto-Disabled')
      .setDescription(
        `Automatic sync has been disabled due to ${schedule.consecutiveFailures} consecutive failures.`
      )
      .addFields(
        {
          name: 'Last Errors',
          value: errors.slice(0, 3).join('\n').substring(0, 1024) || 'Unknown',
          inline: false,
        },
        {
          name: 'How to Re-enable',
          value:
            'Use `/rsisync schedule enable` to re-enable automatic sync after fixing the issue.',
          inline: false,
        }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to send auto-disabled notification', {
      error,
      organizationId: schedule.organizationId,
    });
  }
}

/**
 * Manually trigger a sync for an organization (for testing or manual runs)
 */
export const triggerManualSync = async (
  organizationId: string,
  triggeredBy?: string
): Promise<void> => {
  const schedule = await rsiSyncScheduleService.getSchedule(organizationId);

  if (!schedule) {
    throw new Error('No sync schedule configured for this organization');
  }

  const startTime = Date.now();

  try {
    const config: OrgSyncConfig = {
      rsiOrgSid: schedule.rsiOrgSid,
      guildId: schedule.guildId ?? '',
      removeRolesOnLeave: schedule.removeRolesOnLeave,
      affiliateHandling: schedule.affiliateHandling as AffiliateHandling,
      affiliateRoleId: schedule.affiliateRoleId,
    };

    // Get Discord service for role management
    const discordService = getDiscordServiceForSync(organizationId, 'manual');

    // Crawl RSI org members before syncing roles so Member Intelligence has data
    await crawlOrgMembers(config.rsiOrgSid, organizationId, 'manual');

    const result = await rsiUserLinkService.runOrganizationSync(
      organizationId,
      config,
      discordService
    );

    const duration = Date.now() - startTime;

    // Create audit log for manual sync
    await rsiSyncAuditService.createLog({
      organizationId,
      syncType: SyncType.MANUAL,
      changesDetected: result.synced + result.failed,
      changesApplied: result.synced,
      errors: result.failed,
      details: {
        triggeredBy,
        durationMs: duration,
        errors: result.errors.map(e => ({ error: e })),
      },
    });

    logger.info(`Manual sync completed for org ${organizationId}`, {
      synced: result.synced,
      failed: result.failed,
      duration,
    });

    // Post-sync: run enrichment and audit in background (non-blocking)
    void runPostSyncIntel(organizationId, config.guildId ?? undefined);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await rsiSyncAuditService.logFailure(organizationId, SyncType.MANUAL, {
      message: errorMessage,
      details: { triggeredBy },
    });

    throw error;
  }
};
