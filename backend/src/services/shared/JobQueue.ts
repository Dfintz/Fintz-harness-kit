/**
 * Job Queue Infrastructure — BullMQ
 *
 * Centralizes queue creation, worker registration, and connection management.
 * Replaces raw `setInterval`/`node-cron` with proper job queue features:
 * - Retry with exponential backoff
 * - Dead letter queue for failed jobs
 * - Job progress tracking
 * - Repeatable schedules (replaces cron/setInterval)
 * - Concurrency control
 *
 * BullMQ uses dedicated Redis clients to isolate worker/queue traffic.
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — P8
 */

import {
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
  type WorkerOptions,
} from 'bullmq';
import Redis, { type RedisOptions } from 'ioredis';

import { logger } from '../../utils/logger';
import {
  attachRedisErrorObserver,
  getRedisConfig,
  getRedisConfigAsync,
  sanitizeRedisErrorForLogging,
  setupEntraTokenRefreshForClient,
  type EntraTokenRefreshHandle,
} from '../../utils/redis';

// ==================== CONNECTION ====================

/**
 * BullMQ uses dedicated Redis clients so we can support Entra token auth/refresh
 * consistently with the rest of the application.
 */
const redisConnections = new Map<string, Redis>();
const tokenRefreshHandles = new Map<string, EntraTokenRefreshHandle>();

async function getRedisOptionsForBullMQ(): Promise<RedisOptions> {
  const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
  const baseConfig = redisAuthMode === 'entra' ? await getRedisConfigAsync() : getRedisConfig();

  if (!baseConfig) {
    throw new Error('Redis is not configured for BullMQ');
  }

  return {
    ...baseConfig,
    // Match existing BullMQ behavior and redis.ts defaults for cloud reliability.
    keepAlive: 30_000,
    connectTimeout: 15_000,
    lazyConnect: true,
    // BullMQ requires null to avoid blocking worker startup failures.
    maxRetriesPerRequest: null,
  };
}

async function createBullMQRedisConnection(connectionLabel: string): Promise<Redis> {
  const existing = redisConnections.get(connectionLabel);
  if (existing) {
    return existing;
  }

  const redisOptions = await getRedisOptionsForBullMQ();
  const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';

  const connection = new Redis(redisOptions);

  let refreshHandle: EntraTokenRefreshHandle | null = null;
  attachRedisErrorObserver(connection, connectionLabel, () => {
    void refreshHandle?.refreshNow();
  });

  if (redisAuthMode === 'entra') {
    refreshHandle = await setupEntraTokenRefreshForClient(connection, connectionLabel);
    if (refreshHandle) {
      tokenRefreshHandles.set(connectionLabel, refreshHandle);
    }
  }

  await connection.connect();
  redisConnections.set(connectionLabel, connection);
  return connection;
}

// ==================== QUEUE REGISTRY ====================

/** All known queue names — single source of truth */
export enum QueueName {
  GDPR_EXPORT = 'gdpr-export',
  GDPR_CLEANUP = 'gdpr-cleanup',
  ORG_DELETION = 'org-deletion',
  ORG_DELETION_REMINDER = 'org-deletion-reminder',
  CAS_COMPUTATION = 'cas-computation',
  SESSION_CLEANUP = 'session-cleanup',
  TOKEN_CLEANUP = 'token-cleanup',
  EXPORT_CLEANUP = 'export-cleanup',
  BACKUP_CLEANUP = 'backup-cleanup',
  POLL_CLOSE = 'poll-close',
  INTEL_AUDIT_ROTATION = 'intel-audit-rotation',
  SHIP_DATA_FETCH = 'ship-data-fetch',
}

/** Default job options — retry 3 times with exponential backoff */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5s, 10s, 20s
  },
  removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
  removeOnFail: { count: 500 }, // Keep last 500 failed for debugging
};

// Track created queues and workers for graceful shutdown
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

// ==================== FACTORY FUNCTIONS ====================

/**
 * Create or retrieve a named queue.
 * Queues are cached — calling with the same name returns the same instance.
 */
