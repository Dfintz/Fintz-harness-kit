"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = void 0;
const discord_js_1 = require("discord.js");
const discordAccountLink_1 = require("../../utils/discordAccountLink");
const api_1 = require("../constants/api");
const verifyEmbeds_1 = require("../embeds/verifyEmbeds");
const botApiClient_1 = require("../utils/botApiClient");
const botErrorFormat_1 = require("../utils/botErrorFormat");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const rsiSyncAdminActions_1 = require("./shared/rsiSyncAdminActions");
async function tryReplyWithDiscordAccountLinkHint(interaction, error) {
    const accountLinkHint = (0, discordAccountLink_1.parseDiscordAccountLinkPrompt)(error, {
        fallbackMessage: 'Sign in with Discord SSO on the web app, then retry this command.',
        fallbackLoginUrl: (0, discordAccountLink_1.getDiscordWebLoginUrl)(),
    });
    if (!accountLinkHint) {
        return false;
    }
    const embed = (0, verifyEmbeds_1.buildDiscordAccountNotLinkedEmbed)(accountLinkHint.message);
    const loginButton = new discord_js_1.ButtonBuilder()
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(accountLinkHint.loginUrl)
        .setLabel('Sign In with Discord')
        .setEmoji('🔐');
    const row = new discord_js_1.ActionRowBuilder().addComponents(loginButton);
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
}
const VERIFY_ACTION_HANDLERS = {
    user: handleUserButton,
    unlink: handleUnlinkButton,
    check: handleCheckButton,
};
function isVerifyActionSubcommand(value) {
    return value === 'user' || value === 'unlink' || value === 'check';
}
const GUILD_LINK_REQUIRED_MESSAGE = '❌ This server is not linked to an organization.\n' +
    '• Ask an admin to run `/org` and use **Help → Server Setup** to verify the link.\n' +
    '• If you just linked it, wait ~30 seconds and try again.\n' +
    '• Ask an admin to use the `/org` server setup panel if this server is not linked yet.';
