/**
 * CAS Computation Job — Background scheduler for Composite Activity Score.
 *
 * Runs every 15 minutes. Iterates active organizations and computes CAS scores.
 * Runs in the worker container (P1) — not the API process.
 *
 * @see docs/CAS_ARCHITECTURE_BRIEF.md § 10
 */

import { trackMetric } from '../config/applicationInsights';
import { AppDataSource } from '../config/database';
import { Organization } from '../models/Organization';
import { CASComputationService } from '../services/analytics/CASComputationService';
import { mapWithConcurrency } from '../utils/asyncConcurrency';
import { logger } from '../utils/logger';

const JOB_NAME = 'CAS-computation';
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
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
const INITIAL_RETRY_DELAY_MS = 1000; // 1s
const MAX_RETRY_DELAY_MS = 10000; // 10s

let timer: ReturnType<typeof setInterval> | null = null;
let initialRunTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

/**
 * Compute with exponential backoff retry logic.
 * Attempts: 3 | Base delays: 1s, 2s, 5s with jitter
 */
async function computeWithRetry(organizationId: string): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await new CASComputationService().computeScore(organizationId);
      return; // Success
    } catch (err) {
      lastError = err as Error;
      trackMetric(METRIC_RETRY_ATTEMPTS, 1);

      if (attempt < MAX_RETRY_ATTEMPTS) {
        // Calculate backoff: 1s, 2s, 5s + random jitter
        const baseDelayMs = INITIAL_RETRY_DELAY_MS * (attempt - 1) + INITIAL_RETRY_DELAY_MS;
        const delayWithJitter = baseDelayMs + Math.random() * 1000;
        const cappedDelay = Math.min(delayWithJitter, MAX_RETRY_DELAY_MS);

        logger.debug(
          `[${JOB_NAME}] Retry attempt ${attempt} for org ${organizationId}, backoff ${Math.round(cappedDelay)}ms`,
          {
            organizationId,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          }
        );

        await new Promise(resolve => setTimeout(resolve, cappedDelay));
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error(`Failed to compute CAS after ${MAX_RETRY_ATTEMPTS} attempts`);
}

interface CASSchedulerConcurrencySettings {
  poolMaxConnections: number;
  poolUtilizationRatio: number;
  requestedConcurrency: number;
  maxConcurrencyFromPool: number;
  effectiveConcurrency: number;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minValue = 1,
  maxValue = Number.MAX_SAFE_INTEGER
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    return fallback;
  }

  return Math.min(parsed, maxValue);
}

function parseBoundedFloat(
  value: string | undefined,
  fallback: number,
  minValue: number,
  maxValue: number
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(maxValue, Math.max(minValue, parsed));
}

