"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleDailyUtcJob = scheduleDailyUtcJob;
exports.scheduleFixedIntervalJob = scheduleFixedIntervalJob;
const logger_1 = require("../utils/logger");
const DAY_MS = 24 * 60 * 60 * 1000;
function createGuardedExecutor(options) {
    let isRunning = false;
    return async (trigger) => {
        if (isRunning) {
            logger_1.logger.info(`${options.jobName} skipped because previous run is still active`, { trigger });
            return;
        }
        isRunning = true;
        try {
            await options.run();
        }
        catch (error) {
            logger_1.logger.error(`${options.jobName} failed`, {
                trigger,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            isRunning = false;
        }
    };
}
function scheduleDailyUtcJob(options) {
    const minuteUtc = options.minuteUtc ?? 0;
    const execute = createGuardedExecutor({
        jobName: options.jobName,
        run: options.run,
    });
    if (options.runOnStartup) {
        void execute('startup');
    }
    const now = new Date();
    const nextRun = new Date();
    nextRun.setUTCHours(options.hourUtc, minuteUtc, 0, 0);
    if (now > nextRun) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    const msUntilNextRun = nextRun.getTime() - now.getTime();
    logger_1.logger.info(`${options.jobName} scheduled`, {
        nextRunAt: nextRun.toISOString(),
        cadence: 'daily',
    });
    let intervalId = null;
    const timeoutId = setTimeout(() => {
        void execute('scheduled');
        intervalId = setInterval(() => {
            void execute('scheduled');
        }, DAY_MS);
        intervalId.unref();
    }, msUntilNextRun);
    timeoutId.unref();
    return {
        cleanup: () => {
            clearTimeout(timeoutId);
            if (intervalId) {
                clearInterval(intervalId);
            }
            logger_1.logger.info(`${options.jobName} stopped`);
        },
    };
}
function scheduleFixedIntervalJob(options) {
    const execute = createGuardedExecutor({
        jobName: options.jobName,
        run: options.run,
    });
    if (options.runOnStartup) {
        void execute('startup');
    }
    const interval = setInterval(() => {
        void execute('scheduled');
    }, options.intervalMs);
    interval.unref();
    logger_1.logger.info(`${options.jobName} scheduled`, {
        cadence: 'fixed-interval',
        intervalMs: options.intervalMs,
    });
    return {
        cleanup: () => {
            clearInterval(interval);
            logger_1.logger.info(`${options.jobName} stopped`);
        },
    };
}
//# sourceMappingURL=jobSchedulerHelper.js.map