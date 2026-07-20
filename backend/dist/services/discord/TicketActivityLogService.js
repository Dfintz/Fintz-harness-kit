"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketActivityLogService = void 0;
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const ACTIVITY_COLORS = {
    created: 0x00ff88,
    assigned: 0x3498db,
    claimed: 0x9b59b6,
    replied: 0x2ecc71,
    closed: 0xe74c3c,
    reopened: 0xf39c12,
    escalated: 0xff6b35,
    auto_closed: 0x95a5a6,
    auto_escalated: 0xe67e22,
};
const ACTIVITY_EMOJI = {
    created: '🆕',
    assigned: '👤',
    claimed: '✋',
    replied: '💬',
    closed: '🔒',
    reopened: '🔓',
    escalated: '⚠️',
    auto_closed: '⏰',
    auto_escalated: '🔺',
};
class TicketActivityLogService {
    static instance;
    client = null;
    settingsService = new DiscordSettingsService_1.DiscordSettingsService();
    static getInstance() {
        if (!TicketActivityLogService.instance) {
            TicketActivityLogService.instance = new TicketActivityLogService();
        }
        return TicketActivityLogService.instance;
    }
    initialize(client) {
        this.client = client;
        logger_1.logger.info('📋 TicketActivityLogService initialized');
    }
    async logActivity(guildId, ticketNumber, activityType, actorName, details) {
        if (!this.client) {
            return;
        }
        try {
            const settings = await this.settingsService.getSettingsByGuildId(guildId);
            const logChannelId = settings?.find(s => s.ticketSettings?.ticketLogChannelId)?.ticketSettings
                ?.ticketLogChannelId;
            if (!logChannelId) {
                return;
            }
            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                return;
            }
            const emoji = ACTIVITY_EMOJI[activityType];
            const color = ACTIVITY_COLORS[activityType];
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(color)
                .setTitle(`${emoji} Ticket ${activityType.replace('_', ' ').toUpperCase()}`)
                .addFields({ name: 'Ticket', value: ticketNumber, inline: true }, { name: 'Action By', value: actorName, inline: true }, { name: 'Type', value: activityType.replace('_', ' '), inline: true })
                .setTimestamp();
            if (details) {
                embed.setDescription(details);
            }
            await channel.send({ embeds: [embed] });
        }
        catch (error) {
            logger_1.logger.warn('Failed to log ticket activity:', error);
        }
    }
}
exports.TicketActivityLogService = TicketActivityLogService;
//# sourceMappingURL=TicketActivityLogService.js.map