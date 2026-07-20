"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiIntelAffiliationRefreshService = exports.RsiIntelAffiliationRefreshService = void 0;
const database_1 = require("../../config/database");
const RsiCitizenOrg_1 = require("../../models/RsiCitizenOrg");
const logger_1 = require("../../utils/logger");
const RsiCrawlerService_1 = require("../external/RsiCrawlerService");
const DEFAULT_STALE_HOURS = 12;
const DEFAULT_RETRY_WINDOW_MINUTES = 30;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_QUEUE_PER_REQUEST = 100;
const ACCOUNT_STATUS_TTL_HOURS = 24;
const RATE_LIMIT_RETRY_MIN_DELAY_MS = 250;
const RATE_LIMIT_RETRY_MAX_DELAY_MS = 900;
class RsiIntelAffiliationRefreshService {
    citizenOrgRepository;
    queue = [];
    queuedHandles = new Set();
    inFlightHandles = new Set();
    recentRefreshAttempts = new Map();
    recentAccountStatuses = new Map();
    processing = false;
    constructor() {
        this.citizenOrgRepository = database_1.AppDataSource.getRepository(RsiCitizenOrg_1.RsiCitizenOrg);
    }
    async loadCachedAffiliations(handles, staleAfterHours = DEFAULT_STALE_HOURS) {
        this.pruneAccountStatuses();
        const normalizedByLower = new Map();
        for (const handle of handles) {
            const trimmed = handle.trim();
            if (!trimmed) {
                continue;
            }
            const lower = trimmed.toLowerCase();
            if (!normalizedByLower.has(lower)) {
                normalizedByLower.set(lower, trimmed);
            }
        }
        if (normalizedByLower.size === 0) {
            return {
                affiliationsByHandle: new Map(),
                accountStatusByHandle: new Map(),
                staleHandles: [],
                handlesWithAffiliations: 0,
                affiliationCount: 0,
                redactedAffiliationMentions: 0,
            };
        }
        const handleLowers = Array.from(normalizedByLower.keys());
        const rows = await this.citizenOrgRepository
            .createQueryBuilder('citizenOrg')
            .where('LOWER(citizenOrg.citizenHandle) IN (:...handleLowers)', {
            handleLowers,
        })
            .orderBy('citizenOrg.lastFetchedAt', 'DESC')
            .getMany();
        const affiliationsByHandle = new Map();
        for (const row of rows) {
            const handleLower = row.citizenHandle.toLowerCase();
            if (!affiliationsByHandle.has(handleLower)) {
                affiliationsByHandle.set(handleLower, []);
            }
            affiliationsByHandle.get(handleLower)?.push(row);
        }
        const staleHandles = [];
        const accountStatusByHandle = new Map();
        let handlesWithAffiliations = 0;
        let affiliationCount = 0;
        let redactedAffiliationMentions = 0;
        const staleWindowMs = staleAfterHours * 60 * 60 * 1000;
        for (const [handleLower, canonicalHandle] of normalizedByLower.entries()) {
            const evaluation = this.evaluateHandleAffiliationCache(handleLower, affiliationsByHandle, staleWindowMs);
            accountStatusByHandle.set(handleLower, evaluation.accountState);
            affiliationsByHandle.set(handleLower, evaluation.affiliations);
            if (evaluation.hasAffiliations) {
                handlesWithAffiliations += 1;
            }
            affiliationCount += evaluation.affiliationCount;
            redactedAffiliationMentions += evaluation.redactedAffiliationMentions;
            if (evaluation.isStale &&
                this.canAttemptRefresh(handleLower) &&
                evaluation.accountState.status !== 'deleted' &&
                evaluation.accountState.status !== 'banned') {
                staleHandles.push(canonicalHandle);
            }
        }
        return {
            affiliationsByHandle,
            accountStatusByHandle,
            staleHandles,
            handlesWithAffiliations,
            affiliationCount,
            redactedAffiliationMentions,
        };
    }
    enqueueRefresh(handles, options) {
        const maxQueued = Math.max(1, options?.maxQueued ?? DEFAULT_MAX_QUEUE_PER_REQUEST);
        const uniqueHandles = new Map();
        for (const handle of handles) {
            const trimmed = handle.trim();
            if (!trimmed) {
                continue;
            }
            const lower = trimmed.toLowerCase();
            if (!uniqueHandles.has(lower)) {
                uniqueHandles.set(lower, trimmed);
            }
        }
        let queued = 0;
        let skipped = 0;
        for (const [handleLower, handle] of uniqueHandles.entries()) {
            if (queued >= maxQueued) {
                skipped += 1;
                continue;
            }
            if (!this.canAttemptRefresh(handleLower)) {
                skipped += 1;
                continue;
            }
            if (this.queuedHandles.has(handleLower) || this.inFlightHandles.has(handleLower)) {
                skipped += 1;
                continue;
            }
            this.queue.push({
                handle,
                organizationId: options?.organizationId,
            });
            this.queuedHandles.add(handleLower);
            this.markRefreshAttempt(handleLower);
            queued += 1;
        }
        if (queued > 0) {
            void this.processQueue();
        }
        return {
            queued,
            skipped,
            queueDepth: this.queue.length,
        };
    }
    async refreshHandlesBatch(handles, options) {
        const maxHandles = Math.max(1, options?.maxHandles ?? DEFAULT_BATCH_SIZE);
        const maxRuntimeMs = Math.max(5_000, options?.maxRuntimeMs ?? 10 * 60 * 1000);
        const delayMs = Math.max(0, options?.delayMs ?? 500);
        const dedupedHandles = new Map();
        for (const rawHandle of handles) {
            const trimmedHandle = rawHandle.trim();
            if (!trimmedHandle) {
                continue;
            }
            const handleLower = trimmedHandle.toLowerCase();
            if (!dedupedHandles.has(handleLower)) {
                dedupedHandles.set(handleLower, trimmedHandle);
            }
        }
        const normalized = Array.from(dedupedHandles.values()).slice(0, maxHandles);
        const startedAt = Date.now();
        const counters = {
            processed: 0,
            unavailable: 0,
            deleted: 0,
            banned: 0,
        };
        const circuitStatus = RsiCrawlerService_1.rsiCrawlerService.getCircuitStatus();
        if (circuitStatus.state === 'open') {
            logger_1.logger.info('Skipping RSI affiliation batch refresh because crawler circuit breaker is open', {
                failures: circuitStatus.failures,
            });
            return this.buildBatchResult(normalized.length, counters, startedAt);
        }
        for (const handle of normalized) {
            if (Date.now() - startedAt > maxRuntimeMs) {
                break;
            }
            const result = await this.refreshHandle({
                handle,
                organizationId: options?.organizationId,
            });
            const shouldStop = this.updateBatchCountersAndCheckEarlyStop(handle, result, counters);
            if (shouldStop) {
                break;
            }
            if (delayMs > 0 && counters.processed < normalized.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        return this.buildBatchResult(normalized.length, counters, startedAt);
    }
    buildBatchResult(attempted, counters, startedAt) {
        return {
            attempted,
            processed: counters.processed,
            unavailable: counters.unavailable,
            deleted: counters.deleted,
            banned: counters.banned,
            durationMs: Date.now() - startedAt,
        };
    }
    updateBatchCountersAndCheckEarlyStop(handle, result, counters) {
        counters.processed += 1;
        if (result.status === 'unavailable') {
            counters.unavailable += 1;
            if (this.isCrawlerControlPathUnavailable(result.message)) {
                logger_1.logger.info('Stopping RSI affiliation batch refresh early due to crawler control-path unavailability', {
                    handle,
                    message: result.message,
                });
                return true;
            }
            return false;
        }
        if (result.status === 'deleted') {
            counters.deleted += 1;
            return false;
        }
        if (result.status === 'banned') {
            counters.banned += 1;
        }
        return false;
    }
    canAttemptRefresh(handleLower) {
        const lastAttempt = this.recentRefreshAttempts.get(handleLower);
        if (!lastAttempt) {
            return true;
        }
        const retryWindowMs = DEFAULT_RETRY_WINDOW_MINUTES * 60 * 1000;
        return Date.now() - lastAttempt > retryWindowMs;
    }
    markRefreshAttempt(handleLower) {
        this.recentRefreshAttempts.set(handleLower, Date.now());
    }
    async processQueue() {
        if (this.processing) {
            return;
        }
        this.processing = true;
        try {
            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, DEFAULT_BATCH_SIZE);
                for (const item of batch) {
                    const handleLower = item.handle.toLowerCase();
                    this.queuedHandles.delete(handleLower);
                    this.inFlightHandles.add(handleLower);
                }
                for (const item of batch) {
                    try {
                        await this.refreshHandle(item);
                    }
                    finally {
                        this.inFlightHandles.delete(item.handle.toLowerCase());
                    }
                }
                this.pruneAttemptHistory();
            }
        }
        finally {
            this.processing = false;
        }
    }
    async refreshHandle(item) {
        const handleLower = item.handle.toLowerCase();
        try {
            const affiliations = await this.crawlMembershipsWithRateLimitRetry(item);
            const normalizedAffiliations = affiliations
                .map(affiliation => ({
                sid: affiliation.sid.trim().toUpperCase(),
                name: affiliation.name,
                rank: affiliation.rank,
                stars: affiliation.stars,
                isMain: affiliation.isMain,
            }))
                .filter(affiliation => Boolean(affiliation.sid));
            await this.replaceAffiliations(handleLower, normalizedAffiliations);
            this.setAccountStatus(handleLower, {
                status: 'active',
                updatedAt: new Date().toISOString(),
            });
            logger_1.logger.debug('RSI affiliation background refresh completed', {
                handle: item.handle,
                organizationId: item.organizationId,
                affiliations: normalizedAffiliations.length,
            });
            return {
                handle: item.handle,
                status: 'active',
                affiliations: normalizedAffiliations.length,
            };
        }
        catch (error) {
            const status = this.classifyAccountStatus(error);
            const message = this.toErrorMessage(error);
            if (status === 'deleted' || status === 'banned') {
                await this.deleteAffiliationsByHandle(handleLower);
            }
            this.setAccountStatus(handleLower, {
                status,
                updatedAt: new Date().toISOString(),
                message,
            });
            logger_1.logger.warn('RSI affiliation background refresh failed', {
                handle: item.handle,
                organizationId: item.organizationId,
                status,
                error: message,
            });
            return {
                handle: item.handle,
                status,
                affiliations: 0,
                message,
            };
        }
    }
    async crawlMembershipsWithRateLimitRetry(item) {
        try {
            return await RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(item.handle);
        }
        catch (error) {
            const message = this.toErrorMessage(error);
            if (!this.isRateLimitControlPathUnavailable(message)) {
                throw error;
            }
            const delayMs = this.computeRateLimitRetryDelayMs();
            logger_1.logger.info('RSI affiliation refresh hit rate-limit control path; retrying once with jitter', {
                handle: item.handle,
                organizationId: item.organizationId,
                delayMs,
                error: message,
            });
            await this.wait(delayMs);
            return RsiCrawlerService_1.rsiCrawlerService.crawlUserMemberships(item.handle);
        }
    }
    resolveAccountState(handleLower) {
        const cached = this.recentAccountStatuses.get(handleLower);
        if (cached && !this.isAccountStatusExpired(cached)) {
            return cached;
        }
        return {
            status: 'active',
            updatedAt: new Date().toISOString(),
        };
    }
    evaluateHandleAffiliationCache(handleLower, affiliationsByHandle, staleWindowMs) {
        const rawAffiliations = affiliationsByHandle.get(handleLower) ?? [];
        const accountState = this.resolveAccountState(handleLower);
        const affiliations = accountState.status === 'active' ? rawAffiliations : [];
        const newestFetchedAt = affiliations.reduce((latest, affiliation) => {
            if (!latest || affiliation.lastFetchedAt > latest) {
                return affiliation.lastFetchedAt;
            }
            return latest;
        }, undefined);
        return {
            accountState,
            affiliations,
            hasAffiliations: affiliations.length > 0,
            affiliationCount: affiliations.length,
            redactedAffiliationMentions: affiliations.filter(row => row.organizationSid.trim().toUpperCase() === 'REDACTED').length,
            isStale: !newestFetchedAt || Date.now() - newestFetchedAt.getTime() > staleWindowMs,
        };
    }
    classifyAccountStatus(error) {
        const message = this.toErrorMessage(error).toLowerCase();
        if (message.includes('404') ||
            message.includes('410') ||
            message.includes('not found') ||
            message.includes('does not exist') ||
            message.includes('deleted')) {
            return 'deleted';
        }
        if (message.includes('403') ||
            message.includes('451') ||
            message.includes('forbidden') ||
            message.includes('banned') ||
            message.includes('suspended') ||
            message.includes('restricted')) {
            return 'banned';
        }
        return 'unavailable';
    }
    isCrawlerControlPathUnavailable(message) {
        if (!message) {
            return false;
        }
        const lowered = message.toLowerCase();
        return lowered.includes('circuit breaker') || lowered.includes('rate limit');
    }
    isRateLimitControlPathUnavailable(message) {
        if (!message) {
            return false;
        }
        const lowered = message.toLowerCase();
        return (lowered.includes('rate limit') ||
            lowered.includes('too many requests') ||
            lowered.includes('status code 429') ||
            lowered.includes(' 429'));
    }
    computeRateLimitRetryDelayMs() {
        if (RATE_LIMIT_RETRY_MAX_DELAY_MS <= RATE_LIMIT_RETRY_MIN_DELAY_MS) {
            return RATE_LIMIT_RETRY_MIN_DELAY_MS;
        }
        return (RATE_LIMIT_RETRY_MIN_DELAY_MS +
            Math.floor(Math.random() * (RATE_LIMIT_RETRY_MAX_DELAY_MS - RATE_LIMIT_RETRY_MIN_DELAY_MS + 1)));
    }
    async wait(delayMs) {
        if (delayMs <= 0) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    async replaceAffiliations(handleLower, affiliations) {
        const deduped = new Map();
        for (const affiliation of affiliations) {
            if (!deduped.has(affiliation.sid)) {
                deduped.set(affiliation.sid, affiliation);
            }
        }
        await this.deleteAffiliationsByHandle(handleLower);
        if (deduped.size === 0) {
            return;
        }
        const now = new Date();
        const rows = Array.from(deduped.values()).map(affiliation => this.citizenOrgRepository.create({
            citizenHandle: handleLower,
            organizationSid: affiliation.sid,
            organizationName: affiliation.name,
            rank: affiliation.rank,
            stars: affiliation.stars,
            isMain: affiliation.isMain,
            isAffiliate: !affiliation.isMain,
            lastFetchedAt: now,
        }));
        await this.citizenOrgRepository.save(rows);
    }
    async deleteAffiliationsByHandle(handleLower) {
        await this.citizenOrgRepository
            .createQueryBuilder()
            .delete()
            .from(RsiCitizenOrg_1.RsiCitizenOrg)
            .where('LOWER(citizenHandle) = :handleLower', { handleLower })
            .execute();
    }
    setAccountStatus(handleLower, state) {
        this.recentAccountStatuses.set(handleLower, state);
    }
    toErrorMessage(error) {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && typeof error === 'object') {
            const record = error;
            const potentialMessage = record.message;
            if (typeof potentialMessage === 'string' && potentialMessage.trim()) {
                return potentialMessage;
            }
        }
        return 'Unknown error';
    }
    isAccountStatusExpired(state) {
        const updatedAtMs = Date.parse(state.updatedAt);
        if (!Number.isFinite(updatedAtMs)) {
            return true;
        }
        return Date.now() - updatedAtMs > ACCOUNT_STATUS_TTL_HOURS * 60 * 60 * 1000;
    }
    pruneAccountStatuses() {
        for (const [handleLower, state] of this.recentAccountStatuses.entries()) {
            if (this.isAccountStatusExpired(state)) {
                this.recentAccountStatuses.delete(handleLower);
            }
        }
    }
    pruneAttemptHistory() {
        if (this.recentRefreshAttempts.size <= 2000) {
            return;
        }
        const retryWindowMs = DEFAULT_RETRY_WINDOW_MINUTES * 60 * 1000;
        const cutoff = Date.now() - retryWindowMs * 4;
        for (const [handleLower, timestamp] of this.recentRefreshAttempts.entries()) {
            if (timestamp < cutoff &&
                !this.queuedHandles.has(handleLower) &&
                !this.inFlightHandles.has(handleLower)) {
                this.recentRefreshAttempts.delete(handleLower);
            }
        }
    }
}
exports.RsiIntelAffiliationRefreshService = RsiIntelAffiliationRefreshService;
exports.rsiIntelAffiliationRefreshService = new RsiIntelAffiliationRefreshService();
//# sourceMappingURL=RsiIntelAffiliationRefreshService.js.map