"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscordWebhookEventService = void 0;
const logger_1 = require("../../utils/logger");
const DiscordAuditLogger_1 = require("../shared/DiscordAuditLogger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const GuildOrganizationService_1 = require("./GuildOrganizationService");
class DiscordWebhookEventService {
    static instance;
    guildOrgService;
    settingsService;
    constructor() {
        this.guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
        this.settingsService = new DiscordSettingsService_1.DiscordSettingsService();
    }
    static getInstance() {
        if (!DiscordWebhookEventService.instance) {
            DiscordWebhookEventService.instance = new DiscordWebhookEventService();
        }
        return DiscordWebhookEventService.instance;
    }
    async handleEvent(rawPayload) {
        const payload = rawPayload;
        const event = payload?.event;
        if (!event) {
            logger_1.logger.debug('Discord webhook event payload has no event body — ignoring');
            return;
        }
        const eventType = event.type;
        logger_1.logger.info(`Discord webhook event received: ${eventType}`);
        switch (eventType) {
            case 'APPLICATION_AUTHORIZED':
                await this.handleApplicationAuthorized(event.data);
                break;
            case 'APPLICATION_DEAUTHORIZED':
                this.handleApplicationDeauthorized(event.data);
                break;
            default:
                logger_1.logger.debug(`Unknown Discord webhook event type: ${eventType} — ignoring`);
        }
    }
    async handleApplicationAuthorized(data) {
        if (!data) {
            logger_1.logger.warn('APPLICATION_AUTHORIZED event has no data — skipping');
            return;
        }
        const userId = data.user?.id;
        const integrationType = data.integration_type;
        if (integrationType === 0 && data.guild) {
            const guild = data.guild;
            logger_1.logger.info(`Discord app authorized for guild: ${guild.id}`);
            try {
                const existingOrgId = await this.guildOrgService.resolveOrganization(guild.id);
                if (existingOrgId) {
                    await this.settingsService.getOrCreateSettings(existingOrgId, guild.id, guild.name);
                    logger_1.logger.info(`Guild ${guild.id} already mapped to org ${existingOrgId} — ensured settings exist`);
                    DiscordAuditLogger_1.discordAuditLogger.logAppAuthorized(existingOrgId, guild.id, guild.name, userId, integrationType);
                }
                else {
                    logger_1.logger.info(`Guild ${guild.id} authorized but no org mapping exists — ` +
                        'mapping will be created when user connects via platform');
                    DiscordAuditLogger_1.discordAuditLogger.logAppAuthorized('unknown', guild.id, guild.name, userId, integrationType);
                }
            }
            catch (error) {
                logger_1.logger.error('Failed to process APPLICATION_AUTHORIZED guild event', {
                    guildId: guild.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        else if (integrationType === 1) {
            logger_1.logger.info(`Discord app authorized by user (user-scoped install)`);
            DiscordAuditLogger_1.discordAuditLogger.logAppAuthorized('user-install', undefined, undefined, userId, integrationType);
        }
        else {
            logger_1.logger.debug('APPLICATION_AUTHORIZED with unknown integration_type', {
                integrationType,
            });
        }
    }
    handleApplicationDeauthorized(data) {
        if (!data) {
            logger_1.logger.warn('APPLICATION_DEAUTHORIZED event has no data — skipping');
            return;
        }
        const userId = data.user?.id;
        logger_1.logger.info('Discord app deauthorized by user');
        DiscordAuditLogger_1.discordAuditLogger.logAppDeauthorized(userId);
    }
}
exports.DiscordWebhookEventService = DiscordWebhookEventService;
//# sourceMappingURL=DiscordWebhookEventService.js.map