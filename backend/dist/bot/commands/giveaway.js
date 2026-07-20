"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.giveaway = void 0;
const node_crypto_1 = require("node:crypto");
const discord_js_1 = require("discord.js");
const GiveawayService_1 = require("../../services/discord/GiveawayService");
const RoleGatingService_1 = require("../../services/discord/RoleGatingService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const customId_1 = require("../utils/customId");
const paginationControls_1 = require("../utils/paginationControls");
const GIVEAWAY_PANEL_PREFIX = 'giveaway';
const GIVEAWAY_LIST_PAGE_ACTION = 'listpage';
const GIVEAWAY_LIST_PAGE_SCOPE = (0, customId_1.buildCustomId)(GIVEAWAY_PANEL_PREFIX, GIVEAWAY_LIST_PAGE_ACTION);
const GIVEAWAY_LIST_PAGE_SIZE = 10;
const GIVEAWAY_PANEL_CONFIG = {
    prefix: GIVEAWAY_PANEL_PREFIX,
    title: '🎁 Giveaways',
    description: 'Create and manage giveaways.',
    buttons: [
        { subcommand: 'list', label: 'List Giveaways', emoji: '📋', style: discord_js_1.ButtonStyle.Primary },
        { subcommand: 'create', label: 'Create Giveaway', emoji: '➕', style: discord_js_1.ButtonStyle.Success },
        { subcommand: 'end', label: 'End Giveaway', emoji: '🏁' },
        { subcommand: 'reroll', label: 'Reroll Winner', emoji: '🎲' },
    ],
};
exports.giveaway = {
    data: new discord_js_1.SlashCommandBuilder().setName('giveaway').setDescription('Create and manage giveaways'),
    cooldown: 5,
    category: 'social',
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, GIVEAWAY_PANEL_CONFIG);
    },
    async handleButton(interaction) {
        const panelSub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, GIVEAWAY_PANEL_PREFIX);
        if (panelSub) {
            switch (panelSub) {
                case 'list': {
                    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                    try {
                        await handleListFromPanel(interaction);
                    }
                    catch (err) {
                        await interaction.editReply({
                            content: `❌ Error: ${(0, errorHandler_1.getErrorMessage)(err)}`,
                        });
                    }
                    return;
                }
                case 'create':
                    await showCreateModal(interaction);
                    return;
                case 'end':
                    await showGiveawayIdModal(interaction, 'end', 'End Giveaway', 'Enter the Giveaway ID to end');
                    return;
                case 'reroll':
                    await showGiveawayIdModal(interaction, 'reroll', 'Reroll Winner', 'Enter the Giveaway ID to reroll');
                    return;
            }
        }
        if ((0, customId_1.customIdScope)(interaction.customId) === GIVEAWAY_LIST_PAGE_SCOPE) {
            await handleGiveawayListPageButton(interaction);
            return;
        }
        const enterMatch = /^giveaway_enter_(.+)$/.exec(interaction.customId);
        if (!enterMatch) {
            return;
        }
        const giveawayId = enterMatch[1];
        const service = GiveawayService_1.GiveawayService.getInstance();
        const roleGating = RoleGatingService_1.RoleGatingService.getInstance();
        const gateCheck = await roleGating.checkGate(interaction.guildId ?? '', interaction.member, 'giveaway');
        if (!gateCheck.allowed) {
            await interaction.reply({
                content: `❌ ${gateCheck.reason || 'You do not have permission to enter giveaways.'}`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const errorMsg = await service.addEntry(giveawayId, interaction.user.id, interaction.user.username, interaction.member);
        if (errorMsg) {
            await interaction.reply({
                content: `❌ ${errorMsg}`,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.reply({
            content: `🎉 You have entered the giveaway! Good luck!`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        try {
            const giveawayData = service.getGiveaway(giveawayId);
            if (giveawayData && interaction.message) {
                const updatedEmbed = service.buildGiveawayEmbed(giveawayData);
                const updatedButtons = service.buildGiveawayButtons(giveawayData.id, giveawayData.ended);
                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: [updatedButtons],
                });
            }
        }
        catch (updateError) {
            logger_1.logger.warn('Failed to update giveaway message entry count:', updateError);
        }
    },
    async handleModal(interaction) {
        const { customId } = interaction;
        if (customId === 'giveaway_create_modal') {
            await handleCreateFromModal(interaction);
            return;
        }
        if (customId === 'giveaway_end_modal') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const id = interaction.fields.getTextInputValue('giveaway_id').trim();
            try {
                await handleEndFromModal(interaction, id);
            }
            catch (err) {
                await interaction.editReply({
                    content: `❌ Error: ${(0, errorHandler_1.getErrorMessage)(err)}`,
                });
            }
            return;
        }
        if (customId === 'giveaway_reroll_modal') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const id = interaction.fields.getTextInputValue('giveaway_id').trim();
            try {
                await handleRerollFromModal(interaction, id);
            }
            catch (err) {
                await interaction.editReply({
                    content: `❌ Error: ${(0, errorHandler_1.getErrorMessage)(err)}`,
                });
            }
        }
    },
};
async function showCreateModal(interaction) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('giveaway_create_modal').setTitle('Create Giveaway');
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('prize')
        .setPlaceholder('What is being given away?')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true);
    const descriptionInput = new discord_js_1.TextInputBuilder()
        .setCustomId('description')
        .setPlaceholder('Additional details about the giveaway')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setRequired(false);
    const durationInput = new discord_js_1.TextInputBuilder()
        .setCustomId('duration')
        .setPlaceholder('60')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false);
    const winnersInput = new discord_js_1.TextInputBuilder()
        .setCustomId('winners')
        .setPlaceholder('1')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Prize').setTextInputComponent(titleInput), new discord_js_1.LabelBuilder().setLabel('Description (optional)').setTextInputComponent(descriptionInput), new discord_js_1.LabelBuilder()
        .setLabel('Duration in minutes (default: 60)')
        .setTextInputComponent(durationInput), new discord_js_1.LabelBuilder()
        .setLabel('Number of winners (default: 1)')
        .setTextInputComponent(winnersInput));
    await interaction.showModal(modal);
}
async function showGiveawayIdModal(interaction, action, title, placeholder) {
    const modal = new discord_js_1.ModalBuilder().setCustomId(`giveaway_${action}_modal`).setTitle(title);
    const idInput = new discord_js_1.TextInputBuilder()
        .setCustomId('giveaway_id')
        .setPlaceholder(placeholder)
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(true);
    modal.addLabelComponents(new discord_js_1.LabelBuilder().setLabel('Giveaway ID').setTextInputComponent(idInput));
    await interaction.showModal(modal);
}
async function handleListFromPanel(interaction) {
    const service = GiveawayService_1.GiveawayService.getInstance();
    const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');
    if (activeGiveaways.length === 0) {
        await interaction.editReply({ content: '📭 No active giveaways.' });
        return;
    }
    await interaction.editReply(_buildGiveawayListView(activeGiveaways, 0));
}
async function handleGiveawayListPageButton(interaction) {
    const [pageParam = ''] = (0, customId_1.parseCustomId)(interaction.customId).params;
    const page = Number.parseInt(pageParam, 10);
    if (Number.isNaN(page) || page < 0) {
        return;
    }
    const service = GiveawayService_1.GiveawayService.getInstance();
    const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');
    if (activeGiveaways.length === 0) {
        await interaction.update({ content: '📭 No active giveaways.', embeds: [], components: [] });
        return;
    }
    await interaction.update(_buildGiveawayListView(activeGiveaways, page));
}
function _buildGiveawayListView(giveaways, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(giveaways, page, GIVEAWAY_LIST_PAGE_SIZE);
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00d9ff)
        .setTitle('🎁 Active Giveaways')
        .setDescription(`${total} active giveaway(s)`)
        .setTimestamp();
    for (const g of pageItems) {
        const endTime = Math.floor(g.endsAt.getTime() / 1000);
        embed.addFields({
            name: `🎁 ${g.title}`,
            value: [
                `Hosted by: <@${g.hostId}>`,
                `Entries: ${g.entries.length}`,
                `Winners: ${g.winners}`,
                `Ends: <t:${endTime}:R>`,
                `ID: \`${g.id}\``,
            ].join('\n'),
            inline: false,
        });
    }
    if (totalPages > 1) {
        embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} giveaways` });
    }
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => (0, customId_1.buildCustomId)(GIVEAWAY_PANEL_PREFIX, GIVEAWAY_LIST_PAGE_ACTION, String(targetPage)),
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function handleCreateFromModal(interaction) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to create giveaways.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const prize = interaction.fields.getTextInputValue('prize').trim();
    const description = interaction.fields.getTextInputValue('description')?.trim() || '';
    const durationStr = interaction.fields.getTextInputValue('duration')?.trim();
    const winnersStr = interaction.fields.getTextInputValue('winners')?.trim();
    const duration = durationStr ? Number.parseInt(durationStr, 10) : 60;
    const winners = winnersStr ? Number.parseInt(winnersStr, 10) : 1;
    if (Number.isNaN(duration) || duration < 1 || duration > 10080) {
        await interaction.editReply({
            content: '❌ Duration must be between 1 and 10080 minutes.',
        });
        return;
    }
    if (Number.isNaN(winners) || winners < 1 || winners > 20) {
        await interaction.editReply({
            content: '❌ Number of winners must be between 1 and 20.',
        });
        return;
    }
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayResult = service.createGiveaway({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        hostName: interaction.user.username,
        title: prize,
        description,
        winners,
        durationMinutes: duration,
    });
    if (typeof giveawayResult === 'string') {
        await interaction.editReply({ content: `❌ ${giveawayResult}` });
        return;
    }
    const embed = service.buildGiveawayEmbed(giveawayResult);
    const buttons = service.buildGiveawayButtons(giveawayResult.id, giveawayResult.ended);
    await interaction.editReply({ content: '🎉 Giveaway created!' });
    if (interaction.channel && 'send' in interaction.channel) {
        const msg = await interaction.channel.send({ embeds: [embed], components: [buttons] });
        service.setMessageId(giveawayResult.id, msg.id);
    }
}
async function handleEndFromModal(interaction, id) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.editReply({
            content: '❌ You need Manage Messages permission to end giveaways.',
        });
        return;
    }
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayData = service.getGiveaway(id);
    if (!giveawayData || giveawayData.ended) {
        await interaction.editReply({ content: '❌ Giveaway not found or already ended.' });
        return;
    }
    const winners = await service.endGiveaway(id);
    const winnerMentions = winners.length > 0
        ? winners.map(uid => `<@${uid}>`).join(', ')
        : 'No valid entries — no winners.';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🎉 Giveaway Ended!')
        .setDescription(`**Prize:** ${giveawayData.title}`)
        .addFields({ name: '🏆 Winner(s)', value: winnerMentions, inline: false })
        .setTimestamp();
    await interaction.editReply({ content: '✅ Giveaway ended!' });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [embed] });
    }
}
async function handleRerollFromModal(interaction, id) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.editReply({
            content: '❌ You need Manage Messages permission to reroll giveaways.',
        });
        return;
    }
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayData = service.getGiveaway(id);
    if (!giveawayData) {
        await interaction.editReply({ content: '❌ Giveaway not found.' });
        return;
    }
    const pool = [...giveawayData.entries];
    const newWinners = [];
    for (let i = 0; i < giveawayData.winners && pool.length > 0; i++) {
        const idx = (0, node_crypto_1.randomInt)(pool.length);
        newWinners.push(pool[idx].userId);
        pool.splice(idx, 1);
    }
    const winnerMentions = newWinners.length > 0 ? newWinners.map(uid => `<@${uid}>`).join(', ') : 'No entries to reroll.';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🔄 Giveaway Rerolled!')
        .setDescription(`**Prize:** ${giveawayData.title}`)
        .addFields({ name: '🏆 New Winner(s)', value: winnerMentions, inline: false })
        .setTimestamp();
    await interaction.editReply({ content: '✅ Giveaway rerolled!' });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [embed] });
    }
}
async function _handleCreate(interaction) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to create giveaways.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners') ?? 1;
    const duration = interaction.options.getInteger('duration') ?? 60;
    const requiredRole = interaction.options.getRole('required_role');
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayResult = service.createGiveaway({
        guildId: interaction.guildId ?? '',
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        hostName: interaction.user.username,
        title: prize,
        description: requiredRole ? `Required role: ${requiredRole.name}` : '',
        winners,
        durationMinutes: duration,
        requiredRoleId: requiredRole?.id,
    });
    if (typeof giveawayResult === 'string') {
        await interaction.reply({ content: `❌ ${giveawayResult}`, flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const embed = service.buildGiveawayEmbed(giveawayResult);
    const buttons = service.buildGiveawayButtons(giveawayResult.id, giveawayResult.ended);
    await interaction.reply({ content: '🎉 Giveaway created!', flags: discord_js_1.MessageFlags.Ephemeral });
    if (interaction.channel && 'send' in interaction.channel) {
        const msg = await interaction.channel.send({ embeds: [embed], components: [buttons] });
        service.setMessageId(giveawayResult.id, msg.id);
    }
}
async function _handleList(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const service = GiveawayService_1.GiveawayService.getInstance();
    const activeGiveaways = service.listGiveaways(interaction.guildId ?? '');
    if (activeGiveaways.length === 0) {
        await interaction.editReply({ content: '📭 No active giveaways.' });
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00d9ff)
        .setTitle('🎁 Active Giveaways')
        .setDescription(`${activeGiveaways.length} active giveaway(s)`)
        .setTimestamp();
    for (const g of activeGiveaways.slice(0, 10)) {
        const endTime = Math.floor(g.endsAt.getTime() / 1000);
        embed.addFields({
            name: `🎁 ${g.title}`,
            value: [
                `Hosted by: <@${g.hostId}>`,
                `Entries: ${g.entries.length}`,
                `Winners: ${g.winners}`,
                `Ends: <t:${endTime}:R>`,
                `ID: \`${g.id}\``,
            ].join('\n'),
            inline: false,
        });
    }
    await interaction.editReply({ embeds: [embed] });
}
async function _handleEnd(interaction) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to end giveaways.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const id = interaction.options.getString('id', true);
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayData = service.getGiveaway(id);
    if (!giveawayData || giveawayData.ended) {
        await interaction.editReply({ content: '❌ Giveaway not found or already ended.' });
        return;
    }
    const winners = await service.endGiveaway(id);
    const winnerMentions = winners.length > 0
        ? winners.map(uid => `<@${uid}>`).join(', ')
        : 'No valid entries — no winners.';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0xff4444)
        .setTitle('🎉 Giveaway Ended!')
        .setDescription(`**Prize:** ${giveawayData.title}`)
        .addFields({ name: '🏆 Winner(s)', value: winnerMentions, inline: false })
        .setTimestamp();
    await interaction.editReply({ content: '✅ Giveaway ended!' });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [embed] });
    }
}
async function _handleReroll(interaction) {
    if (!interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to reroll giveaways.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const id = interaction.options.getString('id', true);
    const service = GiveawayService_1.GiveawayService.getInstance();
    const giveawayData = service.getGiveaway(id);
    if (!giveawayData) {
        await interaction.editReply({ content: '❌ Giveaway not found.' });
        return;
    }
    const pool = [...giveawayData.entries];
    const newWinners = [];
    for (let i = 0; i < giveawayData.winners && pool.length > 0; i++) {
        const idx = (0, node_crypto_1.randomInt)(pool.length);
        newWinners.push(pool[idx].userId);
        pool.splice(idx, 1);
    }
    const winnerMentions = newWinners.length > 0 ? newWinners.map(uid => `<@${uid}>`).join(', ') : 'No entries to reroll.';
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('🔄 Giveaway Rerolled!')
        .setDescription(`**Prize:** ${giveawayData.title}`)
        .addFields({ name: '🏆 New Winner(s)', value: winnerMentions, inline: false })
        .setTimestamp();
    await interaction.editReply({ content: '✅ Giveaway rerolled!' });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [embed] });
    }
}
//# sourceMappingURL=giveaway.js.map