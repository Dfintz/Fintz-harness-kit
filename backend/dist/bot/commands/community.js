"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.community = void 0;
const discord_js_1 = require("discord.js");
const communityEmbeds_1 = require("../embeds/communityEmbeds");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
exports.community = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('community')
        .setDescription('Giveaways, polls, announcements, embeds, and reaction roles')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    cooldown: 5,
    category: 'admin',
    guildOnly: true,
    async execute(interaction) {
        const embed = (0, communityEmbeds_1.buildCommunityHubEmbed)();
        const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('community_panel_giveaways')
            .setLabel('Giveaways')
            .setEmoji('🎁')
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setCustomId('community_panel_polls')
            .setLabel('Polls')
            .setEmoji('🗳️')
            .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
            .setCustomId('community_panel_announcements')
            .setLabel('Announcements')
            .setEmoji('📢')
            .setStyle(discord_js_1.ButtonStyle.Success));
        const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId('community_panel_embeds')
            .setLabel('Custom Embeds')
            .setEmoji('📝')
            .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
            .setCustomId('community_panel_roles')
            .setLabel('Reaction Roles')
            .setEmoji('🎭')
            .setStyle(discord_js_1.ButtonStyle.Secondary));
        await interaction.reply({
            embeds: [embed],
            components: [row1, row2],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    },
    async handleButton(interaction) {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'community');
        if (!sub) {
            return;
        }
        switch (sub) {
            case 'giveaways': {
                const embed = (0, communityEmbeds_1.buildCommunityGiveawaysEmbed)();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('giveaway_panel_list')
                    .setLabel('List Giveaways')
                    .setEmoji('📋')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId('giveaway_panel_create')
                    .setLabel('Create Giveaway')
                    .setEmoji('➕')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('giveaway_panel_end')
                    .setLabel('End Giveaway')
                    .setEmoji('🏁')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('giveaway_panel_reroll')
                    .setLabel('Reroll Winner')
                    .setEmoji('🎲')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'polls': {
                const embed = (0, communityEmbeds_1.buildCommunityPollsEmbed)();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('poll_panel_create')
                    .setLabel('Create Poll')
                    .setEmoji('➕')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('poll_panel_list')
                    .setLabel('List Polls')
                    .setEmoji('📋')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId('poll_panel_post')
                    .setLabel('Post Poll')
                    .setEmoji('📢')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('poll_panel_results')
                    .setLabel('View Results')
                    .setEmoji('📊')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('poll_panel_close')
                    .setLabel('Close Poll')
                    .setEmoji('🔒')
                    .setStyle(discord_js_1.ButtonStyle.Danger));
                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'announcements': {
                const embed = (0, communityEmbeds_1.buildCommunityAnnouncementsEmbed)();
                const row1 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_create')
                    .setLabel('Create')
                    .setEmoji('➕')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_list')
                    .setLabel('View All')
                    .setEmoji('📋')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_send')
                    .setLabel('Send')
                    .setEmoji('📤')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_schedule')
                    .setLabel('Schedule')
                    .setEmoji('⏰')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                const row2 = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_status')
                    .setLabel('Check Status')
                    .setEmoji('📊')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_templates')
                    .setLabel('Templates')
                    .setEmoji('📋')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId('announce_panel_delete')
                    .setLabel('Delete')
                    .setEmoji('🗑️')
                    .setStyle(discord_js_1.ButtonStyle.Danger));
                await interaction.reply({
                    embeds: [embed],
                    components: [row1, row2],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'embeds': {
                const embed = (0, communityEmbeds_1.buildCommunityCustomEmbedsEmbed)();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('embed_panel_create')
                    .setLabel('Create Embed')
                    .setEmoji('➕')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('embed_panel_send')
                    .setLabel('Send Embed')
                    .setEmoji('📤')
                    .setStyle(discord_js_1.ButtonStyle.Secondary));
                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            case 'roles': {
                const embed = (0, communityEmbeds_1.buildCommunityReactionRolesEmbed)();
                const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('reactionrole_panel_list')
                    .setLabel('List Panels')
                    .setEmoji('📋')
                    .setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder()
                    .setCustomId('reactionrole_panel_create')
                    .setLabel('Create Panel')
                    .setEmoji('➕')
                    .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                    .setCustomId('reactionrole_panel_send')
                    .setLabel('Send Panel')
                    .setEmoji('📤')
                    .setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder()
                    .setCustomId('reactionrole_panel_delete')
                    .setLabel('Delete Panel')
                    .setEmoji('🗑️')
                    .setStyle(discord_js_1.ButtonStyle.Danger));
                await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                break;
            }
            default:
                await interaction.reply({ content: '❌ Unknown action.', flags: discord_js_1.MessageFlags.Ephemeral });
        }
    },
};
//# sourceMappingURL=community.js.map