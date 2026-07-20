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
exports.ReportSchedulerJobClass = exports.ReportSchedulerJob = void 0;
const cron = __importStar(require("node-cron"));
const OrganizationAnalytics_1 = require("../models/OrganizationAnalytics");
const OrganizationAnalyticsService_1 = require("../services/organization/OrganizationAnalyticsService");
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
const SCHEDULES_KEY = 'report:schedules';
class ReportSchedulerJobClass {
    analyticsService;
    jobs = [];
    constructor() {
        this.analyticsService = new OrganizationAnalyticsService_1.OrganizationAnalyticsService();
    }
    start() {
        const job = cron.schedule('30 * * * *', async () => {
            try {
                await this.processScheduledReports();
            }
            catch (error) {
                logger_1.logger.error('ReportSchedulerJob: Failed to process scheduled reports', error);
            }
        });
        this.jobs.push(job);
        logger_1.logger.info('ReportSchedulerJob started (runs hourly at :30)');
    }
    stop() {
        for (const job of this.jobs) {
            void job.stop();
        }
        this.jobs.length = 0;
        logger_1.logger.info('ReportSchedulerJob stopped');
    }
    async processScheduledReports() {
        const schedules = await this.getAllSchedules();
        if (schedules.length === 0) {
            return;
        }
        for (const schedule of schedules) {
            if (!this.shouldRunNow(schedule.schedule)) {
                continue;
            }
            try {
                await this.analyticsService.generateAnalytics(schedule.organizationId, OrganizationAnalytics_1.AnalyticsPeriod.DAILY);
                logger_1.logger.info('ReportSchedulerJob: Generated scheduled report', {
                    organizationId: schedule.organizationId,
                    recipients: schedule.recipients.length,
                });
            }
            catch (error) {
                logger_1.logger.error('ReportSchedulerJob: Failed to generate report for org', {
                    organizationId: schedule.organizationId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    shouldRunNow(schedule) {
        const now = new Date();
        const hour = now.getUTCHours();
        switch (schedule.toLowerCase()) {
            case 'daily':
                return hour === 8;
            case 'weekly':
                return now.getUTCDay() === 1 && hour === 8;
            case 'monthly':
                return now.getUTCDate() === 1 && hour === 8;
            default:
                return cron.validate(schedule);
        }
    }
    static async saveSchedule(config) {
        const all = await ReportSchedulerJobClass.getAllSchedulesStatic();
        const idx = all.findIndex(s => s.organizationId === config.organizationId);
        if (idx >= 0) {
            all[idx] = config;
        }
        else {
            all.push(config);
        }
        await redis_1.cache.set(SCHEDULES_KEY, all);
    }
    static async getSchedule(organizationId) {
        const all = await ReportSchedulerJobClass.getAllSchedulesStatic();
        return all.find(s => s.organizationId === organizationId) ?? null;
    }
    static async getAllSchedulesStatic() {
        return (await redis_1.cache.get(SCHEDULES_KEY)) ?? [];
    }
    async getAllSchedules() {
        return ReportSchedulerJobClass.getAllSchedulesStatic();
    }
    getStatus() {
        return {
            running: this.jobs.length > 0,
            jobCount: this.jobs.length,
        };
    }
}
exports.ReportSchedulerJobClass = ReportSchedulerJobClass;
exports.ReportSchedulerJob = new ReportSchedulerJobClass();
//# sourceMappingURL=ReportSchedulerJob.js.map