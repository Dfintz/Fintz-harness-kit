"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminJobRegistry = exports.AdminJobRegistry = void 0;
const node_util_1 = require("node:util");
const logger_1 = require("../../utils/logger");
const MAX_HISTORY = 50;
function formatUnknownError(error) {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return (0, node_util_1.inspect)(error, { depth: 2, breakLength: Infinity });
}
class AdminJobRegistry {
    static instance;
    jobs = new Map();
    constructor() { }
    static getInstance() {
        if (!AdminJobRegistry.instance) {
            AdminJobRegistry.instance = new AdminJobRegistry();
        }
        return AdminJobRegistry.instance;
    }
    registerJob(config) {
        if (this.jobs.has(config.id)) {
            logger_1.logger.warn('Job already registered, skipping', { jobId: config.id });
            return;
        }
        this.jobs.set(config.id, {
            config,
            enabled: config.enabled ?? true,
            isRunning: false,
            executionHistory: [],
            totalExecutions: 0,
            successfulExecutions: 0,
            skippedExecutions: 0,
            failedExecutions: 0,
            totalDuration: 0,
        });
        logger_1.logger.info('Job registered in admin registry', {
            jobId: config.id,
            name: config.name,
            category: config.category,
        });
    }
    getAllJobs() {
        return Array.from(this.jobs.values()).map(entry => this.toInfo(entry));
    }
    getJob(jobId) {
        const entry = this.jobs.get(jobId);
        return entry ? this.toInfo(entry) : undefined;
    }
    async triggerJob(jobId) {
        const entry = this.jobs.get(jobId);
        if (!entry) {
            throw new Error(`Job '${jobId}' not found in registry`);
        }
        if (entry.isRunning) {
            throw new Error(`Job '${jobId}' is already running`);
        }
        const execution = {
            startedAt: new Date(),
            success: false,
            outcome: 'executed',
            manual: true,
        };
        entry.isRunning = true;
        logger_1.logger.info('Manual job trigger started', { jobId, name: entry.config.name });
        try {
            const handlerResult = await entry.config.handler();
            if (handlerResult && typeof handlerResult === 'object') {
                execution.outcome = handlerResult.outcome ?? 'executed';
                execution.outcomeReason = handlerResult.reason;
                execution.details = handlerResult.details;
            }
            execution.success = true;
            execution.completedAt = new Date();
            execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
            if (execution.outcome === 'skipped') {
                entry.skippedExecutions++;
                logger_1.logger.info('Manual job trigger skipped', {
                    jobId,
                    duration: execution.duration,
                    reason: execution.outcomeReason,
                });
            }
            else {
                entry.successfulExecutions++;
                logger_1.logger.info('Manual job trigger completed', {
                    jobId,
                    duration: execution.duration,
                });
            }
        }
        catch (error) {
            execution.success = false;
            execution.completedAt = new Date();
            execution.duration = execution.completedAt.getTime() - execution.startedAt.getTime();
            execution.error = formatUnknownError(error);
            entry.failedExecutions++;
            logger_1.logger.error('Manual job trigger failed', {
                jobId,
                error: execution.error,
            });
        }
        finally {
            entry.isRunning = false;
            entry.totalExecutions++;
            entry.totalDuration += execution.duration ?? 0;
            entry.lastExecution = execution;
            entry.executionHistory.push(execution);
            if (entry.executionHistory.length > MAX_HISTORY) {
                entry.executionHistory.shift();
            }
        }
        return execution;
    }
    enableJob(jobId) {
        const entry = this.jobs.get(jobId);
        if (!entry) {
            return false;
        }
        entry.enabled = true;
        logger_1.logger.info('Job enabled via admin', { jobId });
        return true;
    }
    disableJob(jobId) {
        const entry = this.jobs.get(jobId);
        if (!entry) {
            return false;
        }
        entry.enabled = false;
        logger_1.logger.info('Job disabled via admin', { jobId });
        return true;
    }
    isJobEnabled(jobId) {
        const entry = this.jobs.get(jobId);
        return entry ? entry.enabled : true;
    }
    recordExecution(jobId, success, duration, error) {
        const entry = this.jobs.get(jobId);
        if (!entry) {
            return;
        }
        const execution = {
            startedAt: new Date(Date.now() - duration),
            completedAt: new Date(),
            duration,
            success,
            outcome: 'executed',
            error,
            manual: false,
        };
        entry.totalExecutions++;
        entry.totalDuration += duration;
        if (success) {
            entry.successfulExecutions++;
        }
        else {
            entry.failedExecutions++;
        }
        entry.lastExecution = execution;
        entry.executionHistory.push(execution);
        if (entry.executionHistory.length > MAX_HISTORY) {
            entry.executionHistory.shift();
        }
    }
    toInfo(entry) {
        const successRate = entry.totalExecutions - entry.skippedExecutions > 0
            ? Math.round((entry.successfulExecutions / (entry.totalExecutions - entry.skippedExecutions)) * 10000) / 100
            : 100;
        const averageDuration = entry.totalExecutions > 0 ? Math.round(entry.totalDuration / entry.totalExecutions) : 0;
        return {
            id: entry.config.id,
            name: entry.config.name,
            description: entry.config.description,
            category: entry.config.category,
            schedule: entry.config.schedule,
            enabled: entry.enabled,
            isRunning: entry.isRunning,
            lastExecution: entry.lastExecution,
            statistics: {
                totalExecutions: entry.totalExecutions,
                successfulExecutions: entry.successfulExecutions,
                skippedExecutions: entry.skippedExecutions,
                failedExecutions: entry.failedExecutions,
                successRate,
                averageDuration,
            },
        };
    }
}
exports.AdminJobRegistry = AdminJobRegistry;
exports.adminJobRegistry = AdminJobRegistry.getInstance();
//# sourceMappingURL=AdminJobRegistry.js.map