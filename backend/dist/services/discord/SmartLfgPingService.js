"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartLfgPingService = exports.DEFAULT_SMART_LFG_PING_SETTINGS = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const discord_js_1 = require("discord.js");
const logger_1 = require("../../utils/logger");
exports.DEFAULT_SMART_LFG_PING_SETTINGS = {
    enabled: false,
    cooldownHours: 8,
    maxPingsPerPost: 5,
    activityFilter: [],
};
class SmartLfgPingService {
    static instance;
    client = null;
    cooldowns = new Map();
    cleanupInterval = null;
    constructor() { }
    static getInstance() {
        if (!SmartLfgPingService.instance) {
            SmartLfgPingService.instance = new SmartLfgPingService();
        }
        return SmartLfgPingService.instance;
    }
    initialize(client) {
        this.client = client;
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCooldowns();
        }, 30 * 60 * 1000);
        this.cleanupInterval.unref();
    }
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.client = null;
        this.cooldowns.clear();
    }
    async notifyMatchingMembers(post, settings) {
        if (!settings.enabled || !this.client) {
            return 0;
        }
        try {
            const guild = await this.client.guilds.fetch(post.guildId);
            if (!guild) {
                return 0;
            }
            if (settings.activityFilter.length > 0 && !settings.activityFilter.includes(post.activity)) {
                return 0;
            }
            const candidates = await this.findCandidates(guild, post, settings);
            const pinged = await this.sendPings(candidates, post, guild.name, settings);
            if (pinged > 0) {
                logger_1.logger.info(`SmartLfgPingService: Pinged ${pinged} members for LFG post ${post.id} (${post.activity}) in ${guild.name}`);
            }
            return pinged;
        }
        catch (error) {
            logger_1.logger.error('SmartLfgPingService: Error notifying members', error);
            return 0;
        }
    }
    async findCandidates(guild, post, settings) {
        await guild.members.fetch({ withPresences: true });
        const candidates = [];
        const cooldownMs = settings.cooldownHours * 60 * 60 * 1000;
        const now = Date.now();
        for (const member of guild.members.cache.values()) {
            if (member.user.bot) {
                continue;
            }
            if (member.id === post.creatorId) {
                continue;
            }
            if (post.members.includes(member.id)) {
                continue;
            }
            const status = member.presence?.status;
            if (!status || status === 'offline' || status === 'dnd') {
                continue;
            }
            if (settings.optInRoleId && !member.roles.cache.has(settings.optInRoleId)) {
                continue;
            }
            const key = `${guild.id}:${member.id}`;
            const lastPinged = this.cooldowns.get(key);
            if (lastPinged && now - lastPinged < cooldownMs) {
                continue;
            }
            candidates.push(member);
            if (candidates.length >= settings.maxPingsPerPost) {
                break;
            }
        }
        return candidates;
    }
    async sendPings(candidates, post, guildName, _settings) {
        let pinged = 0;
        const embed = this.buildPingEmbed(post, guildName);
        const muteButton = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`lfg_mute_${candidates[0]?.guild.id ?? 'unknown'}`)
            .setLabel('Mute LFG Pings')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🔇'));
        for (const member of candidates) {
            try {
                const user = await this.client.users.fetch(member.id);
                await user.send({ embeds: [embed], components: [muteButton] });
                this.cooldowns.set(`${member.guild.id}:${member.id}`, Date.now());
                pinged++;
            }
            catch {
                logger_1.logger.debug(`SmartLfgPingService: Could not DM ${member.user.tag}`);
            }
        }
        return pinged;
    }
    buildPingEmbed(post, guildName) {
        const slotsLeft = post.maxPlayers - post.currentPlayers;
        return new discord_js_1.EmbedBuilder()
            .setColor(0x00bcd4)
            .setTitle('🎮 LFG Post — Looking for Players!')
            .setDescription(`A new **${(0, shared_types_1.decodeHtmlEntities)(post.activity)}** group is looking for players in **${guildName}**!`)
            .addFields({ name: 'Activity', value: (0, shared_types_1.decodeHtmlEntities)(post.activity), inline: true }, { name: 'Slots', value: `${slotsLeft} of ${post.maxPlayers} available`, inline: true }, { name: 'Host', value: (0, shared_types_1.decodeHtmlEntities)(post.creatorName), inline: true }, {
            name: 'Description',
            value: (0, shared_types_1.decodeHtmlEntities)(post.description) || 'No description',
            inline: false,
        })
            .setFooter({
            text: 'Use the LFG post in the server to join • You can opt out of these pings',
        })
            .setTimestamp();
    }
    cleanupExpiredCooldowns() {
        const maxCooldownMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;
        for (const [key, timestamp] of this.cooldowns) {
            if (now - timestamp > maxCooldownMs) {
                this.cooldowns.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger_1.logger.debug(`SmartLfgPingService: Cleaned ${cleaned} expired cooldowns`);
        }
    }
}
exports.SmartLfgPingService = SmartLfgPingService;
//# sourceMappingURL=SmartLfgPingService.js.map