async function replyVerifyButtonActionError(interaction, error) {
    const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content: `\u274c Error: ${msg}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.reply({
        content: `\u274c Error: ${msg}`,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
}
async function handleVerifyActionSubcommand(sub, interaction, orgId) {
    try {
        await VERIFY_ACTION_HANDLERS[sub](interaction, orgId);
    }
    catch (error) {
        await replyVerifyButtonActionError(interaction, error);
    }
}
async function showVerifyLinkModal(interaction) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('verify_link_modal').setTitle('Link RSI Account');
    const handleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('rsi_handle')
        .setPlaceholder('Enter your RSI / Star Citizen handle')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(60);
    const handleLabel = new discord_js_1.LabelBuilder().setLabel('RSI Handle').setTextInputComponent(handleInput);
    modal.addLabelComponents(handleLabel);
    await interaction.showModal(modal);
}
exports.verify = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('verify')
        .setDescription('Link and verify your RSI account'),
    category: 'organization',
    examples: ['/verify'],
    guildOnly: true,
    cooldown: 10,
    handleButton: async (interaction) => {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'verify');
        if (!sub) {
            return;
        }
        if ((0, rsiSyncAdminActions_1.isRsiSyncAdminAction)(sub)) {
            await (0, rsiSyncAdminActions_1.handleRsiSyncAdminAction)(sub, interaction);
            return;
        }
        const guildId = interaction.guildId;
        const orgId = guildId ? await (0, rsiSyncAdminActions_1.resolveOrgIdFromGuild)(guildId) : null;
        if (isVerifyActionSubcommand(sub)) {
            await handleVerifyActionSubcommand(sub, interaction, orgId);
            return;
        }
        if (sub === 'link') {
            await showVerifyLinkModal(interaction);
        }
    },
    handleModal: async (interaction) => {
        if (interaction.customId === 'verify_link_modal') {
            const handle = interaction.fields.getTextInputValue('rsi_handle').trim();
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const orgId = interaction.guildId ? await (0, rsiSyncAdminActions_1.resolveOrgIdFromGuild)(interaction.guildId) : null;
                if (!orgId) {
                    await interaction.editReply('\u274c Could not resolve organization for this server.');
                    return;
                }
                const response = await botApiClient_1.botApiClient.post(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`, {
                    rsiHandle: handle,
                    verificationMethod: 'bio_code',
                }, {
                    headers: (0, botApiClient_1.discordHeaders)(interaction),
                });
                const linkData = response.data.data;
                const profileUrl = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(handle)}`;
                const verificationLink = typeof linkData.verificationUrl === 'string' ? linkData.verificationUrl : undefined;
                const verificationCode = typeof linkData.verificationCode === 'string' ? linkData.verificationCode : undefined;
                const embed = (0, verifyEmbeds_1.buildRsiLinkInitiatedEmbed)(handle, profileUrl, verificationLink, verificationCode);
                const checkButton = new discord_js_1.ButtonBuilder()
                    .setCustomId('verify_panel_check')
                    .setLabel('Check Verification')
                    .setEmoji('\u2705')
                    .setStyle(discord_js_1.ButtonStyle.Success);
                const row = new discord_js_1.ActionRowBuilder().addComponents(checkButton);
                await interaction.editReply({ embeds: [embed], components: [row] });
            }
            catch (error) {
                if (await tryReplyWithDiscordAccountLinkHint(interaction, error)) {
                    return;
                }
                const msg = (0, botErrorFormat_1.formatBotApiError)(error, 'Failed to link RSI account', `link:guild=${interaction.guildId}:user=${interaction.user.id}`);
                await interaction.editReply(`\u274c ${msg}`);
            }
        }
    },
    async execute(interaction) {
        const canManageRoles = interaction.memberPermissions?.has(discord_js_1.PermissionFlagsBits.ManageRoles) ?? false;
        const panelButtons = [
            {
                subcommand: 'link',
                label: 'Link RSI',
                emoji: '\ud83d\udd17',
                style: discord_js_1.ButtonStyle.Success,
            },
            { subcommand: 'unlink', label: 'Unlink RSI', emoji: '\u274c' },
            {
                subcommand: 'user',
                label: 'My Verification',
                emoji: '\ud83d\udc64',
                style: discord_js_1.ButtonStyle.Primary,
            },
        ];
        if (canManageRoles) {
            panelButtons.push({
                subcommand: 'status',
                label: 'Sync Status',
                emoji: '📊',
                style: discord_js_1.ButtonStyle.Secondary,
            }, {
                subcommand: 'setup',
                label: 'Setup Wizard',
                emoji: '🔧',
                style: discord_js_1.ButtonStyle.Secondary,
            }, {
                subcommand: 'run',
                label: 'Run Sync',
                emoji: '🔄',
                style: discord_js_1.ButtonStyle.Secondary,
            }, {
                subcommand: 'audit',
                label: 'Audit',
                emoji: '📝',
                style: discord_js_1.ButtonStyle.Secondary,
            });
        }
        const panelConfig = {
            prefix: 'verify',
            title: '\u2705 RSI Verification Panel',
            description: `Link and verify your RSI account.\n\n` +
                `**Getting Started:**\n` +
                `1\ufe0f\u20e3 Click **Link RSI** to connect your RSI account\n` +
                `2\ufe0f\u20e3 Add the verification link to your [RSI bio](https://robertsspaceindustries.com/account/profile)\n` +
                `3\ufe0f\u20e3 Click **My Verification** to check your status\n\n${canManageRoles
                    ? '**Admin shortcuts:** Sync Status, Setup Wizard, Run Sync, and Audit are available below.'
                    : '*If you are an org admin, `/rsisync` provides role sync management controls.*'}`,
            buttons: panelButtons,
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
};
async function handleUserButton(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: GUILD_LINK_REQUIRED_MESSAGE,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`, {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const linkData = response.data.data;
        await interaction.editReply({ embeds: [(0, verifyEmbeds_1.buildRsiLinkStatusEmbed)(linkData)] });
    }
    catch (error) {
        const axiosError = error;
        if (axiosError.response?.status === 404) {
            await interaction.editReply({ embeds: [(0, verifyEmbeds_1.buildRsiLinkStatusNotLinkedEmbed)()] });
            return;
        }
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `user:org=${orgId}:user=${interaction.user.id}`);
        await interaction.editReply({ content: `❌ Failed to get user status: ${errorMessage}` });
    }
}
async function handleUnlinkButton(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: GUILD_LINK_REQUIRED_MESSAGE,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        await botApiClient_1.botApiClient.delete(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`, {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        await interaction.editReply({ embeds: [(0, verifyEmbeds_1.buildRsiUnlinkedEmbed)()] });
    }
    catch (error) {
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `unlink:org=${orgId}:user=${interaction.user.id}`);
        await interaction.editReply({ content: `❌ Failed to unlink RSI handle: ${errorMessage}` });
    }
}
async function handleCheckButton(interaction, orgId) {
    if (!orgId) {
        await interaction.reply({
            content: GUILD_LINK_REQUIRED_MESSAGE,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.post(`${api_1.API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/verify-check`, {}, {
            headers: (0, botApiClient_1.discordHeaders)(interaction),
        });
        const data = response.data.data;
        if (data.verified) {
            await interaction.editReply({
                embeds: [(0, verifyEmbeds_1.buildVerificationCompleteEmbed)(data.rsiHandle)],
            });
        }
        else {
            const retryButton = new discord_js_1.ButtonBuilder()
                .setCustomId('verify_panel_check')
                .setLabel('Try Again')
                .setEmoji('\ud83d\udd04')
                .setStyle(discord_js_1.ButtonStyle.Success);
            const row = new discord_js_1.ActionRowBuilder().addComponents(retryButton);
            await interaction.editReply({
                embeds: [(0, verifyEmbeds_1.buildVerificationPendingEmbed)(data.error)],
                components: [row],
            });
        }
    }
    catch (error) {
        const axiosError = error;
        if (axiosError.response?.status === 404) {
            await interaction.editReply({ embeds: [(0, verifyEmbeds_1.buildNoRsiLinkEmbed)()] });
            return;
        }
        const errorMessage = (0, botErrorFormat_1.formatBotApiError)(error, 'Unknown error', `verify-check:org=${orgId}:user=${interaction.user.id}`);
        await interaction.editReply({ content: `❌ Failed to check verification: ${errorMessage}` });
    }
}
//# sourceMappingURL=verify.js.map