"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiCrawlerController = exports.RsiCrawlerController = void 0;
const database_1 = require("../config/database");
const rsiSyncScheduler_1 = require("../jobs/rsiSyncScheduler");
const RsiSyncSchedule_1 = require("../models/RsiSyncSchedule");
const RsiCrawlerDataService_1 = require("../services/external/RsiCrawlerDataService");
const RsiCrawlerService_1 = require("../services/external/RsiCrawlerService");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
class RsiCrawlerController {
    listOrganizations = async (req, res) => {
        try {
            const page = Number.parseInt(req.query.page) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit) || 20, 100);
            const offset = (page - 1) * limit;
            const { organizations, total } = await RsiCrawlerDataService_1.rsiCrawlerDataService.listOrganizations(limit, offset);
            res.status(200).json({
                data: organizations,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to list crawled organizations', { error });
            res.status(500).json({ error: 'Failed to list organizations' });
        }
    };
    getOrganization = async (req, res) => {
        try {
            const { sid } = req.params;
            const force = (0, queryUtils_1.parseBooleanQuery)(req.query.force);
            const org = await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreOrganization(sid, force);
            res.status(200).json(org);
        }
        catch (error) {
            logger_1.logger.error('Failed to get organization', { error });
            res.status(500).json({ error: 'Failed to get organization' });
        }
    };
    getOrganizationMembers = async (req, res) => {
        try {
            const { sid } = req.params;
            const force = (0, queryUtils_1.parseBooleanQuery)(req.query.force);
            const page = Number.parseInt(req.query.page) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit) || 100, 500);
            const offset = (page - 1) * limit;
            if (force) {
                await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreMembers(sid, true);
            }
            let { members, total } = await RsiCrawlerDataService_1.rsiCrawlerDataService.getMembers(sid, limit, offset);
            if (members.length === 0 && !force) {
                await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreMembers(sid, false);
                const result = await RsiCrawlerDataService_1.rsiCrawlerDataService.getMembers(sid, limit, offset);
                members = result.members;
                total = result.total;
            }
            res.status(200).json({
                data: members,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get organization members', { error });
            res.status(500).json({ error: 'Failed to get organization members' });
        }
    };
    getUserMemberships = async (req, res) => {
        try {
            const { handle } = req.params;
            const memberships = await RsiCrawlerDataService_1.rsiCrawlerDataService.getUserMemberships(handle);
            res.status(200).json(memberships);
        }
        catch (error) {
            logger_1.logger.error('Failed to get user memberships', { error });
            res.status(500).json({ error: 'Failed to get user memberships' });
        }
    };
    refreshOrganization = async (req, res) => {
        try {
            const { sid } = req.params;
            const includeMembers = req.body.includeMembers !== false;
            logger_1.logger.info('Manual refresh triggered for organization', { sid });
            const org = await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreOrganization(sid, true);
            let memberCount = 0;
            if (includeMembers) {
                const members = await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreMembers(sid, true);
                memberCount = members.length;
            }
            res
                .status(200)
                .json({ organization: org, membersCrawled: memberCount, refreshedAt: new Date() });
            if (includeMembers) {
                void this.runPostCrawlPipeline(sid);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh organization', { error });
            res.status(500).json({ error: 'Failed to refresh organization' });
        }
    };
    runPostCrawlPipeline = async (rsiOrgSid) => {
        const scheduleRepo = database_1.AppDataSource.getRepository(RsiSyncSchedule_1.RsiSyncSchedule);
        const schedule = await scheduleRepo.findOne({
            where: { rsiOrgSid },
            select: ['organizationId', 'guildId'],
        });
        if (!schedule) {
            logger_1.logger.debug(`No sync schedule found for SID ${rsiOrgSid}, skipping post-crawl pipeline`);
            return;
        }
        await (0, rsiSyncScheduler_1.runPostSyncIntel)(schedule.organizationId, schedule.guildId ?? undefined);
    };
    getStatistics = async (req, res) => {
        try {
            const stats = await RsiCrawlerDataService_1.rsiCrawlerDataService.getStatistics();
            const circuitStatus = RsiCrawlerService_1.rsiCrawlerService.getCircuitStatus();
            res.status(200).json({ ...stats, circuit: circuitStatus });
        }
        catch (error) {
            logger_1.logger.error('Failed to get crawler statistics', { error });
            res.status(500).json({ error: 'Failed to get statistics' });
        }
    };
    deleteOrganization = async (req, res) => {
        try {
            const { sid } = req.params;
            await RsiCrawlerDataService_1.rsiCrawlerDataService.deleteOrganization(sid);
            res.status(200).json({ message: `Organization ${sid} data deleted successfully` });
        }
        catch (error) {
            logger_1.logger.error('Failed to delete organization', { error });
            res.status(500).json({ error: 'Failed to delete organization' });
        }
    };
    clearCache = (_req, res) => {
        try {
            RsiCrawlerService_1.rsiCrawlerService.clearCache();
            res.status(200).json({ message: 'Cache cleared successfully' });
        }
        catch (error) {
            logger_1.logger.error('Failed to clear cache', { error });
            res.status(500).json({ error: 'Failed to clear cache' });
        }
    };
    getMemberCountHistory = async (req, res) => {
        try {
            const { sid } = req.params;
            const history = await RsiCrawlerDataService_1.rsiCrawlerDataService.getMemberCountHistory(sid);
            res.status(200).json({ data: history });
        }
        catch (error) {
            logger_1.logger.error('Failed to get member count history', { error });
            res.status(500).json({ error: 'Failed to get member count history' });
        }
    };
}
exports.RsiCrawlerController = RsiCrawlerController;
exports.rsiCrawlerController = new RsiCrawlerController();
//# sourceMappingURL=rsiCrawlerController.js.map