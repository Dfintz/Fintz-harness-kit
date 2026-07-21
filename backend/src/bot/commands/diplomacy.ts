import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
} from 'discord.js';

import { RelationObject } from '../../types/models';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import { botApiClient, discordHeaders } from '../utils/botApiClient';
import { buildCustomId, parseCustomId } from '../utils/customId';

import { BotCommand } from './types';

// Alliance type emojis
const ALLIANCE_TYPE_EMOJIS: Record<string, string> = {
  alliance: '🤝',
  trade: '💰',
  defense: '🛡️',
  neutral: '⚖️',
  hostile: '⚔️',
};

const DIPLOMACY_PREFIX = 'diplomacy';

function buildDiplomacyProposeModalCustomId(allianceType: string): string {
  return buildCustomId(DIPLOMACY_PREFIX, 'propose', 'modal', allianceType);
}

export function parseDiplomacyProposeModalType(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== DIPLOMACY_PREFIX || parsed.action !== 'propose') {
    return null;
  }

  const [kind = '', allianceType = ''] = parsed.params;
  if (kind !== 'modal' || allianceType.length === 0) {
    return null;
  }

  return allianceType;
}

/**
 * Diplomacy Command
 *
 * Provides Discord integration for organization diplomacy including:
 * - Viewing diplomatic relations
 * - Proposing new alliances/treaties
 * - Reporting and managing incidents
 * - Creating tickets for diplomatic issues
 */
