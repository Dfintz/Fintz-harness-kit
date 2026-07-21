/**
 * /community — Community Tools Panel
 *
 * Combines giveaways, polls, announcements, custom embeds, and reaction roles
 * into a single discoverable panel. Each section opens the dedicated sub-panel
 * from the corresponding command handler.
 *
 * @module bot/commands/community
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import {
  buildCommunityAnnouncementsEmbed,
  buildCommunityCustomEmbedsEmbed,
  buildCommunityGiveawaysEmbed,
  buildCommunityHubEmbed,
  buildCommunityPollsEmbed,
  buildCommunityReactionRolesEmbed,
} from '../embeds/communityEmbeds';
import { parsePanelCustomId } from '../utils/commandPanelBuilder';

import { BotCommand } from './types';

export const community: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('community')
    .setDescription('Giveaways, polls, announcements, embeds, and reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 5,
  category: 'admin',
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = buildCommunityHubEmbed();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('community_panel_giveaways')
        .setLabel('Giveaways')
        .setEmoji('🎁')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('community_panel_polls')
        .setLabel('Polls')
        .setEmoji('🗳️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('community_panel_announcements')
        .setLabel('Announcements')
        .setEmoji('📢')
        .setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('community_panel_embeds')
        .setLabel('Custom Embeds')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('community_panel_roles')
        .setLabel('Reaction Roles')
        .setEmoji('🎭')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      flags: MessageFlags.Ephemeral,
    });
  },

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const sub = parsePanelCustomId(interaction.customId, 'community');
    if (!sub) {
      return;
    }

    switch (sub) {
      case 'giveaways': {
        const embed = buildCommunityGiveawaysEmbed();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('giveaway_panel_list')
            .setLabel('List Giveaways')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('giveaway_panel_create')
            .setLabel('Create Giveaway')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('giveaway_panel_end')
            .setLabel('End Giveaway')
            .setEmoji('🏁')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('giveaway_panel_reroll')
            .setLabel('Reroll Winner')
            .setEmoji('🎲')
            .setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      case 'polls': {
        const embed = buildCommunityPollsEmbed();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('poll_panel_create')
            .setLabel('Create Poll')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('poll_panel_list')
            .setLabel('List Polls')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('poll_panel_post')
            .setLabel('Post Poll')
            .setEmoji('📢')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('poll_panel_results')
            .setLabel('View Results')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('poll_panel_close')
            .setLabel('Close Poll')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      case 'announcements': {
        const embed = buildCommunityAnnouncementsEmbed();
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('announce_panel_create')
            .setLabel('Create')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('announce_panel_list')
            .setLabel('View All')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('announce_panel_send')
            .setLabel('Send')
            .setEmoji('📤')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('announce_panel_schedule')
            .setLabel('Schedule')
            .setEmoji('⏰')
            .setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('announce_panel_status')
            .setLabel('Check Status')
            .setEmoji('📊')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('announce_panel_templates')
            .setLabel('Templates')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('announce_panel_delete')
            .setLabel('Delete')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({
          embeds: [embed],
          components: [row1, row2],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      case 'embeds': {
        const embed = buildCommunityCustomEmbedsEmbed();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('embed_panel_create')
            .setLabel('Create Embed')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('embed_panel_send')
            .setLabel('Send Embed')
            .setEmoji('📤')
            .setStyle(ButtonStyle.Secondary)
        );
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      case 'roles': {
        const embed = buildCommunityReactionRolesEmbed();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('reactionrole_panel_list')
            .setLabel('List Panels')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('reactionrole_panel_create')
            .setLabel('Create Panel')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('reactionrole_panel_send')
            .setLabel('Send Panel')
            .setEmoji('📤')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('reactionrole_panel_delete')
            .setLabel('Delete Panel')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
        );
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
      default:
        await interaction.reply({ content: '❌ Unknown action.', flags: MessageFlags.Ephemeral });
    }
  },
};
