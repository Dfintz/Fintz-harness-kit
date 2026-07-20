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
exports.BackupSchedulerJob = void 0;
const cron = __importStar(require("node-cron"));
const BackupService_1 = require("../services/backup/BackupService");
const logger_1 = require("../utils/logger");
class BackupSchedulerJobClass {
    backupService;
    jobs = [];
    constructor() {
        this.backupService = new BackupService_1.BackupService();
    }
    start() {
        const cleanupJob = cron.schedule('0 */6 * * *', async () => {
            try {
                const count = await this.backupService.cleanupExpiredBackups();
                if (count > 0) {
                    logger_1.logger.info(`BackupSchedulerJob: Cleaned up ${count} expired backup(s)`);
                }
            }
            catch (error) {
                logger_1.logger.error('BackupSchedulerJob: Cleanup failed', error);
            }
        });
        this.jobs.push(cleanupJob);
        logger_1.logger.info('BackupSchedulerJob started (cleanup every 6 hours)');
    }
    stop() {
        for (const job of this.jobs) {
            void job.stop();
        }
        this.jobs.length = 0;
        logger_1.logger.info('BackupSchedulerJob stopped');
    }
    getStatus() {
        return {
            running: this.jobs.length > 0,
            jobCount: this.jobs.length,
        };
    }
}
let _instance = null;
exports.BackupSchedulerJob = {
    start() {
        if (!_instance) {
            _instance = new BackupSchedulerJobClass();
        }
        _instance.start();
    },
    stop() {
        _instance?.stop();
    },
    getStatus() {
        return _instance?.getStatus() ?? { running: false, jobCount: 0 };
    },
};
//# sourceMappingURL=BackupSchedulerJob.js.map