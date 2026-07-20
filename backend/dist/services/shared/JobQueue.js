"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueName = void 0;
exports.getQueue = getQueue;
exports.createWorker = createWorker;
exports.addRepeatableJob = addRepeatableJob;
exports.addJob = addJob;
exports.shutdownQueues = shutdownQueues;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const redisConnections = new Map();
const tokenRefreshHandles = new Map();
async function getRedisOptionsForBullMQ() {
    const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
    const baseConfig = redisAuthMode === 'entra' ? await (0, redis_1.getRedisConfigAsync)() : (0, redis_1.getRedisConfig)();
    if (!baseConfig) {
        throw new Error('Redis is not configured for BullMQ');
    }
    return {
        ...baseConfig,
        keepAlive: 30_000,
        connectTimeout: 15_000,
        lazyConnect: true,
        maxRetriesPerRequest: null,
    };
}
async function createBullMQRedisConnection(connectionLabel) {
    const existing = redisConnections.get(connectionLabel);
    if (existing) {
        return existing;
    }
    const redisOptions = await getRedisOptionsForBullMQ();
    const redisAuthMode = process.env.REDIS_AUTH_MODE ?? 'key';
    const connection = new ioredis_1.default(redisOptions);
    let refreshHandle = null;
    (0, redis_1.attachRedisErrorObserver)(connection, connectionLabel, () => {
        void refreshHandle?.refreshNow();
    });
    if (redisAuthMode === 'entra') {
        refreshHandle = await (0, redis_1.setupEntraTokenRefreshForClient)(connection, connectionLabel);
        if (refreshHandle) {
            tokenRefreshHandles.set(connectionLabel, refreshHandle);
        }
    }
    await connection.connect();
    redisConnections.set(connectionLabel, connection);
    return connection;
}
var QueueName;
(function (QueueName) {
    QueueName["GDPR_EXPORT"] = "gdpr-export";
    QueueName["GDPR_CLEANUP"] = "gdpr-cleanup";
    QueueName["ORG_DELETION"] = "org-deletion";
    QueueName["ORG_DELETION_REMINDER"] = "org-deletion-reminder";
    QueueName["CAS_COMPUTATION"] = "cas-computation";
    QueueName["SESSION_CLEANUP"] = "session-cleanup";
    QueueName["TOKEN_CLEANUP"] = "token-cleanup";
    QueueName["EXPORT_CLEANUP"] = "export-cleanup";
    QueueName["BACKUP_CLEANUP"] = "backup-cleanup";
    QueueName["POLL_CLOSE"] = "poll-close";
    QueueName["INTEL_AUDIT_ROTATION"] = "intel-audit-rotation";
    QueueName["SHIP_DATA_FETCH"] = "ship-data-fetch";
})(QueueName || (exports.QueueName = QueueName = {}));
const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
};
const queues = new Map();
const workers = new Map();
async function getQueue(name) {
    const existing = queues.get(name);
    if (existing) {
        return existing;
    }
    const connection = (await createBullMQRedisConnection(`BullMQ queue ${name}`));
    const queue = new bullmq_1.Queue(name, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queue.on('error', err => {
        logger_1.logger.error(`Queue ${name} error`, (0, redis_1.sanitizeRedisErrorForLogging)(err));
    });
    queues.set(name, queue);
    logger_1.logger.debug(`Queue created: ${name}`);
    return queue;
}
async function createWorker(name, processor, opts) {
    const connection = (await createBullMQRedisConnection(`BullMQ worker ${name}`));
    const worker = new bullmq_1.Worker(name, processor, {
        connection,
        concurrency: 1,
        ...opts,
    });
    worker.on('completed', job => {
        logger_1.logger.debug(`Job completed: ${name}/${job.id}`);
    });
    worker.on('failed', (job, err) => {
        logger_1.logger.error(`Job failed: ${name}/${job?.id}`, {
            error: err.message,
            attemptsMade: job?.attemptsMade,
            attemptsTotal: job?.opts?.attempts,
        });
    });
    worker.on('error', err => {
        logger_1.logger.error(`Worker ${name} error`, (0, redis_1.sanitizeRedisErrorForLogging)(err));
    });
    workers.set(name, worker);
    logger_1.logger.info(`Worker started: ${name} (concurrency: ${opts?.concurrency ?? 1})`);
    return worker;
}
async function addRepeatableJob(queueName, jobName, pattern, data) {
    const queue = await getQueue(queueName);
    await queue.add(jobName, data ?? {}, {
        repeat: { pattern },
        jobId: jobName,
    });
    logger_1.logger.info(`Repeatable job scheduled: ${queueName}/${jobName} [${pattern}]`);
}
async function addJob(queueName, jobName, data, opts) {
    const queue = await getQueue(queueName);
    await queue.add(jobName, data, opts);
    logger_1.logger.debug(`Job enqueued: ${queueName}/${jobName}`);
}
async function shutdownQueues() {
    logger_1.logger.info(`Shutting down ${workers.size} workers, ${queues.size} queues, and ${redisConnections.size} BullMQ Redis connection(s)...`);
    const workerCloses = [...workers.values()].map(w => w.close().catch(() => { }));
    await Promise.all(workerCloses);
    const queueCloses = [...queues.values()].map(q => q.close().catch(() => { }));
    await Promise.all(queueCloses);
    for (const handle of tokenRefreshHandles.values()) {
        handle.stop();
    }
    const connectionCloses = [...redisConnections.values()].map(connection => connection.quit().catch(() => { }));
    await Promise.all(connectionCloses);
    workers.clear();
    queues.clear();
    tokenRefreshHandles.clear();
    redisConnections.clear();
    logger_1.logger.info('All queues and workers shut down.');
}
//# sourceMappingURL=JobQueue.js.map