"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobScheduler = exports.JobSchedulerService = exports.JobExecutionStatus = exports.JobCategory = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_cron_1 = __importDefault(require("node-cron"));
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
var JobCategory;
(function (JobCategory) {
    JobCategory["CLEANUP"] = "cleanup";
    JobCategory["SYNC"] = "sync";
    JobCategory["NOTIFICATION"] = "notification";
    JobCategory["ANALYTICS"] = "analytics";
    JobCategory["MAINTENANCE"] = "maintenance";
    JobCategory["SECURITY"] = "security";
    JobCategory["INTEGRATION"] = "integration";
    JobCategory["OTHER"] = "other";
})(JobCategory || (exports.JobCategory = JobCategory = {}));
var JobExecutionStatus;
(function (JobExecutionStatus) {
    JobExecutionStatus["PENDING"] = "pending";
    JobExecutionStatus["RUNNING"] = "running";
    JobExecutionStatus["COMPLETED"] = "completed";
    JobExecutionStatus["FAILED"] = "failed";
    JobExecutionStatus["RETRYING"] = "retrying";
    JobExecutionStatus["CANCELLED"] = "cancelled";
})(JobExecutionStatus || (exports.JobExecutionStatus = JobExecutionStatus = {}));
class JobSchedulerService {
    jobs = new Map();
    maxHistoryPerJob;
    isShuttingDown = false;
    constructor(options) {
        this.maxHistoryPerJob = options?.maxHistoryPerJob ?? 100;
    }
    registerJob(config) {
        if (this.jobs.has(config.id)) {
            throw new Error(`Job with id '${config.id}' is already registered`);
        }
        if (!node_cron_1.default.validate(config.cronExpression)) {
            throw new Error(`Invalid cron expression: ${config.cronExpression}`);
        }
        const registeredJob = {
            config: {
                ...config,
                enabled: config.enabled ?? true,
                maxRetries: config.maxRetries ?? 3,
                retryDelay: config.retryDelay ?? 5000,
                category: config.category ?? JobCategory.OTHER,
            },
            task: null,
            executionHistory: [],
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageDuration: 0,
            isRunning: false,
        };
        this.jobs.set(config.id, registeredJob);
        if (registeredJob.config.enabled) {
            this.scheduleJob(config.id);
        }
        logger_1.logger.info('Job registered', {
            jobId: config.id,
            name: config.name,
            cronExpression: config.cronExpression,
            enabled: registeredJob.config.enabled,
        });
        if (config.runOnStart && registeredJob.config.enabled) {
            setImmediate(() => {
                void this.executeJob(config.id);
            });
        }
    }
    unregisterJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        if (job.task) {
            void job.task.stop();
        }
        this.jobs.delete(jobId);
        logger_1.logger.info('Job unregistered', { jobId });
        return true;
    }
    scheduleJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return;
        }
        if (job.task) {
            void job.task.stop();
        }
        job.task = node_cron_1.default.schedule(job.config.cronExpression, () => {
            void this.executeJob(jobId);
        }, {
            timezone: job.config.timezone,
        });
    }
    async executeJob(jobId, manual = false) {
        const job = this.jobs.get(jobId);
        if (!job) {
            logger_1.logger.warn('Attempted to execute unknown job', { jobId });
            return null;
        }
        if (this.isShuttingDown) {
            logger_1.logger.debug('Skipping job execution during shutdown', { jobId });
            return null;
        }
        if (job.isRunning) {
            logger_1.logger.debug('Job is already running, skipping', { jobId });
            return null;
        }
        const execution = {
            id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            jobId,
            status: JobExecutionStatus.RUNNING,
            startedAt: new Date(),
            retryCount: 0,
            metadata: { manual },
        };
        job.isRunning = true;
        job.lastExecution = execution;
        logger_1.logger.info('Job execution started', {
            jobId,
            executionId: execution.id,
            manual,
        });
        try {
            await this.executeWithRetry(job, execution);
            execution.status = JobExecutionStatus.COMPLETED;
            execution.completedAt = new Date();
            execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
            job.successfulExecutions++;
            logger_1.logger.info('Job execution completed', {
                jobId,
                executionId: execution.id,
                duration: execution.duration,
            });
        }
        catch (error) {
            execution.status = JobExecutionStatus.FAILED;
            execution.completedAt = new Date();
            execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
            execution.error = (0, errorHandler_1.getErrorMessage)(error, 'Unknown error');
            job.failedExecutions++;
            logger_1.logger.error('Job execution failed', {
                jobId,
                executionId: execution.id,
                error: execution.error,
                retryCount: execution.retryCount,
            });
        }
        finally {
            job.isRunning = false;
            job.totalExecutions++;
            this.updateAverageDuration(job, execution.duration || 0);
            this.addToHistory(job, execution);
        }
        return execution;
    }
    async executeWithRetry(job, execution) {
        const maxRetries = job.config.maxRetries ?? 3;
        const retryDelay = job.config.retryDelay ?? 5000;
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await job.config.handler();
                return;
            }
            catch (error) {
                lastError = (0, errorHandler_1.isError)(error) ? error : new Error((0, errorHandler_1.getErrorMessage)(error));
                execution.retryCount = attempt;
                if (attempt < maxRetries) {
                    execution.status = JobExecutionStatus.RETRYING;
                    const backoffDelay = retryDelay * Math.pow(2, attempt);
                    const jitterMax = Math.floor(retryDelay * 0.5);
                    const jitter = node_crypto_1.default.randomInt(0, jitterMax + 1);
                    const totalDelay = Math.min(backoffDelay + jitter, 60000);
                    logger_1.logger.warn('Job execution failed, retrying', {
                        jobId: job.config.id,
                        attempt: attempt + 1,
                        maxRetries,
                        nextRetryMs: totalDelay,
                        error: (0, errorHandler_1.getErrorMessage)(error),
                    });
                    await this.delay(totalDelay);
                }
            }
        }
        throw lastError || new Error('Job failed after retries');
    }
    enableJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        job.config.enabled = true;
        this.scheduleJob(jobId);
        logger_1.logger.info('Job enabled', { jobId });
        return true;
    }
    disableJob(jobId) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        job.config.enabled = false;
        if (job.task) {
            void job.task.stop();
        }
        logger_1.logger.info('Job disabled', { jobId });
        return true;
    }
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    getAllJobs() {
        return Array.from(this.jobs.values());
    }
    getJobsByCategory(category) {
        return this.getAllJobs().filter(job => job.config.category === category);
    }
    getRunningJobs() {
        return this.getAllJobs().filter(job => job.isRunning);
    }
    updateCronExpression(jobId, cronExpression) {
        const job = this.jobs.get(jobId);
        if (!job) {
            return false;
        }
        if (!node_cron_1.default.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }
        job.config.cronExpression = cronExpression;
        if (job.config.enabled) {
            this.scheduleJob(jobId);
        }
        logger_1.logger.info('Job cron expression updated', { jobId, cronExpression });
        return true;
    }
    async stopAll() {
        this.isShuttingDown = true;
        logger_1.logger.info('Stopping all scheduled jobs');
        for (const [jobId, job] of this.jobs.entries()) {
            if (job.task) {
                void job.task.stop();
            }
            if (job.isRunning) {
                logger_1.logger.info('Waiting for running job to complete', { jobId });
                await this.waitForJobCompletion(jobId, 30000);
            }
        }
        logger_1.logger.info('All scheduled jobs stopped');
    }
    async waitForJobCompletion(jobId, timeout) {
        const job = this.jobs.get(jobId);
        if (!job?.isRunning) {
            return;
        }
        const startTime = Date.now();
        while (job.isRunning && Date.now() - startTime < timeout) {
            await this.delay(100);
        }
        if (job.isRunning) {
            logger_1.logger.warn('Job did not complete within timeout', { jobId, timeout });
        }
    }
    updateAverageDuration(job, duration) {
        if (job.totalExecutions === 0) {
            job.averageDuration = duration;
        }
        else {
            job.averageDuration = Math.round((job.averageDuration * (job.totalExecutions - 1) + duration) / job.totalExecutions);
        }
    }
    addToHistory(job, execution) {
        job.executionHistory.push(execution);
        if (job.executionHistory.length > this.maxHistoryPerJob) {
            job.executionHistory.shift();
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.JobSchedulerService = JobSchedulerService;
exports.jobScheduler = new JobSchedulerService();
//# sourceMappingURL=JobSchedulerService.js.map