function parsePositiveIntegerCandidate(value: unknown): number | null {
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

function resolveDbPoolMaxConnections(): number {
  const extraCandidate = (AppDataSource.options as { extra?: unknown }).extra;
  const extra =
    extraCandidate && typeof extraCandidate === 'object'
      ? (extraCandidate as Record<string, unknown>)
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

export function resolveCASSchedulerConcurrency(
  poolMaxConnectionsOverride?: number
): CASSchedulerConcurrencySettings {
  const poolMaxConnections =
    poolMaxConnectionsOverride && poolMaxConnectionsOverride > 0
      ? Math.floor(poolMaxConnectionsOverride)
      : resolveDbPoolMaxConnections();

  const poolUtilizationRatio = parseBoundedFloat(
    process.env.CAS_SCHEDULER_POOL_UTILIZATION,
    DEFAULT_POOL_UTILIZATION,
    MIN_POOL_UTILIZATION,
    MAX_POOL_UTILIZATION
  );

  const requestedConcurrency = parsePositiveInteger(
    process.env.CAS_SCHEDULER_CONCURRENCY,
    DEFAULT_CAS_CONCURRENCY,
    1,
    MAX_CAS_CONCURRENCY
  );

  const maxConcurrencyFromPool = Math.max(1, Math.floor(poolMaxConnections * poolUtilizationRatio));
  const effectiveConcurrency = Math.max(
    1,
    Math.min(requestedConcurrency, maxConcurrencyFromPool, MAX_CAS_CONCURRENCY)
  );

  return {
    poolMaxConnections,
    poolUtilizationRatio,
    requestedConcurrency,
    maxConcurrencyFromPool,
    effectiveConcurrency,
  };
}

/**
 * Run CAS computation for all active organizations.
 */
async function runCASComputation(): Promise<void> {
  if (isRunning) {
    logger.debug(`[${JOB_NAME}] Skipping — previous run still in progress`);
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  let queueDepth = 0;

  try {
    const orgRepo = AppDataSource.getRepository(Organization);

    // Get active orgs (with at least 1 member)
    const orgs = await orgRepo
      .createQueryBuilder('org')
      .select(['org.id'])
      .where('org."totalMembers" > 0')
      .getMany();

    queueDepth = orgs.length;
    const concurrency = resolveCASSchedulerConcurrency();

    trackMetric(METRIC_QUEUE_DEPTH, queueDepth);
    trackMetric(METRIC_EFFECTIVE_CONCURRENCY, concurrency.effectiveConcurrency);
    trackMetric(METRIC_POOL_MAX_CONNECTIONS, concurrency.poolMaxConnections);

    logger.info(`[${JOB_NAME}] Starting computation for ${queueDepth} organizations`, {
      effectiveConcurrency: concurrency.effectiveConcurrency,
      requestedConcurrency: concurrency.requestedConcurrency,
      poolMaxConnections: concurrency.poolMaxConnections,
      poolUtilizationRatio: concurrency.poolUtilizationRatio,
      poolBoundConcurrency: concurrency.maxConcurrencyFromPool,
    });

    const runResults = await mapWithConcurrency(
      orgs,
      concurrency.effectiveConcurrency,
      async org => {
        const orgStart = Date.now();

        try {
          await computeWithRetry(org.id);
          const durationMs = Date.now() - orgStart;
          trackMetric(METRIC_ORG_DURATION_MS, durationMs);
          return { organizationId: org.id, durationMs, success: true };
        } catch (err) {
          const durationMs = Date.now() - orgStart;
          trackMetric(METRIC_ORG_DURATION_MS, durationMs);
          trackMetric(METRIC_ORG_FAILURE_COUNT, 1);
          logger.warn(
            `[${JOB_NAME}] Failed for org ${org.id} after ${MAX_RETRY_ATTEMPTS} attempts`,
            {
              organizationId: org.id,
              attempts: MAX_RETRY_ATTEMPTS,
              error: err instanceof Error ? err.message : String(err),
            }
          );
          return { organizationId: org.id, durationMs, success: false };
        }
      }
    );

    const computed = runResults.filter(result => result.success).length;
    const errors = runResults.length - computed;

    const duration = Date.now() - startTime;

    const totalOrgDuration = runResults.reduce((sum, result) => sum + result.durationMs, 0);
    const averageOrgDuration = runResults.length === 0 ? 0 : totalOrgDuration / runResults.length;
    const maxOrgDuration = runResults.reduce((max, result) => Math.max(max, result.durationMs), 0);

    trackMetric(METRIC_SUCCESS_COUNT, computed);
    trackMetric(METRIC_FAILURE_COUNT, errors);
    trackMetric(METRIC_QUEUE_DURATION_MS, duration);
    trackMetric(METRIC_CYCLE_DURATION_MS, duration);
    trackMetric(METRIC_ORG_DURATION_AVG_MS, averageOrgDuration);
    trackMetric(METRIC_ORG_DURATION_MAX_MS, maxOrgDuration);

    logger.info(`[${JOB_NAME}] Completed: ${computed} computed, ${errors} errors, ${duration}ms`);
  } catch (err) {
    trackMetric(METRIC_FAILURE_COUNT, 1);
    logger.error(`[${JOB_NAME}] Fatal error`, err);
  } finally {
    if (queueDepth > 0) {
      trackMetric(METRIC_QUEUE_DEPTH, 0);
    }
    isRunning = false;
  }
}

/**
 * Run a single CAS computation cycle.
 * Exported for BullMQ worker registration.
 */
export async function runCASComputationCycle(): Promise<void> {
  await runCASComputation();
}

/**
 * Start the CAS computation scheduler.
 */
export function startCASComputationJob(): void {
  logger.info(`[${JOB_NAME}] Scheduling every ${INTERVAL_MS / 60000} minutes`);

  if (initialRunTimer) {
    clearTimeout(initialRunTimer);
    initialRunTimer = null;
  }

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Initial run after 30s (let DB connections settle)
  initialRunTimer = setTimeout(() => {
    runCASComputationCycle().catch(() => {});
    initialRunTimer = null;
  }, 30_000);

  timer = setInterval(() => {
    runCASComputationCycle().catch(() => {});
  }, INTERVAL_MS);
}

/**
 * Stop the scheduler.
 */
export function stopCASComputationJob(): void {
  if (initialRunTimer) {
    clearTimeout(initialRunTimer);
    initialRunTimer = null;
  }

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  logger.info(`[${JOB_NAME}] Stopped`);
}
