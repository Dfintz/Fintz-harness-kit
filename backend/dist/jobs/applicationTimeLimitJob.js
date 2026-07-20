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
exports.ApplicationTimeLimitJob = void 0;
const cron = __importStar(require("node-cron"));
const typeorm_1 = require("typeorm");
const database_1 = require("../config/database");
const DiscordGuildSettings_1 = require("../models/DiscordGuildSettings");
const OrgApplication_1 = require("../models/OrgApplication");
const logger_1 = require("../utils/logger");
const query_1 = require("../utils/query");
class ApplicationTimeLimitJob {
    jobs = [];
    start() {
        logger_1.logger.info('Starting application time-limit background job...');
        const job = cron.schedule('*/5 * * * *', async () => {
            try {
                await this.processExpiredApplications();
            }
            catch (error) {
                logger_1.logger.error('Error processing expired applications:', error);
            }
        });
        this.jobs.push(job);
        logger_1.logger.info('✓ Scheduled: Auto-cancel expired applications (every 5 minutes)');
    }
    stop() {
        for (const job of this.jobs) {
            void job.stop();
        }
        this.jobs = [];
    }
    async processExpiredApplications() {
        if (!database_1.AppDataSource.isInitialized) {
            return;
        }
        const settingsRepo = database_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
        const appRepo = database_1.AppDataSource.getRepository(OrgApplication_1.OrgApplication);
        await (0, query_1.findInBatches)(settingsRepo, {}, async (batch) => {
            for (const settings of batch) {
                const limitMinutes = settings.recruitmentSettings?.applicationTimeLimitMinutes;
                if (!limitMinutes || limitMinutes <= 0) {
                    continue;
                }
                const cutoff = new Date(Date.now() - limitMinutes * 60 * 1000);
                const expired = await appRepo.find({
                    where: {
                        organizationId: settings.organizationId,
                        status: OrgApplication_1.OrgApplicationStatus.PENDING,
                        createdAt: (0, typeorm_1.LessThan)(cutoff),
                    },
                });
                if (expired.length === 0) {
                    continue;
                }
                for (const app of expired) {
                    app.status = OrgApplication_1.OrgApplicationStatus.REJECTED;
                    app.reviewNote = `Auto-cancelled: application exceeded ${limitMinutes}-minute time limit`;
                    app.reviewedAt = new Date();
                    app.reviewedBy = 'system:time-limit';
                    await appRepo.save(app);
                }
                logger_1.logger.info(`Auto-cancelled ${expired.length} expired application(s) for org ${settings.organizationId} (limit: ${limitMinutes}min)`);
            }
        });
    }
}
exports.ApplicationTimeLimitJob = ApplicationTimeLimitJob;
//# sourceMappingURL=applicationTimeLimitJob.js.map