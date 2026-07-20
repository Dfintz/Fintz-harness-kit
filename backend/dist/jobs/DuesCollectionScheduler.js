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
exports.DuesCollectionScheduler = void 0;
const cron = __importStar(require("node-cron"));
const logger_1 = require("../utils/logger");
const DuesCollectionJobAdapter_1 = require("./adapters/DuesCollectionJobAdapter");
class DuesCollectionScheduler {
    duesJobAdapter;
    jobs = [];
    constructor() {
        this.duesJobAdapter = new DuesCollectionJobAdapter_1.DuesCollectionJobAdapter();
    }
    start() {
        logger_1.logger.info('Starting dues collection background jobs...');
        const collectJob = cron.schedule('0 0 * * *', async () => {
            try {
                await this.duesJobAdapter.runDailyCollection();
            }
            catch (error) {
                logger_1.logger.error('Error during dues collection:', error);
            }
        }, { timezone: 'UTC' });
        this.jobs.push(collectJob);
        logger_1.logger.info('✓ Scheduled: Dues collection (daily at 00:00 UTC)');
    }
    stop() {
        for (const job of this.jobs) {
            void job.stop();
        }
        this.jobs = [];
        logger_1.logger.info('Dues collection background jobs stopped');
    }
}
exports.DuesCollectionScheduler = DuesCollectionScheduler;
//# sourceMappingURL=DuesCollectionScheduler.js.map