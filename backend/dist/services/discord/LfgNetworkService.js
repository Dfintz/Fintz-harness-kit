"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LfgNetworkService = exports.DEFAULT_LFG_NETWORK = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
const TunnelService_1 = require("./TunnelService");
exports.DEFAULT_LFG_NETWORK = {
    enabled: false,
    broadcastOutgoing: true,
    receiveIncoming: true,
    activityFilter: [],
};
class LfgNetworkService {
    static instance;
    client = null;
    settingsService = new DiscordSettingsService_1.DiscordSettingsService();
    tunnelService = TunnelService_1.TunnelService.getInstance();
    static getInstance() {
        if (!LfgNetworkService.instance) {
            LfgNetworkService.instance = new LfgNetworkService();
        }
        return LfgNetworkService.instance;
    }
    initialize(client) {
        this.client = client;
        logger_1.logger.info('🌐 LfgNetworkService initialized');
    }
    async broadcastLfgPost(payload) {
        if (!this.client) {
            return 0;
        }
        const sourceSettings = await this.settingsService.getSettingsByGuildId(payload.sourceGuildId);
        const networkSettings = sourceSettings?.[0]?.lfgNetworkSettings;
        if (!networkSettings?.enabled || !networkSettings.broadcastOutgoing) {
            return 0;
        }
        if (networkSettings.activityFilter.length > 0 &&
            !networkSettings.activityFilter.includes(payload.activity)) {
            return 0;
        }
        const sourceGameSettings = sourceSettings?.[0]?.lfgSettings;
        const allowList = sourceGameSettings?.publicLfgGuildAllowList ?? [];
        const connectedGuildIds = await this.getConnectedGuildIds(payload.sourceGuildId);
        let broadcastCount = 0;
        for (const targetGuildId of connectedGuildIds) {
            if (allowList.length > 0 && !allowList.includes(targetGuildId)) {
                continue;
            }
            try {
                const targetSettings = await this.settingsService.getSettingsByGuildId(targetGuildId);
                const targetNetwork = targetSettings?.[0]?.lfgNetworkSettings;
                if (!targetNetwork?.enabled || !targetNetwork.receiveIncoming) {
                    continue;
                }
                if (!targetNetwork.incomingChannelId) {
                    continue;
                }
                const channel = await this.client.channels
                    .fetch(targetNetwork.incomingChannelId)
                    .catch(() => null);
                if (!channel || !(channel instanceof discord_js_1.TextChannel)) {
                    continue;
                }
                const embed = this.buildBroadcastEmbed(payload);
                await channel.send({ embeds: [embed] });
                broadcastCount++;
            }
            catch (error) {
                logger_1.logger.warn(`Failed to broadcast LFG to guild ${targetGuildId}:`, error);
            }
        }
        return broadcastCount;
    }
    async getConnectedGuildIds(sourceGuildId) {
        const guildIds = [];
        try {
            const guild = await this.client?.guilds.fetch(sourceGuildId).catch(() => null);
            if (!guild) {
                return [];
            }
            for (const [, channel] of guild.channels.cache) {
                if (!(channel instanceof discord_js_1.TextChannel)) {
                    continue;
                }
                const tunnel = this.tunnelService.findTunnelByChannel(channel.id);
                if (!tunnel) {
                    continue;
                }
                const connections = this.tunnelService.getConnectedChannels(tunnel.id, channel.id);
                for (const conn of connections) {
                    const targetChannel = await this.client?.channels.fetch(conn.channelId).catch(() => null);
                    if (targetChannel && 'guild' in targetChannel && targetChannel.guild) {
                        const tGuildId = targetChannel.guild.id;
                        if (tGuildId !== sourceGuildId && !guildIds.includes(tGuildId)) {
                            guildIds.push(tGuildId);
                        }
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to resolve connected guild IDs:', error);
        }
        return guildIds;
    }
    buildBroadcastEmbed(payload) {
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00d9ff)
            .setTitle(`🌐 Cross-Server LFG: ${(0, shared_types_1.decodeHtmlEntities)(payload.activity)}`)
            .setDescription((0, shared_types_1.decodeHtmlEntities)(payload.description))
            .addFields({ name: '🏠 Server', value: (0, shared_types_1.decodeHtmlEntities)(payload.sourceGuildName), inline: true }, { name: '👤 Host', value: (0, shared_types_1.decodeHtmlEntities)(payload.hostName), inline: true }, {
            name: '👥 Players',
            value: `${payload.currentPlayers}/${payload.maxPlayers}`,
            inline: true,
        }, { name: '⏱️ Duration', value: `${payload.duration} min`, inline: true })
            .setFooter({ text: 'LFG Network — Cross-server matchmaking' })
            .setTimestamp(payload.createdAt);
    }
}
exports.LfgNetworkService = LfgNetworkService;
//# sourceMappingURL=LfgNetworkService.js.map