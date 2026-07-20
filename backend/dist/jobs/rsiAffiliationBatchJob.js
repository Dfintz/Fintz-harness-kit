"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRsiAffiliationBatchJob = startRsiAffiliationBatchJob;
exports.stopRsiAffiliationBatchJob = stopRsiAffiliationBatchJob;
exports.runRsiAffiliationBatchJobNow = runRsiAffiliationBatchJobNow;
const database_1 = require("../config/database");
const RsiCitizenOrg_1 = require("../models/RsiCitizenOrg");
const RsiCrawledMember_1 = require("../models/RsiCrawledMember");
const RsiIntelAffiliationRefreshService_1 = require("../services/intel/RsiIntelAffiliationRefreshService");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const JOB_NAME = 'RSI-affiliation-batch';
const LOCK_KEY = 'rsi-affiliation-batch:lock';
const LOCK_TTL_SECONDS = Number.parseInt(process.env.RSI_AFFILIATION_BATCH_LOCK_TTL_SECONDS ?? '900', 10);
let isRunning = false;
let intervalHandle = null;
function startRsiAffiliationBatchJob() {
    if (intervalHandle) {
        logger_1.logger.debug(`[${JOB_NAME}] Scheduler already started`);
        return;
    }
    const intervalMinutes = Number.parseInt(process.env.RSI_AFFILIATION_BATCH_INTERVAL_MINUTES ?? '60', 10);
    logger_1.logger.info(`[${JOB_NAME}] Scheduling every ${intervalMinutes} minutes`);
    void runRsiAffiliationBatchJob();
    intervalHandle = setInterval(() => {
        void runRsiAffiliationBatchJob();
    }, intervalMinutes * 60 * 1000);
    intervalHandle.unref();
}
function stopRsiAffiliationBatchJob() {
    if (!intervalHandle) {
        return;
    }
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger_1.logger.info(`[${JOB_NAME}] Stopped`);
}
async function runRsiAffiliationBatchJobNow() {
    await runRsiAffiliationBatchJob();
}
async function runRsiAffiliationBatchJob() {
    if (isRunning) {
        logger_1.logger.debug(`[${JOB_NAME}] Skipping - previous run still in progress`);
        return;
    }
    if (!database_1.AppDataSource.isInitialized) {
        logger_1.logger.debug(`[${JOB_NAME}] Skipping - database not initialized`);
        return;
    }
    const lockAcquired = await redis_1.redisClient.acquireLock(LOCK_KEY, LOCK_TTL_SECONDS);
    if (!lockAcquired) {
        logger_1.logger.debug(`[${JOB_NAME}] Skipping - lock held by another instance`);
        return;
    }
    isRunning = true;
    const startedAt = Date.now();
    try {
        const batchSize = Math.max(1, Number.parseInt(process.env.RSI_AFFILIATION_BATCH_SIZE ?? '150', 10));
        const staleAfterHours = Math.max(1, Number.parseInt(process.env.RSI_AFFILIATION_BATCH_STALE_HOURS ?? '24', 10));
        const maxRuntimeMs = Math.max(30_000, Number.parseInt(process.env.RSI_AFFILIATION_BATCH_MAX_RUNTIME_MS ?? '900000', 10));
        const delayMs = Math.max(0, Number.parseInt(process.env.RSI_AFFILIATION_BATCH_DELAY_MS ?? '500', 10));
        const handles = await collectCandidateHandles(batchSize, staleAfterHours);
        if (handles.length === 0) {
            logger_1.logger.info(`[${JOB_NAME}] No candidate handles found for refresh`);
            return;
        }
        logger_1.logger.info(`[${JOB_NAME}] Refreshing ${handles.length} candidate handles`);
        const result = await RsiIntelAffiliationRefreshService_1.rsiIntelAffiliationRefreshService.refreshHandlesBatch(handles, {
            maxHandles: batchSize,
            maxRuntimeMs,
            delayMs,
        });
        logger_1.logger.info(`[${JOB_NAME}] Completed: attempted=${result.attempted}, processed=${result.processed}, deleted=${result.deleted}, banned=${result.banned}, unavailable=${result.unavailable}, durationMs=${result.durationMs}`);
    }
    catch (error) {
        logger_1.logger.error(`[${JOB_NAME}] Failed`, {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
    finally {
        isRunning = false;
        await redis_1.redisClient.releaseLock(LOCK_KEY);
        logger_1.logger.debug(`[${JOB_NAME}] Run finished in ${Date.now() - startedAt}ms`);
    }
}
async function collectCandidateHandles(batchSize, staleAfterHours) {
    const citizenOrgRepository = database_1.AppDataSource.getRepository(RsiCitizenOrg_1.RsiCitizenOrg);
    const memberRepository = database_1.AppDataSource.getRepository(RsiCrawledMember_1.RsiCrawledMember);
    const staleBefore = new Date(Date.now() - staleAfterHours * 60 * 60 * 1000);
    const staleRows = await citizenOrgRepository
        .createQueryBuilder('citizenOrg')
        .select('LOWER(citizenOrg.citizenHandle)', 'handleLower')
        .addSelect('MIN(citizenOrg.citizenHandle)', 'handle')
        .addSelect('MAX(citizenOrg.lastFetchedAt)', 'lastFetchedAt')
        .groupBy('LOWER(citizenOrg.citizenHandle)')
        .having('MAX(citizenOrg.lastFetchedAt) < :staleBefore', { staleBefore })
        .orderBy('MAX(citizenOrg.lastFetchedAt)', 'ASC')
        .limit(batchSize)
        .getRawMany();
    const handles = new Set();
    for (const row of staleRows) {
        if (row.handleLower && row.handleLower !== 'redacted') {
            handles.add(row.handle);
        }
    }
    if (handles.size < batchSize) {
        const supplementLimit = Math.max(batchSize * 3, batchSize + 25);
        const recentMemberRows = await memberRepository
            .createQueryBuilder('member')
            .select('LOWER(member.handle)', 'handleLower')
            .addSelect('MIN(member.handle)', 'handle')
            .addSelect('MAX(member.lastCrawledAt)', 'lastSeen')
            .groupBy('LOWER(member.handle)')
            .orderBy('MAX(member.lastCrawledAt)', 'DESC')
            .limit(supplementLimit)
            .getRawMany();
        for (const row of recentMemberRows) {
            if (!row.handleLower || row.handleLower === 'redacted') {
                continue;
            }
            handles.add(row.handle);
            if (handles.size >= batchSize) {
                break;
            }
        }
    }
    return Array.from(handles).slice(0, batchSize);
}
//# sourceMappingURL=rsiAffiliationBatchJob.js.map