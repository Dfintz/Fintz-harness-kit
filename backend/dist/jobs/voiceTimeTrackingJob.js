"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVoiceTimeTracking = runVoiceTimeTracking;
exports.startVoiceTimeTrackingJob = startVoiceTimeTrackingJob;
const applicationInsights_1 = require("../config/applicationInsights");
const database_1 = require("../config/database");
const Federation_1 = require("../models/Federation");
const Organization_1 = require("../models/Organization");
const asyncConcurrency_1 = require("../utils/asyncConcurrency");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const JOB_NAME = 'voice-time-tracking';
const INTERVAL_MS = 5 * 60 * 1000;
const CREDIT_MINUTES_PER_POLL = 5;
const PLATFORM_GUILD_ID = 'platform';
const DEFAULT_ORG_CONCURRENCY = 8;
const MAX_ORG_CONCURRENCY = 20;
const FALLBACK_UPSERT_CONCURRENCY = 5;
let timer = null;
let isRunning = false;
function resolveOrgConcurrency() {
    const rawValue = process.env.VOICE_TRACKING_ORG_CONCURRENCY;
    const parsed = rawValue ? Number.parseInt(rawValue, 10) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 1) {
        return DEFAULT_ORG_CONCURRENCY;
    }
    return Math.min(parsed, MAX_ORG_CONCURRENCY);
}
function buildVoiceCredits(users, minutesPerUser) {
    const credits = new Map();
    for (const user of users) {
        if (!user.platformUserId) {
            continue;
        }
        const existingMinutes = credits.get(user.platformUserId) ?? 0;
        credits.set(user.platformUserId, existingMinutes + minutesPerUser);
    }
    return credits;
}
function sumCreditedMinutes(credits) {
    let total = 0;
    for (const minutes of credits.values()) {
        total += minutes;
    }
    return total;
}
async function executeVoiceMinutesUpsert(userIds, minutes, date) {
    if (userIds.length === 0) {
        return;
    }
    await database_1.AppDataSource.query(`INSERT INTO member_engagements ("guildId", "userId", "date", "voiceMinutes", "messageCount")
     SELECT $1::text, users.user_id, $2::date, users.voice_minutes, 0
     FROM UNNEST($3::text[], $4::int[]) AS users(user_id, voice_minutes)
     ON CONFLICT ("guildId", "userId", "date")
     DO UPDATE SET
       "voiceMinutes" = member_engagements."voiceMinutes" + EXCLUDED."voiceMinutes",
       "updatedAt" = NOW()`, [PLATFORM_GUILD_ID, date, userIds, minutes]);
}
async function upsertVoiceMinutesBatch(credits, date) {
    if (credits.size === 0) {
        return;
    }
    const userIds = Array.from(credits.keys());
    const minutes = userIds.map(userId => credits.get(userId) ?? 0);
    try {
        await executeVoiceMinutesUpsert(userIds, minutes, date);
        return;
    }
    catch (error) {
        logger_1.logger.warn(`[${JOB_NAME}] Batch upsert failed, falling back to per-user upserts`, {
            records: credits.size,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    const entries = Array.from(credits.entries());
    await (0, asyncConcurrency_1.mapWithConcurrency)(entries, FALLBACK_UPSERT_CONCURRENCY, async ([userId, minutesToAdd]) => {
        try {
            await executeVoiceMinutesUpsert([userId], [minutesToAdd], date);
        }
        catch (error) {
            logger_1.logger.debug('Voice minutes credit failed', {
                userId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    });
}
async function runVoiceTimeTracking() {
    if (isRunning) {
        logger_1.logger.debug(`[${JOB_NAME}] Skipping — previous run still in progress`);
        return;
    }
    isRunning = true;
    try {
        const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
        const orgs = await orgRepo
            .createQueryBuilder('org')
            .select(['org.id', 'org.settings'])
            .where(`org.settings->'voiceServer'->>'contributeToCAS' = 'true'`)
            .andWhere(`org.settings->'voiceServer'->>'enabled' = 'true'`)
            .getMany();
        let totalMinutesTracked = 0;
        if (orgs.length > 0) {
            const orgConcurrency = resolveOrgConcurrency();
            logger_1.logger.debug(`[${JOB_NAME}] Tracking voice time for ${orgs.length} organizations (concurrency=${orgConcurrency})`);
            const orgResults = await (0, asyncConcurrency_1.mapWithConcurrency)(orgs, orgConcurrency, async (org) => {
                const config = org.settings?.voiceServer;
                if (!config?.iceHost) {
                    return 0;
                }
                try {
                    return await trackOrgVoiceMinutes(config);
                }
                catch (error) {
                    logger_1.logger.warn(`[${JOB_NAME}] Failed to track voice for org ${org.id}`, {
                        error: error instanceof Error ? error.message : String(error),
                    });
                    return 0;
                }
            });
            totalMinutesTracked = orgResults.reduce((total, minutes) => total + minutes, 0);
        }
        try {
            const fedMinutes = await trackFederationVoiceMinutes();
            totalMinutesTracked += fedMinutes;
        }
        catch (error) {
            logger_1.logger.warn(`[${JOB_NAME}] Failed to track federation voice minutes`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        if (totalMinutesTracked > 0) {
            (0, applicationInsights_1.trackMetric)('voice.tracking.minutes_credited', totalMinutesTracked);
            logger_1.logger.info(`[${JOB_NAME}] Credited ${totalMinutesTracked} voice minutes`);
        }
    }
    catch (error) {
        logger_1.logger.error(`[${JOB_NAME}] Job failed`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
    finally {
        isRunning = false;
    }
}
async function trackOrgVoiceMinutes(config) {
    const cvpPort = config.icePort ?? 8443;
    const cvpUrl = `https://${config.iceHost}:${cvpPort}/channels`;
    const response = await fetch(cvpUrl, {
        signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
        return 0;
    }
    const data = (await response.json());
    if (data.error || !data.users) {
        return 0;
    }
    const voiceCredits = buildVoiceCredits(data.users, CREDIT_MINUTES_PER_POLL);
    if (voiceCredits.size === 0) {
        return 0;
    }
    const today = new Date().toISOString().split('T')[0];
    await upsertVoiceMinutesBatch(voiceCredits, today);
    return sumCreditedMinutes(voiceCredits);
}
function getFederationScopes(federationId, platformFedId) {
    const scopes = [`fed:${federationId}`];
    if (federationId === platformFedId) {
        scopes.push('platform');
    }
    return scopes;
}
async function getScopeVoiceCredits(scope) {
    const channelData = await redis_1.cache.get(`voice:channels:${scope}`);
    if (!channelData?.users) {
        return new Map();
    }
    return buildVoiceCredits(channelData.users, CREDIT_MINUTES_PER_POLL);
}
async function trackFederationVoiceMinutes() {
    const fedRepo = database_1.AppDataSource.getRepository(Federation_1.Federation);
    const fedsWithVoice = await fedRepo
        .createQueryBuilder('fed')
        .select(['fed.id', 'fed.settings'])
        .where(`fed.settings->'voiceServer'->>'enabled' = 'true'`)
        .getMany();
    const platformFedId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
    const seenScopes = new Set();
    const aggregatedCredits = new Map();
    for (const fed of fedsWithVoice) {
        const scopes = getFederationScopes(fed.id, platformFedId);
        for (const scope of scopes) {
            if (seenScopes.has(scope)) {
                continue;
            }
            seenScopes.add(scope);
            const scopeCredits = await getScopeVoiceCredits(scope);
            for (const [userId, minutes] of scopeCredits.entries()) {
                aggregatedCredits.set(userId, (aggregatedCredits.get(userId) ?? 0) + minutes);
            }
        }
    }
    if (aggregatedCredits.size === 0) {
        return 0;
    }
    const today = new Date().toISOString().split('T')[0];
    await upsertVoiceMinutesBatch(aggregatedCredits, today);
    return sumCreditedMinutes(aggregatedCredits);
}
function startVoiceTimeTrackingJob() {
    logger_1.logger.info(`[${JOB_NAME}] Starting (interval: ${INTERVAL_MS / 1000}s)`);
    void runVoiceTimeTracking();
    timer = setInterval(() => void runVoiceTimeTracking(), INTERVAL_MS);
    return {
        cleanup: () => {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            logger_1.logger.info(`[${JOB_NAME}] Stopped`);
        },
    };
}
//# sourceMappingURL=voiceTimeTrackingJob.js.map