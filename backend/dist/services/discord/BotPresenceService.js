"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotPresenceService = void 0;
const discord_js_1 = require("discord.js");
const database_1 = require("../../config/database");
const Federation_1 = require("../../models/Federation");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const User_1 = require("../../models/User");
const logger_1 = require("../../utils/logger");
const RsiStatusService_1 = require("../external/RsiStatusService");
const OpportunitySearchService_1 = require("../search/OpportunitySearchService");
const PRESENCE_REFRESH_INTERVAL = 5 * 60 * 1000;
const STAT_LINES = ['users', 'orgs', 'federations', 'opportunities', 'rsiServerStatus'];
const RSI_SERVER_COMPONENT_LABEL = 'Persistent Universe';
class BotPresenceService {
    static instance;
    client = null;
    refreshInterval = null;
    currentIndex = 0;
    cachedStats = {
        users: 0,
        orgs: 0,
        federations: 0,
        opportunities: 0,
        rsiServerStatus: 'Unknown',
    };
    opportunitySearchService = null;
    static getInstance() {
        if (!BotPresenceService.instance) {
            BotPresenceService.instance = new BotPresenceService();
        }
        return BotPresenceService.instance;
    }
    initialize(client) {
        this.client = client;
        setTimeout(() => void this.refreshPresence(), 10_000);
        this.refreshInterval = setInterval(() => {
            void this.refreshPresence();
        }, PRESENCE_REFRESH_INTERVAL);
        logger_1.logger.info('🤖 BotPresenceService initialized — rotating platform stats');
    }
    shutdown() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        logger_1.logger.info('🤖 BotPresenceService shut down');
    }
    getOpportunitySearchService() {
        this.opportunitySearchService ??= new OpportunitySearchService_1.OpportunitySearchService();
        return this.opportunitySearchService;
    }
    async refreshPresence() {
        try {
            await this.fetchStats();
        }
        catch (err) {
            logger_1.logger.warn('BotPresenceService: Failed to fetch platform stats (non-fatal)', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        try {
            await this.fetchRsiServerStatus();
        }
        catch (err) {
            logger_1.logger.warn('BotPresenceService: Failed to fetch RSI server status (non-fatal)', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        this.setPresence();
        this.currentIndex = (this.currentIndex + 1) % STAT_LINES.length;
    }
    async fetchStats() {
        if (!database_1.AppDataSource.isInitialized) {
            return;
        }
        const [users, orgs, federations, opportunities] = await Promise.all([
            database_1.AppDataSource.getRepository(User_1.User).count(),
            database_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile).count({ where: { isPublic: true } }),
            database_1.AppDataSource.getRepository(Federation_1.Federation).count({ where: { isPublic: true } }),
            this.getOpportunitySearchService().countOpportunities(),
        ]);
        this.cachedStats = { ...this.cachedStats, users, orgs, federations, opportunities };
    }
    async fetchRsiServerStatus() {
        const status = await RsiStatusService_1.rsiStatusService.getStatus();
        const server = status.components.find(component => component.name.toLowerCase() === RSI_SERVER_COMPONENT_LABEL.toLowerCase());
        const normalizedStatus = server?.status?.trim();
        this.cachedStats = {
            ...this.cachedStats,
            rsiServerStatus: normalizedStatus && normalizedStatus.length > 0 ? normalizedStatus : 'Unknown',
        };
    }
    setPresence() {
        if (!this.client?.user) {
            return;
        }
        const line = STAT_LINES[this.currentIndex];
        const text = this.formatStatLine(line);
        this.client.user.setPresence({
            status: 'online',
            activities: [
                {
                    name: text,
                    type: discord_js_1.ActivityType.Watching,
                },
            ],
        });
    }
    formatStatLine(line) {
        const s = this.cachedStats;
        switch (line) {
            case 'users':
                return `${s.users.toLocaleString()} pilots`;
            case 'orgs':
                return `${s.orgs.toLocaleString()} organizations`;
            case 'federations':
                return `${s.federations.toLocaleString()} federations`;
            case 'opportunities':
                return `${s.opportunities.toLocaleString()} open opportunities`;
            case 'rsiServerStatus':
                return `${RSI_SERVER_COMPONENT_LABEL}: ${s.rsiServerStatus}`;
        }
    }
}
exports.BotPresenceService = BotPresenceService;
//# sourceMappingURL=BotPresenceService.js.map