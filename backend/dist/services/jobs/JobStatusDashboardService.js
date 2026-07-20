"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStatusDashboardService = exports.JobAlertType = void 0;
exports.createJobStatusDashboard = createJobStatusDashboard;
const events_1 = require("events");
const logger_1 = require("../../utils/logger");
const JobSchedulerService_1 = require("./JobSchedulerService");
var JobAlertType;
(function (JobAlertType) {
    JobAlertType["CONSECUTIVE_FAILURES"] = "consecutive_failures";
    JobAlertType["HIGH_DURATION"] = "high_duration";
    JobAlertType["LOW_SUCCESS_RATE"] = "low_success_rate";
    JobAlertType["JOB_STUCK"] = "job_stuck";
    JobAlertType["MISSED_EXECUTION"] = "missed_execution";
})(JobAlertType || (exports.JobAlertType = JobAlertType = {}));
class JobStatusDashboardService extends events_1.EventEmitter {
    scheduler;
    alerts = new Map();
    alertIdCounter = 1;
    thresholds;
    monitoringInterval;
    lastExecutionCounts = new Map();
    constructor(scheduler, thresholds) {
        super();
        this.scheduler = scheduler;
        this.thresholds = {
            consecutiveFailures: thresholds?.consecutiveFailures ?? 3,
            durationMultiplier: thresholds?.durationMultiplier ?? 3,
            minSuccessRate: thresholds?.minSuccessRate ?? 0.8,
            stuckDurationMs: thresholds?.stuckDurationMs ?? 3600000,
        };
    }
    startMonitoring(intervalMs = 60000) {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.monitoringInterval = setInterval(() => {
            this.checkForAlerts();
        }, intervalMs);
        this.monitoringInterval.unref();
        logger_1.logger.info('Job monitoring started', { intervalMs });
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = undefined;
        }
        logger_1.logger.info('Job monitoring stopped');
    }
    getDashboardOverview() {
        const jobs = this.scheduler.getAllJobs();
        const statuses = jobs.map(job => this.getJobStatus(job));
        const healthySummary = {
            healthy: statuses.filter(s => s.health === 'healthy').length,
            degraded: statuses.filter(s => s.health === 'degraded').length,
            unhealthy: statuses.filter(s => s.health === 'unhealthy').length,
            unknown: statuses.filter(s => s.health === 'unknown').length,
        };
        const recentExecutions = this.getRecentExecutions(10);
        const upcomingJobs = jobs
            .filter(job => job.config.enabled)
            .map(job => ({
            jobId: job.config.id,
            name: job.config.name,
            nextRun: this.estimateNextRun(job),
        }))
            .filter((job) => job.nextRun !== null && job.nextRun !== undefined)
            .sort((a, b) => a.nextRun.getTime() - b.nextRun.getTime())
            .slice(0, 5);
        const activeAlerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
        return {
            timestamp: new Date(),
            totalJobs: jobs.length,
            enabledJobs: jobs.filter(j => j.config.enabled).length,
            disabledJobs: jobs.filter(j => !j.config.enabled).length,
            runningJobs: jobs.filter(j => j.isRunning).length,
            healthySummary,
            recentExecutions,
            upcomingJobs,
            alertCount: activeAlerts.length,
        };
    }
    getJobStatus(jobOrId) {
        const job = typeof jobOrId === 'string' ? this.scheduler.getJob(jobOrId) : jobOrId;
        if (!job) {
            throw new Error(`Job not found: ${jobOrId}`);
        }
        const successRate = job.totalExecutions > 0 ? job.successfulExecutions / job.totalExecutions : 1;
        return {
            jobId: job.config.id,
            name: job.config.name,
            category: job.config.category ?? JobSchedulerService_1.JobCategory.OTHER,
            enabled: job.config.enabled ?? true,
            isRunning: job.isRunning,
            lastExecution: job.lastExecution
                ? {
                    status: job.lastExecution.status,
                    startedAt: job.lastExecution.startedAt,
                    duration: job.lastExecution.duration,
                    error: job.lastExecution.error,
                }
                : undefined,
            nextRun: job.config.enabled ? this.estimateNextRun(job) : undefined,
            statistics: {
                totalExecutions: job.totalExecutions,
                successfulExecutions: job.successfulExecutions,
                failedExecutions: job.failedExecutions,
                successRate: Math.round(successRate * 10000) / 100,
                averageDuration: job.averageDuration,
            },
            health: this.calculateJobHealth(job),
        };
    }
    getAllJobStatuses() {
        return this.scheduler.getAllJobs().map(job => this.getJobStatus(job));
    }
    getJobStatusesByCategory(category) {
        return this.scheduler.getJobsByCategory(category).map(job => this.getJobStatus(job));
    }
    getJobExecutionHistory(jobId, limit) {
        const job = this.scheduler.getJob(jobId);
        if (!job) {
            return [];
        }
        const history = [...job.executionHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }
    getRecentExecutions(limit = 20) {
        const allExecutions = [];
        for (const job of this.scheduler.getAllJobs()) {
            allExecutions.push(...job.executionHistory);
        }
        return allExecutions
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);
    }
    getActiveAlerts() {
        return Array.from(this.alerts.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => {
            const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }
    getJobAlerts(jobId) {
        return Array.from(this.alerts.values())
            .filter(alert => alert.jobId === jobId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            return false;
        }
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;
        logger_1.logger.info('Alert acknowledged', { alertId, acknowledgedBy });
        return true;
    }
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (!alert) {
            return false;
        }
        alert.resolved = true;
        alert.resolvedAt = new Date();
        logger_1.logger.info('Alert resolved', { alertId });
        return true;
    }
    checkForAlerts() {
        for (const job of this.scheduler.getAllJobs()) {
            if (!job.config.enabled) {
                continue;
            }
            this.checkConsecutiveFailures(job);
            this.checkHighDuration(job);
            this.checkLowSuccessRate(job);
            this.checkStuckJob(job);
        }
    }
    checkConsecutiveFailures(job) {
        const recentExecutions = [...job.executionHistory]
            .reverse()
            .slice(0, this.thresholds.consecutiveFailures);
        const allFailed = recentExecutions.length >= this.thresholds.consecutiveFailures &&
            recentExecutions.every(e => e.status === JobSchedulerService_1.JobExecutionStatus.FAILED);
        if (allFailed) {
            this.createAlert(job, JobAlertType.CONSECUTIVE_FAILURES, 'high', `Job has failed ${this.thresholds.consecutiveFailures} times consecutively`);
        }
    }
    checkHighDuration(job) {
        if (!job.lastExecution?.duration) {
            return;
        }
        if (job.averageDuration === 0) {
            return;
        }
        const threshold = job.averageDuration * this.thresholds.durationMultiplier;
        if (job.lastExecution.duration > threshold) {
            this.createAlert(job, JobAlertType.HIGH_DURATION, 'medium', `Job took ${job.lastExecution.duration}ms (${this.thresholds.durationMultiplier}x average)`);
        }
    }
    checkLowSuccessRate(job) {
        if (job.totalExecutions < 10) {
            return;
        }
        const successRate = job.successfulExecutions / job.totalExecutions;
        if (successRate < this.thresholds.minSuccessRate) {
            this.createAlert(job, JobAlertType.LOW_SUCCESS_RATE, 'high', `Job success rate is ${(successRate * 100).toFixed(1)}% (below ${this.thresholds.minSuccessRate * 100}%)`);
        }
    }
    checkStuckJob(job) {
        if (!job.isRunning || !job.lastExecution) {
            return;
        }
        const runningTime = Date.now() - job.lastExecution.startedAt.getTime();
        if (runningTime > this.thresholds.stuckDurationMs) {
            this.createAlert(job, JobAlertType.JOB_STUCK, 'critical', `Job has been running for ${Math.round(runningTime / 60000)} minutes`);
        }
    }
    createAlert(job, type, severity, message) {
        const existingAlert = Array.from(this.alerts.values()).find(alert => alert.jobId === job.config.id && alert.type === type && !alert.resolved);
        if (existingAlert) {
            return;
        }
        const alert = {
            id: `alert-${this.alertIdCounter++}`,
            jobId: job.config.id,
            type,
            severity,
            message,
            createdAt: new Date(),
            resolved: false,
        };
        this.alerts.set(alert.id, alert);
        logger_1.logger.warn('Job alert created', {
            alertId: alert.id,
            jobId: job.config.id,
            type,
            severity,
            message,
        });
        this.emit('alert', alert);
    }
    calculateJobHealth(job) {
        if (job.totalExecutions === 0) {
            return 'unknown';
        }
        const successRate = job.successfulExecutions / job.totalExecutions;
        if (job.lastExecution?.status === JobSchedulerService_1.JobExecutionStatus.FAILED) {
            return 'degraded';
        }
        if (job.isRunning && job.lastExecution) {
            const runningTime = Date.now() - job.lastExecution.startedAt.getTime();
            if (runningTime > this.thresholds.stuckDurationMs) {
                return 'unhealthy';
            }
        }
        if (successRate < 0.5) {
            return 'unhealthy';
        }
        else if (successRate < this.thresholds.minSuccessRate) {
            return 'degraded';
        }
        return 'healthy';
    }
    estimateNextRun(job) {
        if (!job.config.enabled || !job.lastExecution) {
            return undefined;
        }
        return new Date(job.lastExecution.startedAt.getTime() + 3600000);
    }
    getJobPerformanceTrends(jobId, periodMinutes = 60) {
        const job = this.scheduler.getJob(jobId);
        if (!job) {
            return [];
        }
        const periodMs = periodMinutes * 60 * 1000;
        const periods = new Map();
        for (const execution of job.executionHistory) {
            const periodStart = Math.floor(execution.startedAt.getTime() / periodMs) * periodMs;
            const periodKey = new Date(periodStart).toISOString();
            const existing = periods.get(periodKey) || {
                count: 0,
                success: 0,
                failure: 0,
                totalDuration: 0,
            };
            existing.count++;
            if (execution.status === JobSchedulerService_1.JobExecutionStatus.COMPLETED) {
                existing.success++;
            }
            else if (execution.status === JobSchedulerService_1.JobExecutionStatus.FAILED) {
                existing.failure++;
            }
            existing.totalDuration += execution.duration || 0;
            periods.set(periodKey, existing);
        }
        return Array.from(periods.entries())
            .map(([period, data]) => ({
            period,
            executionCount: data.count,
            successCount: data.success,
            failureCount: data.failure,
            avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0,
        }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }
}
exports.JobStatusDashboardService = JobStatusDashboardService;
function createJobStatusDashboard(scheduler, thresholds) {
    return new JobStatusDashboardService(scheduler, thresholds);
}
//# sourceMappingURL=JobStatusDashboardService.js.map