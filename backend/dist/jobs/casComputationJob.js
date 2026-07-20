"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCASSchedulerConcurrency = resolveCASSchedulerConcurrency;
exports.runCASComputationCycle = runCASComputationCycle;
exports.startCASComputationJob = startCASComputationJob;
exports.stopCASComputationJob = stopCASComputationJob;
const applicationInsights_1 = require("../config/applicationInsights");
const database_1 = require("../config/database");
const Organization_1 = require("../models/Organization");
const CASComputationService_1 = require("../services/analytics/CASComputationService");
const asyncConcurrency_1 = require("../utils/asyncConcurrency");
const logger_1 = require("../utils/logger");
const JOB_NAME = 'CAS-computation';
const INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_DB_POOL_MAX = 25;
const DEFAULT_CAS_CONCURRENCY = 8;
const MAX_CAS_CONCURRENCY = 24;
const DEFAULT_POOL_UTILIZATION = 0.4;
const MIN_POOL_UTILIZATION = 0.1;
const MAX_POOL_UTILIZATION = 1;
const METRIC_PREFIX = 'cas.scheduler';
const METRIC_QUEUE_DEPTH = `${METRIC_PREFIX}.queue_depth`;
const METRIC_QUEUE_DURATION_MS = `${METRIC_PREFIX}.queue_duration_ms`;
const METRIC_CYCLE_DURATION_MS = `${METRIC_PREFIX}.cycle_duration_ms`;
const METRIC_ORG_DURATION_MS = `${METRIC_PREFIX}.org_duration_ms`;
const METRIC_ORG_DURATION_AVG_MS = `${METRIC_PREFIX}.org_duration_avg_ms`;
const METRIC_ORG_DURATION_MAX_MS = `${METRIC_PREFIX}.org_duration_max_ms`;
const METRIC_FAILURE_COUNT = `${METRIC_PREFIX}.failure_count`;
const METRIC_ORG_FAILURE_COUNT = `${METRIC_PREFIX}.org_failure_count`;
const METRIC_SUCCESS_COUNT = `${METRIC_PREFIX}.success_count`;
const METRIC_EFFECTIVE_CONCURRENCY = `${METRIC_PREFIX}.effective_concurrency`;
const METRIC_POOL_MAX_CONNECTIONS = `${METRIC_PREFIX}.pool_max_connections`;
const METRIC_RETRY_ATTEMPTS = `${METRIC_PREFIX}.retry_attempts`;
const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;
let timer = null;
let initialRunTimer = null;
let isRunning = false;
async function computeWithRetry(organizationId) {
    let lastError = null;
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
        try {
            await new CASComputationService_1.CASComputationService().computeScore(organizationId);
            return;
        }
        catch (err) {
            lastError = err;
            (0, applicationInsights_1.trackMetric)(METRIC_RETRY_ATTEMPTS, 1);
            if (attempt < MAX_RETRY_ATTEMPTS) {
                const baseDelayMs = INITIAL_RETRY_DELAY_MS * (attempt - 1) + INITIAL_RETRY_DELAY_MS;
                const delayWithJitter = baseDelayMs + Math.random() * 1000;
                const cappedDelay = Math.min(delayWithJitter, MAX_RETRY_DELAY_MS);
                logger_1.logger.debug(`[${JOB_NAME}] Retry attempt ${attempt} for org ${organizationId}, backoff ${Math.round(cappedDelay)}ms`, {
                    organizationId,
                    attempt,
                    error: err instanceof Error ? err.message : String(err),
                });
                await new Promise(resolve => setTimeout(resolve, cappedDelay));
            }
        }
    }
    throw lastError || new Error(`Failed to compute CAS after ${MAX_RETRY_ATTEMPTS} attempts`);
}
function parsePositiveInteger(value, fallback, minValue = 1, maxValue = Number.MAX_SAFE_INTEGER) {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        return fallback;
    }
    return Math.min(parsed, maxValue);
}
function parseBoundedFloat(value, fallback, minValue, maxValue) {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.min(maxValue, Math.max(minValue, parsed));
}
function parsePositiveIntegerCandidate(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return Math.floor(value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return null;
}
function resolveDbPoolMaxConnections() {
    const extraCandidate = database_1.AppDataSource.options.extra;
    const extra = extraCandidate && typeof extraCandidate === 'object'
        ? extraCandidate
        : undefined;
    const fromOptions = parsePositiveIntegerCandidate(extra?.max);
    if (fromOptions !== null) {
        return fromOptions;
    }
    const fromEnv = parsePositiveIntegerCandidate(process.env.DB_POOL_MAX);
    if (fromEnv !== null) {
        return fromEnv;
    }
    return DEFAULT_DB_POOL_MAX;
}
function resolveCASSchedulerConcurrency(poolMaxConnectionsOverride) {
    const poolMaxConnections = poolMaxConnectionsOverride && poolMaxConnectionsOverride > 0
        ? Math.floor(poolMaxConnectionsOverride)
        : resolveDbPoolMaxConnections();
    const poolUtilizationRatio = parseBoundedFloat(process.env.CAS_SCHEDULER_POOL_UTILIZATION, DEFAULT_POOL_UTILIZATION, MIN_POOL_UTILIZATION, MAX_POOL_UTILIZATION);
    const requestedConcurrency = parsePositiveInteger(process.env.CAS_SCHEDULER_CONCURRENCY, DEFAULT_CAS_CONCURRENCY, 1, MAX_CAS_CONCURRENCY);
    const maxConcurrencyFromPool = Math.max(1, Math.floor(poolMaxConnections * poolUtilizationRatio));
    const effectiveConcurrency = Math.max(1, Math.min(requestedConcurrency, maxConcurrencyFromPool, MAX_CAS_CONCURRENCY));
    return {
        poolMaxConnections,
        poolUtilizationRatio,
        requestedConcurrency,
        maxConcurrencyFromPool,
        effectiveConcurrency,
    };
}
async function runCASComputation() {
    if (isRunning) {
        logger_1.logger.debug(`[${JOB_NAME}] Skipping — previous run still in progress`);
        return;
    }
    isRunning = true;
    const startTime = Date.now();
    let queueDepth = 0;
    try {
        const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
        const orgs = await orgRepo
            .createQueryBuilder('org')
            .select(['org.id'])
            .where('org."totalMembers" > 0')
            .getMany();
        queueDepth = orgs.length;
        const concurrency = resolveCASSchedulerConcurrency();
        (0, applicationInsights_1.trackMetric)(METRIC_QUEUE_DEPTH, queueDepth);
        (0, applicationInsights_1.trackMetric)(METRIC_EFFECTIVE_CONCURRENCY, concurrency.effectiveConcurrency);
        (0, applicationInsights_1.trackMetric)(METRIC_POOL_MAX_CONNECTIONS, concurrency.poolMaxConnections);
        logger_1.logger.info(`[${JOB_NAME}] Starting computation for ${queueDepth} organizations`, {
            effectiveConcurrency: concurrency.effectiveConcurrency,
            requestedConcurrency: concurrency.requestedConcurrency,
            poolMaxConnections: concurrency.poolMaxConnections,
            poolUtilizationRatio: concurrency.poolUtilizationRatio,
            poolBoundConcurrency: concurrency.maxConcurrencyFromPool,
        });
        const runResults = await (0, asyncConcurrency_1.mapWithConcurrency)(orgs, concurrency.effectiveConcurrency, async (org) => {
            const orgStart = Date.now();
            try {
                await computeWithRetry(org.id);
                const durationMs = Date.now() - orgStart;
                (0, applicationInsights_1.trackMetric)(METRIC_ORG_DURATION_MS, durationMs);
                return { organizationId: org.id, durationMs, success: true };
            }
            catch (err) {
                const durationMs = Date.now() - orgStart;
                (0, applicationInsights_1.trackMetric)(METRIC_ORG_DURATION_MS, durationMs);
                (0, applicationInsights_1.trackMetric)(METRIC_ORG_FAILURE_COUNT, 1);
                logger_1.logger.warn(`[${JOB_NAME}] Failed for org ${org.id} after ${MAX_RETRY_ATTEMPTS} attempts`, {
                    organizationId: org.id,
                    attempts: MAX_RETRY_ATTEMPTS,
                    error: err instanceof Error ? err.message : String(err),
                });
                return { organizationId: org.id, durationMs, success: false };
            }
        });
        const computed = runResults.filter(result => result.success).length;
        const errors = runResults.length - computed;
        const duration = Date.now() - startTime;
        const totalOrgDuration = runResults.reduce((sum, result) => sum + result.durationMs, 0);
        const averageOrgDuration = runResults.length === 0 ? 0 : totalOrgDuration / runResults.length;
        const maxOrgDuration = runResults.reduce((max, result) => Math.max(max, result.durationMs), 0);
        (0, applicationInsights_1.trackMetric)(METRIC_SUCCESS_COUNT, computed);
        (0, applicationInsights_1.trackMetric)(METRIC_FAILURE_COUNT, errors);
        (0, applicationInsights_1.trackMetric)(METRIC_QUEUE_DURATION_MS, duration);
        (0, applicationInsights_1.trackMetric)(METRIC_CYCLE_DURATION_MS, duration);
        (0, applicationInsights_1.trackMetric)(METRIC_ORG_DURATION_AVG_MS, averageOrgDuration);
        (0, applicationInsights_1.trackMetric)(METRIC_ORG_DURATION_MAX_MS, maxOrgDuration);
        logger_1.logger.info(`[${JOB_NAME}] Completed: ${computed} computed, ${errors} errors, ${duration}ms`);
    }
    catch (err) {
        (0, applicationInsights_1.trackMetric)(METRIC_FAILURE_COUNT, 1);
        logger_1.logger.error(`[${JOB_NAME}] Fatal error`, err);
    }
    finally {
        if (queueDepth > 0) {
            (0, applicationInsights_1.trackMetric)(METRIC_QUEUE_DEPTH, 0);
        }
        isRunning = false;
    }
}
async function runCASComputationCycle() {
    await runCASComputation();
}
function startCASComputationJob() {
    logger_1.logger.info(`[${JOB_NAME}] Scheduling every ${INTERVAL_MS / 60000} minutes`);
    if (initialRunTimer) {
        clearTimeout(initialRunTimer);
        initialRunTimer = null;
    }
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    initialRunTimer = setTimeout(() => {
        runCASComputationCycle().catch(() => { });
        initialRunTimer = null;
    }, 30_000);
    timer = setInterval(() => {
        runCASComputationCycle().catch(() => { });
    }, INTERVAL_MS);
}
function stopCASComputationJob() {
    if (initialRunTimer) {
        clearTimeout(initialRunTimer);
        initialRunTimer = null;
    }
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    logger_1.logger.info(`[${JOB_NAME}] Stopped`);
}
//# sourceMappingURL=casComputationJob.js.map