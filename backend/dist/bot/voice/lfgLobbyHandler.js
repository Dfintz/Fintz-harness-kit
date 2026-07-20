"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLfgLobbyJoin = handleLfgLobbyJoin;
const social_1 = require("../../services/social");
const types_1 = require("../../types");
const logger_1 = require("../../utils/logger");
const lfgEmbed_1 = require("../embeds/lfgEmbed");
let _lfgService = null;
function getLfgService() {
    _lfgService ??= social_1.SocialGroupService.getInstance();
    return _lfgService;
}
const LOBBY_COOLDOWN_MS = 60 * 60 * 1000;
const lobbyCooldowns = new Map();
const lfgLobbyCooldownSweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of lobbyCooldowns) {
        if (now - ts > LOBBY_COOLDOWN_MS * 2) {
            lobbyCooldowns.delete(key);
        }
    }
}, 15 * 60_000);
if (typeof lfgLobbyCooldownSweepInterval.unref === 'function') {
    lfgLobbyCooldownSweepInterval.unref();
}
function isOnCooldown(userId, guildId) {
    const key = `${userId}:${guildId}`;
    const last = lobbyCooldowns.get(key);
    if (last && Date.now() - last < LOBBY_COOLDOWN_MS) {
        return true;
    }
    return false;
}
function setCooldown(userId, guildId) {
    lobbyCooldowns.set(`${userId}:${guildId}`, Date.now());
}
async function findPostChannel(guild) {
    if (guild.systemChannel) {
        return guild.systemChannel;
    }
    const channels = guild.channels.cache
        .filter((ch) => ch.isTextBased() &&
        !ch.isThread() &&
        ch.type === 0 &&
        !!guild.members.me &&
        !!ch.permissionsFor(guild.members.me)?.has('SendMessages'))
        .sort((a, b) => a.position - b.position);
    return channels.first() ?? null;
}
async function handleLfgLobbyJoin(client, newState, voiceSettings) {
    const lobbyIds = voiceSettings.lfgLobbyChannelIds;
    if (!lobbyIds || lobbyIds.length === 0 || !newState.channelId) {
        return;
    }
    if (!lobbyIds.includes(newState.channelId)) {
        return;
    }
    const member = newState.member;
    const guild = newState.guild;
    if (!member || member.user.bot) {
        return;
    }
    const userId = member.id;
    const guildId = guild.id;
    if (isOnCooldown(userId, guildId)) {
        logger_1.logger.debug(`LFG lobby cooldown active for ${member.displayName} in guild ${guild.name}`);
        return;
    }
    try {
        const post = getLfgService().createPost(types_1.LFGActivity.OTHER, `${member.displayName}'s lobby group`, userId, member.displayName, 4, guildId, '', 60);
        post.voiceChannelId = newState.channelId;
        const textChannel = await findPostChannel(guild);
        if (!textChannel) {
            logger_1.logger.warn(`LFG Lobby: no text channel found to post in guild ${guild.name}`);
            return;
        }
        const embed = (0, lfgEmbed_1.buildLfgEmbed)(post);
        const buttons = (0, lfgEmbed_1.buildLfgButtons)(post.id);
        const sentMessage = await textChannel.send({
            embeds: [embed],
            components: [buttons],
        });
        getLfgService().setMessageId(post.id, sentMessage.id);
        setCooldown(userId, guildId);
        logger_1.logger.info(`🏠 LFG lobby auto-post created for ${member.displayName} in ${guild.name} (VC: ${newState.channel?.name})`);
    }
    catch (error) {
        logger_1.logger.error('Failed to create LFG lobby auto-post:', error);
    }
}
//# sourceMappingURL=lfgLobbyHandler.js.map