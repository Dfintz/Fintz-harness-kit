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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketAutomationJob = exports.TicketAutomationService = exports.DEFAULT_AUTOMATION_RULES = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Ticket_1 = require("../../models/Ticket");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const DmNotificationService_1 = require("./DmNotificationService");
const TicketTranscriptService_1 = require("./TicketTranscriptService");
exports.DEFAULT_AUTOMATION_RULES = {
    autoCloseInactiveHours: 0,
    autoDeleteResolvedDays: 0,
    autoEscalateHours: 0,
    notifyOnAutoClose: true,
    notifyOnAutoEscalate: true,
};
class TicketAutomationService {
    static instance;
    repo;
    client = null;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(Ticket_1.Ticket);
    }
    static getInstance() {
        if (!TicketAutomationService.instance) {
            TicketAutomationService.instance = new TicketAutomationService();
        }
        return TicketAutomationService.instance;
    }
    initialize(client) {
        this.client = client;
    }
    async runForGuild(organizationId, guildId, rules) {
        const result = {
            autoClosed: 0,
            autoEscalated: 0,
            autoDeleted: 0,
            errors: [],
        };
        try {
            if (rules.autoCloseInactiveHours && rules.autoCloseInactiveHours > 0) {
                result.autoClosed = await this.autoCloseInactive(organizationId, guildId, rules.autoCloseInactiveHours, rules.notifyOnAutoClose !== false);
            }
            if (rules.autoEscalateHours && rules.autoEscalateHours > 0) {
                result.autoEscalated = await this.autoEscalateUnresponded(organizationId, guildId, rules.autoEscalateHours, rules.notifyOnAutoEscalate !== false);
            }
            if (rules.autoDeleteResolvedDays && rules.autoDeleteResolvedDays > 0) {
                result.autoDeleted = await this.autoDeleteResolved(organizationId, rules.autoDeleteResolvedDays);
            }
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            result.errors.push(msg);
            logger_1.logger.error(`TicketAutomationService: Error for guild ${guildId}:`, error);
        }
        return result;
    }
    async autoCloseInactive(organizationId, guildId, inactiveHours, notify) {
        const cutoff = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);
        const tickets = await this.repo.find({
            where: [
                { organizationId, status: Ticket_1.TicketStatus.OPEN },
                { organizationId, status: Ticket_1.TicketStatus.AWAITING_RESPONSE },
            ],
        });
        let closed = 0;
        for (const ticket of tickets) {
            const lastActivity = this.getLastActivityDate(ticket);
            if (lastActivity >= cutoff) {
                continue;
            }
            ticket.status = Ticket_1.TicketStatus.CLOSED;
            ticket.tags = [...(ticket.tags || []), 'auto-closed'];
            await this.repo.save(ticket);
            closed++;
            const transcriptService = TicketTranscriptService_1.TicketTranscriptService.getInstance();
            const settingsService = new DiscordSettingsService_1.DiscordSettingsService();
            const settings = await settingsService.getSettings(organizationId, guildId);
            if (settings?.ticketSettings?.transcriptChannelId) {
                const transcript = transcriptService.generateTranscript(ticket.ticketNumber, ticket.subject, ticket.category, ticket.creatorName, ticket.createdAt, ticket.messages || []);
                void transcriptService.postToChannel(settings.ticketSettings.transcriptChannelId, transcript);
            }
            if (notify && ticket.creatorDiscordId) {
                const dmService = DmNotificationService_1.DmNotificationService.getInstance();
                const embed = dmService.buildTicketClosedEmbed(ticket.ticketNumber, 'Auto-closed due to inactivity');
                void dmService.sendNotifications({
                    eventType: DmNotificationService_1.DmEventType.TICKET_CLOSED,
                    recipientDiscordIds: [ticket.creatorDiscordId],
                    embed,
                    guildId,
                });
            }
            if (notify && ticket.discordChannelId && this.client) {
                void this.postChannelNotice(ticket.discordChannelId, `🔒 Ticket **${ticket.ticketNumber}** was auto-closed after ${inactiveHours}h of inactivity.`);
            }
        }
        return closed;
    }
    async autoEscalateUnresponded(organizationId, guildId, escalateHours, notify) {
        const cutoff = new Date(Date.now() - escalateHours * 60 * 60 * 1000);
        const tickets = await this.repo.find({
            where: { organizationId, status: Ticket_1.TicketStatus.OPEN },
        });
        let escalated = 0;
        for (const ticket of tickets) {
            if (ticket.tags?.includes('escalated')) {
                continue;
            }
            const hasStaffReply = (ticket.messages || []).some(m => m.authorId !== ticket.creatorId && !m.isInternal);
            if (hasStaffReply) {
                continue;
            }
            if (ticket.createdAt >= cutoff) {
                continue;
            }
            ticket.priority = 'high';
            ticket.tags = [...(ticket.tags || []), 'escalated'];
            await this.repo.save(ticket);
            escalated++;
            if (notify && ticket.discordChannelId && this.client) {
                const settingsService = new DiscordSettingsService_1.DiscordSettingsService();
                const settings = await settingsService.getSettings(organizationId, guildId);
                const escalationRoleId = settings?.ticketSettings?.escalationRoleId;
                const roleMention = escalationRoleId ? `<@&${escalationRoleId}> ` : '';
                void this.postChannelNotice(ticket.discordChannelId, `⚠️ ${roleMention}Ticket **${ticket.ticketNumber}** has been auto-escalated — no response in ${escalateHours}h.`);
            }
            if (ticket.creatorDiscordId) {
                const dmService = DmNotificationService_1.DmNotificationService.getInstance();
                const embed = dmService.buildTicketEscalatedEmbed(ticket.ticketNumber, `No staff response within ${escalateHours} hours`);
                void dmService.sendNotifications({
                    eventType: DmNotificationService_1.DmEventType.TICKET_ESCALATED,
                    recipientDiscordIds: [ticket.creatorDiscordId],
                    embed,
                });
            }
        }
        return escalated;
    }
    async autoDeleteResolved(organizationId, retentionDays) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const result = await this.repo.delete({
            organizationId,
            status: Ticket_1.TicketStatus.CLOSED,
            updatedAt: (0, typeorm_1.LessThan)(cutoff),
        });
        return result.affected ?? 0;
    }
    getLastActivityDate(ticket) {
        const messages = ticket.messages || [];
        if (messages.length === 0) {
            return ticket.createdAt;
        }
        const lastMsg = messages[messages.length - 1];
        return new Date(lastMsg.createdAt);
    }
    async postChannelNotice(channelId, content) {
        if (!this.client) {
            return;
        }
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (channel && 'send' in channel) {
                await channel.send(content);
            }
        }
        catch (error) {
            logger_1.logger.debug(`TicketAutomationService: Could not post to channel ${channelId}:`, error);
        }
    }
}
exports.TicketAutomationService = TicketAutomationService;
class TicketAutomationJob {
    client;
    tasks = [];
    constructor(client) {
        this.client = client;
    }
    start() {
        const task = node_cron_1.default.schedule('*/30 * * * *', () => {
            this.runAll().catch(err => logger_1.logger.error('TicketAutomationJob: Run failed', err));
        });
        this.tasks.push(task);
        logger_1.logger.info('🎫 TicketAutomationJob scheduled (every 30 minutes)');
    }
    stop() {
        for (const task of this.tasks) {
            void task.stop();
        }
    }
    async runAll() {
        const automationService = TicketAutomationService.getInstance();
        automationService.initialize(this.client);
        for (const guild of this.client.guilds.cache.values()) {
            try {
                const settingsRepo = database_1.AppDataSource.getRepository((await Promise.resolve().then(() => __importStar(require('../../models/DiscordGuildSettings')))).DiscordGuildSettings);
                const guildSettings = await settingsRepo.find({ where: { guildId: guild.id } });
                for (const settings of guildSettings) {
                    if (!settings.ticketSettings?.enabled) {
                        continue;
                    }
                    const rules = {
                        autoCloseInactiveHours: settings.ticketSettings.autoCloseHours,
                        autoDeleteResolvedDays: settings.metadata
                            ?.autoDeleteResolvedDays,
                        autoEscalateHours: settings.metadata
                            ?.autoEscalateHours,
                        notifyOnAutoClose: settings.ticketSettings.notifyOnClose,
                        notifyOnAutoEscalate: true,
                    };
                    if (!rules.autoCloseInactiveHours &&
                        !rules.autoDeleteResolvedDays &&
                        !rules.autoEscalateHours) {
                        continue;
                    }
                    const result = await automationService.runForGuild(settings.organizationId, guild.id, rules);
                    if (result.autoClosed > 0 || result.autoEscalated > 0 || result.autoDeleted > 0) {
                        logger_1.logger.info(`TicketAutomationJob [${guild.name}]: closed=${result.autoClosed} escalated=${result.autoEscalated} deleted=${result.autoDeleted}`);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`TicketAutomationJob: Error processing guild ${guild.name}:`, error);
            }
        }
    }
}
exports.TicketAutomationJob = TicketAutomationJob;
//# sourceMappingURL=TicketAutomationService.js.map