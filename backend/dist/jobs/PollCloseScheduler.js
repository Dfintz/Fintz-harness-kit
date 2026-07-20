"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pollCloseScheduler = exports.PollCloseScheduler = void 0;
const cron = __importStar(require("node-cron"));
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const PollService_1 = require("../services/poll/PollService");
const logger_1 = require("../utils/logger");
class PollCloseScheduler {
    pollService;
    jobs = [];
    constructor() {
        this.pollService = new PollService_1.PollService();
    }
    start() {
        logger_1.logger.info('Starting poll close background jobs...');
        const closeJob = cron.schedule('*/5 * * * *', async () => {
            try {
                const lockedRun = await (0, DistributedJobLockService_1.withJobLock)('poll-close-scheduler', async () => this.pollService.closeExpiredPolls(), { ttlSeconds: 4 * 60 });
                if (!lockedRun.acquired) {
                    logger_1.logger.info('Skipping poll close run because another instance owns the lock', {
                        reason: lockedRun.reason,
                    });
                    return;
                }
                if (!lockedRun.executed) {
                    throw new Error(lockedRun.error ?? 'Poll close execution failed');
                }
                const closed = lockedRun.result ?? 0;
                if (closed > 0) {
                    logger_1.logger.info(`Auto-closed ${closed} expired polls`);
                }
            }
            catch (error) {
                logger_1.logger.error('Error closing expired polls:', error);
            }
        });
        this.jobs.push(closeJob);
        logger_1.logger.info('✓ Scheduled: Close expired polls (every 5 minutes)');
    }
    stop() {
        for (const job of this.jobs) {
            void job.stop();
        }
        this.jobs = [];
        logger_1.logger.info('Poll close background jobs stopped');
    }
    getStatus() {
        return [
            {
                name: 'Close expired polls',
                running: this.jobs.length > 0,
            },
        ];
    }
}
exports.PollCloseScheduler = PollCloseScheduler;
exports.pollCloseScheduler = new PollCloseScheduler();
//# sourceMappingURL=PollCloseScheduler.js.map