export async function getQueue(name: QueueName): Promise<Queue> {
  const existing = queues.get(name);
  if (existing) {
    return existing;
  }

  // BullMQ bundles its own ioredis types, so we cast the runtime-compatible
  // client instance from our top-level ioredis import.
  const connection = (await createBullMQRedisConnection(
    `BullMQ queue ${name}`
  )) as unknown as ConnectionOptions;

  const queue = new Queue(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  queue.on('error', err => {
    logger.error(`Queue ${name} error`, sanitizeRedisErrorForLogging(err));
  });

  queues.set(name, queue);
  logger.debug(`Queue created: ${name}`);
  return queue;
}

/**
 * Create a worker that processes jobs from a queue.
 *
 * @param name Queue name to process
 * @param processor Job handler function
 * @param opts Worker options (concurrency, limiter, etc.)
 */
export async function createWorker<T = unknown>(
  name: QueueName,
  processor: (job: import('bullmq').Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>
): Promise<Worker<T>> {
  // BullMQ bundles its own ioredis types, so we cast the runtime-compatible
  // client instance from our top-level ioredis import.
  const connection = (await createBullMQRedisConnection(
    `BullMQ worker ${name}`
  )) as unknown as ConnectionOptions;

  const worker = new Worker<T>(name, processor, {
    connection,
    concurrency: 1, // Default: process one job at a time
    ...opts,
  });

  worker.on('completed', job => {
    logger.debug(`Job completed: ${name}/${job.id}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job failed: ${name}/${job?.id}`, {
      error: err.message,
      attemptsMade: job?.attemptsMade,
      attemptsTotal: job?.opts?.attempts,
    });
  });

  worker.on('error', err => {
    logger.error(`Worker ${name} error`, sanitizeRedisErrorForLogging(err));
  });

  workers.set(name, worker);
  logger.info(`Worker started: ${name} (concurrency: ${opts?.concurrency ?? 1})`);
  return worker;
}

// ==================== SCHEDULE HELPERS ====================

/**
 * Add a repeatable job to a queue (replaces `setInterval`/`node-cron`).
 *
 * @param queueName Queue to add the repeatable job to
 * @param jobName Unique name for this repeatable job
 * @param pattern Cron expression (e.g., '0 *​/6 * * *' for every 6h)
 * @param data Optional job data
 */
export async function addRepeatableJob<T = unknown>(
  queueName: QueueName,
  jobName: string,
  pattern: string,
  data?: T
): Promise<void> {
  const queue = await getQueue(queueName);
  await queue.add(jobName, data ?? ({} as T), {
    repeat: { pattern },
    jobId: jobName, // Ensures only one repeatable per name
  });
  logger.info(`Repeatable job scheduled: ${queueName}/${jobName} [${pattern}]`);
}

/**
 * Add a one-time job to a queue (event-driven trigger).
 */
export async function addJob<T = unknown>(
  queueName: QueueName,
  jobName: string,
  data: T,
  opts?: Partial<JobsOptions>
): Promise<void> {
  const queue = await getQueue(queueName);
  await queue.add(jobName, data, opts);
  logger.debug(`Job enqueued: ${queueName}/${jobName}`);
}

// ==================== LIFECYCLE ====================

/**
 * Gracefully shut down all queues and workers.
 * Call during process shutdown (SIGTERM handler).
 */
export async function shutdownQueues(): Promise<void> {
  logger.info(
    `Shutting down ${workers.size} workers, ${queues.size} queues, and ${redisConnections.size} BullMQ Redis connection(s)...`
  );

  // Close workers first (stop processing)
  const workerCloses = [...workers.values()].map(w => w.close().catch(() => {}));
  await Promise.all(workerCloses);

  // Then close queues
  const queueCloses = [...queues.values()].map(q => q.close().catch(() => {}));
  await Promise.all(queueCloses);

  // Stop Entra token refresh loops
  for (const handle of tokenRefreshHandles.values()) {
    handle.stop();
  }

  // Close dedicated BullMQ Redis clients
  const connectionCloses = [...redisConnections.values()].map(connection =>
    connection.quit().catch(() => {})
  );
  await Promise.all(connectionCloses);

  workers.clear();
  queues.clear();
  tokenRefreshHandles.clear();
  redisConnections.clear();
  logger.info('All queues and workers shut down.');
}

