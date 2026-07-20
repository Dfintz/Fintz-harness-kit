"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerManualSync = exports.setRsiSyncSchedulerClient = exports.startRsiSyncSchedulerJob = void 0;
exports.runPostSyncIntel = runPostSyncIntel;
const discord_js_1 = require("discord.js");
const BotIPCService_1 = require("../bot/BotIPCService");
const roleIpcAuth_1 = require("../bot/roleIpcAuth");
const roleIpcHandler_1 = require("../bot/roleIpcHandler");
const database_1 = require("../config/database");
const RsiCrawledMember_1 = require("../models/RsiCrawledMember");
const RsiSyncAuditLog_1 = require("../models/RsiSyncAuditLog");
const RsiSyncMemberSnapshot_1 = require("../models/RsiSyncMemberSnapshot");
const DiscordService_1 = require("../services/discord/DiscordService");
const RsiCrawlerDataService_1 = require("../services/external/RsiCrawlerDataService");
const RsiMemberIntelService_1 = require("../services/external/RsiMemberIntelService");
const rsi_1 = require("../services/rsi");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const SYNC_LOCK_KEY = 'rsi-sync:scheduler-lock';
const SYNC_LOCK_TTL = 600;
let discordClient = null;
let isRunning = false;
const startRsiSyncSchedulerJob = (client) => {
    logger_1.logger.info('Starting RSI sync scheduler job (runs every 15 minutes)');
    if (!(0, roleIpcAuth_1.isRoleIpcSigningSecretConfigured)()) {
        logger_1.logger.error('RSI sync: role IPC signing secret (BOT_IPC_ROLE_SIGNING_SECRET / INTERNAL_SERVICE_SECRET) is not configured — Discord role changes via IPC will fail');
    }
    if (client) {
        discordClient = client;
    }
    void processScheduledSyncs();
    setInterval(() => {
        void processScheduledSyncs();
    }, 15 * 60 * 1000).unref();
};
exports.startRsiSyncSchedulerJob = startRsiSyncSchedulerJob;
const setRsiSyncSchedulerClient = (client) => {
    discordClient = client;
};
exports.setRsiSyncSchedulerClient = setRsiSyncSchedulerClient;
async function processScheduledSyncs() {
    if (isRunning) {
        logger_1.logger.debug('RSI sync scheduler already running, skipping');
        return;
    }
    const lockAcquired = await redis_1.redisClient.acquireLock(SYNC_LOCK_KEY, SYNC_LOCK_TTL);
    if (!lockAcquired) {
        logger_1.logger.debug('RSI sync scheduler lock held by another instance, skipping');
        return;
    }
    isRunning = true;
    try {
        const dueSchedules = await rsi_1.rsiSyncScheduleService.getSchedulesDueForSync();
        if (dueSchedules.length === 0) {
            return;
        }
        logger_1.logger.info(`Processing ${dueSchedules.length} scheduled RSI sync(s)`);
        for (const schedule of dueSchedules) {
            try {
                await processScheduleSync(schedule);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.error(`Failed to process scheduled sync for org ${schedule.organizationId}`, {
                    error: errorMessage,
                });
                await rsi_1.rsiSyncScheduleService.markSyncFailed(schedule.organizationId, errorMessage);
                await rsi_1.rsiSyncAuditService.logFailure(schedule.organizationId, RsiSyncAuditLog_1.SyncType.SCHEDULED, {
                    message: errorMessage,
                });
                await sendErrorNotification(schedule, errorMessage);
            }
        }
    }
    catch (error) {
        logger_1.logger.error('RSI sync scheduler job failed', { error });
    }
    finally {
        isRunning = false;
        await redis_1.redisClient.releaseLock(SYNC_LOCK_KEY);
    }
}
function getDiscordServiceForSync(organizationId, syncType) {
    try {
        const service = (0, DiscordService_1.getDiscordService)();
        return {
            assignRole: (guildId, userId, roleId) => service.assignRole(guildId, userId, roleId),
            removeRole: (guildId, userId, roleId) => service.removeRole(guildId, userId, roleId),
        };
    }
    catch {
    }
    const ipc = BotIPCService_1.BotIPCService.getInstance();
    if (ipc.isAvailable()) {
        logger_1.logger.debug(`Using IPC for ${syncType} sync role management of org ${organizationId}`);
        return {
            assignRole: async (guildId, userId, roleId) => {
                const payload = (0, roleIpcAuth_1.buildSignedRoleIpcPayload)(roleIpcHandler_1.ROLE_ASSIGN_ACTION, {
                    organizationId,
                    guildId,
                    userId,
                    roleId,
                });
                const response = await ipc.request(roleIpcHandler_1.ROLE_ASSIGN_ACTION, payload, {
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
                return response.data?.message ?? `Role assigned to user ${userId}`;
            },
            removeRole: async (guildId, userId, roleId) => {
                const payload = (0, roleIpcAuth_1.buildSignedRoleIpcPayload)(roleIpcHandler_1.ROLE_REMOVE_ACTION, {
                    organizationId,
                    guildId,
                    userId,
                    roleId,
                });
                const response = await ipc.request(roleIpcHandler_1.ROLE_REMOVE_ACTION, payload, {
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
                return response.data?.message ?? `Role removed from user ${userId}`;
            },
        };
    }
    logger_1.logger.debug(`No Discord service or IPC available for ${syncType} sync of org ${organizationId}`);
    return undefined;
}
async function crawlOrgMembers(rsiOrgSid, organizationId, syncType) {
    const force = syncType === 'manual';
    try {
        logger_1.logger.info(`Crawling RSI org members for ${rsiOrgSid} (${syncType} sync, force=${force})`);
        await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreOrganization(rsiOrgSid, force);
        await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreMembers(rsiOrgSid, force);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.warn(`Member crawl failed for ${rsiOrgSid}, continuing with sync: ${msg}`);
    }
    try {
        const { PublicOrgDirectoryService } = await Promise.resolve().then(() => __importStar(require('../services/organization/PublicOrgDirectoryService')));
        const directoryService = new PublicOrgDirectoryService();
        await directoryService.syncFromRsi(organizationId, rsiOrgSid);
        logger_1.logger.debug(`Synced RSI metadata to public profile for org ${organizationId}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.warn(`RSI metadata sync to profile failed for ${rsiOrgSid}: ${msg}`);
    }
}
function buildAuditDetails(schedule, duration, userResults) {
    const details = {
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
        if (userResult.previousRank &&
            userResult.newRank &&
            userResult.previousRank !== userResult.newRank) {
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
async function processScheduleSync(schedule) {
    const startTime = Date.now();
    logger_1.logger.info(`Starting scheduled sync for org ${schedule.organizationId}`, {
        rsiOrgSid: schedule.rsiOrgSid,
        guildId: schedule.guildId,
    });
    const config = {
        rsiOrgSid: schedule.rsiOrgSid,
        guildId: schedule.guildId ?? '',
        removeRolesOnLeave: schedule.removeRolesOnLeave,
        affiliateHandling: schedule.affiliateHandling,
        affiliateRoleId: schedule.affiliateRoleId,
    };
    const discordService = getDiscordServiceForSync(schedule.organizationId, 'scheduled');
    await crawlOrgMembers(schedule.rsiOrgSid, schedule.organizationId, 'scheduled');
    const result = await rsi_1.rsiUserLinkService.runOrganizationSync(schedule.organizationId, config, discordService);
    const duration = Date.now() - startTime;
    const details = buildAuditDetails(schedule, duration, result.userResults);
    const changesDetected = (details.rolesAdded?.length ?? 0) +
        (details.rolesRemoved?.length ?? 0) +
        (details.rankChanges?.length ?? 0) +
        (details.removedMembers?.length ?? 0);
    const snapshotMembers = await buildSnapshotAndDelta(schedule, details);
    const auditLog = await rsi_1.rsiSyncAuditService.createLog({
        organizationId: schedule.organizationId,
        syncType: RsiSyncAuditLog_1.SyncType.SCHEDULED,
        changesDetected,
        changesApplied: result.synced,
        errors: result.failed,
        details,
    });
    if (snapshotMembers && auditLog?.id) {
        await persistMemberSnapshot(auditLog.id, schedule.organizationId, snapshotMembers);
    }
    void runPostSyncIntel(schedule.organizationId, schedule.guildId);
    if (result.failed > 0 && result.synced === 0) {
        const { autoDisabled } = await rsi_1.rsiSyncScheduleService.markSyncFailed(schedule.organizationId, `Sync failed: ${result.errors.join(', ')}`);
        if (autoDisabled) {
            await sendAutoDisabledNotification(schedule, result.errors);
        }
    }
    else {
        await rsi_1.rsiSyncScheduleService.markSyncSuccess(schedule.organizationId);
    }
    if (changesDetected > 0 && schedule.notifyOnChanges) {
        await sendChangeNotification(schedule, details, result);
    }
    if (result.failed > 0 && schedule.notifyOnErrors) {
        await sendErrorNotification(schedule, `${result.failed} user(s) failed to sync: ${result.errors.slice(0, 3).join(', ')}`);
    }
    logger_1.logger.info(`Completed scheduled sync for org ${schedule.organizationId}`, {
        synced: result.synced,
        failed: result.failed,
        removed: result.removed,
        duration,
    });
}
function computeMemberDelta(currentMembers, prevSnapshots) {
    const prevByHandle = new Map(prevSnapshots.map(s => [s.rsiHandle.toLowerCase(), s]));
    const currByHandle = new Map(currentMembers.map(m => [m.handle.toLowerCase(), m]));
    const newMembers = currentMembers
        .filter(m => !prevByHandle.has(m.handle.toLowerCase()))
        .map(m => ({ handle: m.handle, rank: m.rank, isAffiliate: m.isAffiliate }));
    const removedMembers = prevSnapshots
        .filter(s => !currByHandle.has(s.rsiHandle.toLowerCase()))
        .map(s => ({ handle: s.rsiHandle, lastRank: s.rank }));
    const rankChanges = [];
    const statusChanges = [];
    for (const member of currentMembers) {
        const prev = prevByHandle.get(member.handle.toLowerCase());
        if (!prev) {
            continue;
        }
        const rankChanged = prev.rank && member.rank && prev.rank !== member.rank;
        if (rankChanged) {
            rankChanges.push({ handle: member.handle, oldRank: prev.rank, newRank: member.rank });
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
async function buildSnapshotAndDelta(schedule, details) {
    try {
        const crawledRepo = database_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
        const snapshotRepo = database_1.AppDataSource.getRepository(RsiSyncMemberSnapshot_1.RsiSyncMemberSnapshot);
        const currentMembers = await crawledRepo.find({
            where: { organizationSid: schedule.rsiOrgSid },
        });
        if (currentMembers.length === 0) {
            return null;
        }
        details.memberSnapshot = {
            total: currentMembers.length,
            main: currentMembers.filter(m => m.isMain).length,
            affiliate: currentMembers.filter(m => m.isAffiliate).length,
            hidden: currentMembers.filter(m => m.isHidden).length,
            redacted: currentMembers.filter(m => m.isRedacted).length,
        };
        const prevAuditLog = await database_1.AppDataSource.getRepository(RsiSyncAuditLog_1.RsiSyncAuditLog)
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
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Failed to build sync snapshot/delta: ${msg}`, {
            organizationId: schedule.organizationId,
        });
        return null;
    }
}
async function persistMemberSnapshot(auditLogId, organizationId, members) {
    try {
        const snapshotRepo = database_1.AppDataSource.getRepository(RsiSyncMemberSnapshot_1.RsiSyncMemberSnapshot);
        const snapshots = members.map(m => snapshotRepo.create({
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
        }));
        const queryRunner = database_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const chunkSize = 100;
            for (let i = 0; i < snapshots.length; i += chunkSize) {
                await queryRunner.manager.save(snapshots.slice(i, i + chunkSize));
            }
            await queryRunner.commitTransaction();
        }
        catch (txErr) {
            await queryRunner.rollbackTransaction();
            throw txErr;
        }
        finally {
            await queryRunner.release();
        }
        logger_1.logger.debug(`Persisted ${snapshots.length} member snapshots for audit log ${auditLogId}`);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Failed to persist member snapshots: ${msg}`);
    }
}
async function runPostSyncIntel(organizationId, guildId) {
    try {
        const enrichResult = await RsiMemberIntelService_1.rsiMemberIntelService.enrichOrganizationMembers(organizationId);
        logger_1.logger.info('Post-sync enrichment complete', {
            organizationId,
            total: enrichResult.total,
            enriched: enrichResult.enriched,
            failed: enrichResult.failed,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Post-sync enrichment failed for org ${organizationId}: ${msg}`);
    }
    try {
        const auditResult = await RsiMemberIntelService_1.rsiMemberIntelService.runMemberAudit(organizationId, guildId);
        logger_1.logger.info('Post-sync member audit complete', {
            organizationId,
            totalChecked: auditResult.totalChecked,
            flagsCreated: auditResult.flagsCreated,
            flagsSkipped: auditResult.flagsSkipped,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Post-sync member audit failed for org ${organizationId}: ${msg}`);
    }
    try {
        const validationResult = await RsiMemberIntelService_1.rsiMemberIntelService.validateRoleMappings(organizationId, guildId);
        logger_1.logger.info('Post-sync role validation complete', {
            organizationId,
            totalMembers: validationResult.totalMembers,
            validatedMembers: validationResult.validatedMembers,
            mismatches: validationResult.mismatches.length,
            unmappedRanks: validationResult.unmappedRanks,
            summary: validationResult.summary,
        });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger_1.logger.warn(`Post-sync role validation failed for org ${organizationId}: ${msg}`);
    }
}
async function sendChangeNotification(schedule, details, result) {
    if (!discordClient || !schedule.notificationChannelId) {
        return;
    }
    try {
        const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
        if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(result.failed > 0 ? 0xffff00 : 0x00ff00)
            .setTitle('🔄 RSI Role Sync Completed')
            .setDescription(`Automatic sync for organization completed`)
            .addFields({ name: 'Synced Users', value: `✅ ${result.synced}`, inline: true }, { name: 'Failed', value: `❌ ${result.failed}`, inline: true }, { name: 'Removed', value: `🚪 ${result.removed}`, inline: true })
            .setTimestamp();
        const rolesAdded = details.rolesAdded?.length ?? 0;
        const rolesRemoved = details.rolesRemoved?.length ?? 0;
        if (rolesAdded > 0 || rolesRemoved > 0) {
            embed.addFields({
                name: 'Role Changes',
                value: `➕ ${rolesAdded} added, ➖ ${rolesRemoved} removed`,
                inline: false,
            });
        }
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
    }
    catch (error) {
        logger_1.logger.error('Failed to send change notification', {
            error,
            organizationId: schedule.organizationId,
        });
    }
}
async function sendErrorNotification(schedule, errorMessage) {
    if (!discordClient || !schedule.notificationChannelId || !schedule.notifyOnErrors) {
        return;
    }
    try {
        const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
        if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('⚠️ RSI Role Sync Error')
            .setDescription(`Automatic sync encountered an error`)
            .addFields({ name: 'Error', value: errorMessage.substring(0, 1024), inline: false }, { name: 'Consecutive Failures', value: `${schedule.consecutiveFailures + 1}`, inline: true })
            .setTimestamp();
        if (schedule.consecutiveFailures + 1 >= schedule.maxConsecutiveFailures) {
            embed.addFields({
                name: '⛔ Auto-Disable Warning',
                value: 'This schedule will be automatically disabled if the next sync fails.',
                inline: false,
            });
        }
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to send error notification', {
            error,
            organizationId: schedule.organizationId,
        });
    }
}
async function sendAutoDisabledNotification(schedule, errors) {
    if (!discordClient || !schedule.notificationChannelId) {
        return;
    }
    try {
        const channel = discordClient.channels.cache.get(schedule.notificationChannelId);
        if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('⛔ RSI Role Sync Auto-Disabled')
            .setDescription(`Automatic sync has been disabled due to ${schedule.consecutiveFailures} consecutive failures.`)
            .addFields({
            name: 'Last Errors',
            value: errors.slice(0, 3).join('\n').substring(0, 1024) || 'Unknown',
            inline: false,
        }, {
            name: 'How to Re-enable',
            value: 'Use `/rsisync schedule enable` to re-enable automatic sync after fixing the issue.',
            inline: false,
        })
            .setTimestamp();
        await channel.send({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to send auto-disabled notification', {
            error,
            organizationId: schedule.organizationId,
        });
    }
}
const triggerManualSync = async (organizationId, triggeredBy) => {
    const schedule = await rsi_1.rsiSyncScheduleService.getSchedule(organizationId);
    if (!schedule) {
        throw new Error('No sync schedule configured for this organization');
    }
    const startTime = Date.now();
    try {
        const config = {
            rsiOrgSid: schedule.rsiOrgSid,
            guildId: schedule.guildId ?? '',
            removeRolesOnLeave: schedule.removeRolesOnLeave,
            affiliateHandling: schedule.affiliateHandling,
            affiliateRoleId: schedule.affiliateRoleId,
        };
        const discordService = getDiscordServiceForSync(organizationId, 'manual');
        await crawlOrgMembers(config.rsiOrgSid, organizationId, 'manual');
        const result = await rsi_1.rsiUserLinkService.runOrganizationSync(organizationId, config, discordService);
        const duration = Date.now() - startTime;
        await rsi_1.rsiSyncAuditService.createLog({
            organizationId,
            syncType: RsiSyncAuditLog_1.SyncType.MANUAL,
            changesDetected: result.synced + result.failed,
            changesApplied: result.synced,
            errors: result.failed,
            details: {
                triggeredBy,
                durationMs: duration,
                errors: result.errors.map(e => ({ error: e })),
            },
        });
        logger_1.logger.info(`Manual sync completed for org ${organizationId}`, {
            synced: result.synced,
            failed: result.failed,
            duration,
        });
        void runPostSyncIntel(organizationId, config.guildId ?? undefined);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await rsi_1.rsiSyncAuditService.logFailure(organizationId, RsiSyncAuditLog_1.SyncType.MANUAL, {
            message: errorMessage,
            details: { triggeredBy },
        });
        throw error;
    }
};
exports.triggerManualSync = triggerManualSync;
//# sourceMappingURL=rsiSyncScheduler.js.map