"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dmAwareReply = dmAwareReply;
exports.dmAwareEditReply = dmAwareEditReply;
const discord_js_1 = require("discord.js");
const DiscordUserPreferenceService_1 = require("../../services/discord/DiscordUserPreferenceService");
const logger_1 = require("../../utils/logger");
async function dmAwareReply(interaction, payload) {
    const preferDm = await shouldUseDm(interaction);
    if (preferDm) {
        const sent = await trySendDm(interaction, payload);
        if (sent) {
            await interaction.reply({
                content: '📬 Response sent to your DMs.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
    }
    await interaction.reply({
        ...payload,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function dmAwareEditReply(interaction, payload) {
    const preferDm = await shouldUseDm(interaction);
    if (preferDm) {
        const sent = await trySendDm(interaction, payload);
        if (sent) {
            await interaction.editReply({ content: '📬 Response sent to your DMs.' });
            return;
        }
    }
    await interaction.editReply(payload);
}
async function shouldUseDm(interaction) {
    if (!interaction.guildId) {
        return false;
    }
    try {
        const prefService = DiscordUserPreferenceService_1.DiscordUserPreferenceService.getInstance();
        const pref = await prefService.get(interaction.user.id, interaction.guildId);
        return pref?.botResponseViaDm ?? false;
    }
    catch (error) {
        logger_1.logger.warn(`Failed to check botResponseViaDm for user ${interaction.user.id}`, error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown error'));
        return false;
    }
}
async function trySendDm(interaction, payload) {
    try {
        const dmChannel = await interaction.user.createDM();
        await dmChannel.send(payload);
        return true;
    }
    catch (error) {
        logger_1.logger.warn(`Cannot DM user ${interaction.user.id} — falling back to ephemeral`, error instanceof Error
            ? error
            : new Error(typeof error === 'string' ? error : 'Unknown error'));
        return false;
    }
}
//# sourceMappingURL=dmAwareReply.js.map