export const diplomacy: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('diplomacy')
    .setDescription('Organization diplomacy and alliance management'),

  cooldown: 5,
  category: 'organization',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '\u274c This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await handleCreatePanel(interaction);
  },

  /**
   * Handles diplomacy panel button interactions (diplomacy_panel_*).
   */
  async handleButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'diplomacy_panel_status') {
      try {
        await handleStatus(interaction);
      } catch (error: unknown) {
        const msg = getErrorMessage(error, 'Failed to fetch diplomatic status');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
        } else {
          await interaction.reply({ content: `\u274c ${msg}`, flags: MessageFlags.Ephemeral });
        }
      }
    } else if (customId === 'diplomacy_panel_propose') {
      // Show a select menu to pick alliance type, then a modal for details
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('diplomacy_propose_type')
          .setPlaceholder('Select alliance type...')
          .addOptions(
            {
              label: 'Alliance',
              value: 'alliance',
              emoji: '\ud83e\udd1d',
              description: 'Full cooperation and mutual support',
            },
            {
              label: 'Trade Agreement',
              value: 'trade',
              emoji: '\ud83d\udcb0',
              description: 'Economic partnerships and trade routes',
            },
            {
              label: 'Defense Pact',
              value: 'defense',
              emoji: '\ud83d\udee1\ufe0f',
              description: 'Mutual defense agreements',
            },
            {
              label: 'Neutral',
              value: 'neutral',
              emoji: '\u2696\ufe0f',
              description: 'Non-aggression understanding',
            }
          )
      );
      await interaction.reply({
        content: '**Step 1/2:** Select the type of diplomatic relation to propose:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId === 'diplomacy_panel_incident') {
      // Show modal to collect relation_id and incident details
      const modal = new ModalBuilder()
        .setCustomId('diplomacy_panel_incident_modal')
        .setTitle('Report Diplomatic Incident');

      const relationIdInput = new TextInputBuilder()
        .setCustomId('relation_id')
        .setPlaceholder('Enter the diplomacy relation ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('description')
        .setPlaceholder('Describe what happened in detail...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(2000);

      const severityInput = new TextInputBuilder()
        .setCustomId('severity')
        .setPlaceholder('e.g., medium')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(20);

      modal.addLabelComponents(
        new LabelBuilder().setLabel('Relation ID').setTextInputComponent(relationIdInput),
        new LabelBuilder().setLabel('Description').setTextInputComponent(descriptionInput),
        new LabelBuilder()
          .setLabel('Severity (low / medium / high / critical)')
          .setTextInputComponent(severityInput)
      );
      await interaction.showModal(modal);
    } else if (customId === 'diplomacy_panel_ticket') {
      await handleTicket(interaction);
    } else {
      await interaction.reply({
        content: '\u274c Unknown diplomacy action.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  /**
   * Handles diplomacy select menu interactions.
   */
  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const customId = interaction.customId;

    if (customId === 'diplomacy_propose_type') {
      const allianceType = interaction.values[0];
      // Show modal to collect target org + terms
      const modal = new ModalBuilder()
        .setCustomId(buildDiplomacyProposeModalCustomId(allianceType))
        .setTitle(`Propose ${allianceType.charAt(0).toUpperCase() + allianceType.slice(1)}`);

      const targetOrgInput = new TextInputBuilder()
        .setCustomId('target_org')
        .setPlaceholder('Enter the target organization ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const termsInput = new TextInputBuilder()
        .setCustomId('terms')
        .setPlaceholder('List the terms of this diplomatic agreement...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(2000);

      const notesInput = new TextInputBuilder()
        .setCustomId('notes')
        .setPlaceholder('Any additional context or notes...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      modal.addLabelComponents(
        new LabelBuilder().setLabel('Target Organization ID').setTextInputComponent(targetOrgInput),
        new LabelBuilder().setLabel('Terms and Conditions').setTextInputComponent(termsInput),
        new LabelBuilder().setLabel('Additional Notes').setTextInputComponent(notesInput)
      );
      await interaction.showModal(modal);
    }
  },

  /**
   * Handles diplomacy modal submissions from panel flows.
   */
  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId } = interaction;

    const panelAllianceType = parseDiplomacyProposeModalType(customId);
    if (panelAllianceType) {
      // Panel propose flow: diplomacy_propose_modal_{allianceType}
      const allianceType = panelAllianceType;
      const targetOrg = interaction.fields.getTextInputValue('target_org').trim();
      const terms = interaction.fields.getTextInputValue('terms').trim();
      const notes = interaction.fields.getTextInputValue('notes')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const response = await botApiClient.post(
          '/v2/alliance-diplomacy',
          {
            targetOrganizationId: targetOrg,
            allianceType,
            terms: terms.split('\n').filter(t => t.trim()),
            notes,
          },
          { headers: discordHeaders(interaction) }
        );

        const typeEmoji = ALLIANCE_TYPE_EMOJIS[allianceType] || '\ud83d\udccb';
        const embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle(`${typeEmoji} Diplomatic Proposal Sent`)
          .setDescription(
            `A **${allianceType}** proposal has been sent to organization **${targetOrg}**.`
          )
          .addFields(
            { name: 'Type', value: allianceType, inline: true },
            { name: 'Status', value: 'Pending', inline: true }
          )
          .setTimestamp();

        if (response.data?.id) {
          embed.setFooter({ text: `Relation ID: ${response.data.id}` });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({
          content: `\u274c Failed to send proposal: ${getErrorMessage(error)}`,
        });
      }
    } else if (customId === 'diplomacy_panel_incident_modal') {
      // Panel incident flow
      const relationId = interaction.fields.getTextInputValue('relation_id').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const severity = interaction.fields.getTextInputValue('severity').toLowerCase().trim();

      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(severity)) {
        await interaction.reply({
          content: `\u274c Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        await botApiClient.post(
          `/v2/alliance-diplomacy/${relationId}/incidents`,
          { description, severity },
          { headers: discordHeaders(interaction) }
        );

        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('\u26a0\ufe0f Diplomatic Incident Reported')
          .setDescription(description.substring(0, 200))
          .addFields(
            { name: 'Relation', value: relationId, inline: true },
            { name: 'Severity', value: severity, inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({
          content: `\u274c Failed to report incident: ${getErrorMessage(error)}`,
        });
      }
    } else if (customId.startsWith('diplomacy_propose_')) {
      // Original slash command propose flow: diplomacy_propose_{targetOrg}_{allianceType}
      const parts = customId.replace('diplomacy_propose_', '').split('_');
      const targetOrg = parts.slice(0, -1).join('_');
      const allianceType = parts[parts.length - 1];
      const terms = interaction.fields.getTextInputValue('terms').trim();
      const notes = interaction.fields.getTextInputValue('notes')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        const response = await botApiClient.post(
          '/v2/alliance-diplomacy',
          {
            targetOrganizationId: targetOrg,
            allianceType,
            terms: terms.split('\n').filter(t => t.trim()),
            notes,
          },
          { headers: discordHeaders(interaction) }
        );

        const typeEmoji = ALLIANCE_TYPE_EMOJIS[allianceType] || '\ud83d\udccb';
        const embed = new EmbedBuilder()
          .setColor(0xffaa00)
          .setTitle(`${typeEmoji} Diplomatic Proposal Sent`)
          .setDescription(
            `A **${allianceType}** proposal has been sent to organization **${targetOrg}**.`
          )
          .addFields(
            { name: 'Type', value: allianceType, inline: true },
            { name: 'Status', value: 'Pending', inline: true }
          )
          .setTimestamp();

        if (response.data?.id) {
          embed.setFooter({ text: `Relation ID: ${response.data.id}` });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({
          content: `\u274c Failed to send proposal: ${getErrorMessage(error)}`,
        });
      }
    } else if (customId.startsWith('diplomacy_incident_modal_')) {
      // Original slash command incident flow: diplomacy_incident_modal_{relationId}
      const relationId = customId.replace('diplomacy_incident_modal_', '');
      const description = interaction.fields.getTextInputValue('description').trim();
      const severity = interaction.fields.getTextInputValue('severity').toLowerCase().trim();

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        await botApiClient.post(
          `/v2/alliance-diplomacy/${relationId}/incidents`,
          { description, severity },
          { headers: discordHeaders(interaction) }
        );

        const embed = new EmbedBuilder()
          .setColor(0xff4444)
          .setTitle('\u26a0\ufe0f Diplomatic Incident Reported')
          .setDescription(description.substring(0, 200))
          .addFields(
            { name: 'Relation', value: relationId, inline: true },
            { name: 'Severity', value: severity, inline: true }
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({
          content: `\u274c Failed to report incident: ${getErrorMessage(error)}`,
        });
      }
    } else if (customId === 'diplomacy_ticket_modal') {
      // Ticket modal submission
      const subject = interaction.fields.getTextInputValue('subject').trim();
      const description = interaction.fields.getTextInputValue('description').trim();
      const involvedOrg = interaction.fields.getTextInputValue('involved_org')?.trim() || undefined;

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      try {
        await botApiClient.post(
          '/v2/tickets',
          {
            subject,
            description,
            category: 'diplomacy',
            recipientType: 'diplomacy',
            metadata: involvedOrg ? { involvedOrganization: involvedOrg } : undefined,
          },
          { headers: discordHeaders(interaction) }
        );

        const embed = new EmbedBuilder()
          .setColor(0x00d9ff)
          .setTitle('\ud83c\udfab Diplomacy Ticket Created')
          .setDescription(`**${subject}**\n\n${description.substring(0, 200)}...`)
          .setTimestamp();

        if (involvedOrg) {
          embed.addFields({ name: 'Involved Org(s)', value: involvedOrg, inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({
          content: `\u274c Failed to create ticket: ${getErrorMessage(error)}`,
        });
      }
    } else {
      await interaction.reply({
        content: '\u274c Unknown diplomacy form.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

/**
 * Show diplomatic status overview
 */
async function handleStatus(interaction: ButtonInteraction | ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const response = await botApiClient.get('/v2/alliance-diplomacy', {
      headers: discordHeaders(interaction),
    });

    const relations = response.data.data || response.data || [];

    if (relations.length === 0) {
      await interaction.editReply({
        content:
          '📭 No diplomatic relations established. Use `/diplomacy propose` to initiate one!',
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00d9ff)
      .setTitle('🌍 Diplomatic Relations Overview')
      .setDescription(`Your organization has ${relations.length} diplomatic relation(s)`)
      .setTimestamp();

    // Group by status
    const active = relations.filter((r: RelationObject) => r.status === 'active');
    const proposed = relations.filter((r: RelationObject) => r.status === 'proposed');
    const suspended = relations.filter((r: RelationObject) => r.status === 'suspended');

    if (active.length > 0) {
      const activeList = active
        .slice(0, 5)
        .map((r: RelationObject) => {
          const typeEmoji = ALLIANCE_TYPE_EMOJIS[r.allianceType || ''] || '📋';
          return `${typeEmoji} **${r.orgId2}** - ${r.allianceType}`;
        })
        .join('\n');
      embed.addFields({
        name: `✅ Active Relations (${active.length})`,
        value: activeList,
        inline: false,
      });
    }

    if (proposed.length > 0) {
      const proposedList = proposed
        .slice(0, 5)
        .map((r: RelationObject) => {
          const typeEmoji = ALLIANCE_TYPE_EMOJIS[r.allianceType || ''] || '📋';
          return `${typeEmoji} **${r.orgId2}** - ${r.allianceType} (pending)`;
        })
        .join('\n');
      embed.addFields({
        name: `⏳ Pending Proposals (${proposed.length})`,
        value: proposedList,
        inline: false,
      });
    }

    if (suspended.length > 0) {
      const suspendedList = suspended
        .slice(0, 3)
        .map((r: RelationObject) => `⚠️ **${r.orgId2}** - ${r.allianceType}`)
        .join('\n');
      embed.addFields({
        name: `🔴 Suspended (${suspended.length})`,
        value: suspendedList,
        inline: false,
      });
    }

    // Add quick action buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('diplomacy_propose')
        .setLabel('New Proposal')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝'),
      new ButtonBuilder()
        .setCustomId('diplomacy_incident')
        .setLabel('Report Incident')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️'),
      new ButtonBuilder()
        .setCustomId('diplomacy_ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎫')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error: unknown) {
    logError(error, 'DiplomacyCommand.handleStatus');

    await interaction.editReply({
      content: `❌ Failed to fetch diplomatic relations: ${getErrorMessage(error)}`,
    });
  }
}

/**
 * Create a diplomacy support ticket
 */
async function handleTicket(interaction: ButtonInteraction | ChatInputCommandInteraction) {
  // Show modal for ticket creation
  const modal = new ModalBuilder()
    .setCustomId('diplomacy_ticket_modal')
    .setTitle('🤝 Diplomacy Support Ticket');

  const subjectInput = new TextInputBuilder()
    .setCustomId('subject')
    .setPlaceholder('Brief summary of the diplomatic issue')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(200);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setPlaceholder('Provide details about the diplomatic situation...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(20)
    .setMaxLength(2000);

  const involvedOrgInput = new TextInputBuilder()
    .setCustomId('involved_org')
    .setPlaceholder('Names or IDs of organizations involved')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Subject').setTextInputComponent(subjectInput),
    new LabelBuilder().setLabel('Description').setTextInputComponent(descriptionInput),
    new LabelBuilder().setLabel('Involved Organization(s)').setTextInputComponent(involvedOrgInput)
  );

  await interaction.showModal(modal);
}

/**
 * Create a diplomacy status panel
 */
async function handleCreatePanel(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to create a diplomacy panel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x00d9ff)
    .setTitle('🌍 Diplomatic Relations Center')
    .setDescription(
      [
        "Manage your organization's diplomatic relations with other groups.",
        '',
        '**Available Actions:**',
        '• View current alliances and agreements',
        '• Propose new diplomatic relations',
        '• Report incidents that affect relations',
        '• Create support tickets for complex situations',
        '',
        '**Relation Types:**',
        '🤝 **Alliance** - Full cooperation and mutual support',
        '💰 **Trade** - Economic partnerships and trade routes',
        '🛡️ **Defense Pact** - Mutual defense agreements',
        '⚖️ **Neutral** - Non-aggression understanding',
      ].join('\n')
    )
    .setFooter({ text: 'Use the buttons below to get started' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('diplomacy_panel_status')
      .setLabel('View Relations')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🌍'),
    new ButtonBuilder()
      .setCustomId('diplomacy_panel_propose')
      .setLabel('New Proposal')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📝'),
    new ButtonBuilder()
      .setCustomId('diplomacy_panel_incident')
      .setLabel('Report Incident')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('diplomacy_panel_ticket')
      .setLabel('Support Ticket')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎫')
  );

  await interaction.reply({ content: 'Diplomacy panel created!', flags: MessageFlags.Ephemeral });
  // @ts-expect-error - Strict mode compatibility
  await interaction.channel?.send({ embeds: [embed], components: [row] });
}
