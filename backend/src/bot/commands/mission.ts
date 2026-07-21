import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
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

import {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { missionSchemas } from '../../schemas/missionSchemas';
import { MissionService } from '../../services/content/MissionService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  buildMissionCreatedEmbed,
  buildMissionDetailEmbed,
  buildMissionListEmbed,
  buildMissionStatusUpdatedEmbed,
  capitalise,
  getStatusEmoji,
} from '../embeds/missionEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { dmAwareEditReply } from '../utils/dmAwareReply';
import { replyWithError } from '../utils/errorReply';
import { emitRealtimeToOrg } from '../utils/realtimeEmit';
import { buildMissionStatusSelect, buildMissionTypeSelect } from '../utils/sharedChoices';

import { BotCommand } from './types';

const missionService = new MissionService();
const guildOrgService = GuildOrganizationService.getInstance();

// ── Pre-modal state: stores mission type chosen via select menu ──
interface PendingMissionCreate {
  missionType: MissionType;
  timestamp: number;
}

const pendingMissionCreates = new Map<string, PendingMissionCreate>();
const PENDING_MISSION_TTL_MS = 10 * 60 * 1000;

function cleanPendingMissionCreates(): void {
  const now = Date.now();
  for (const [key, val] of pendingMissionCreates) {
    if (now - val.timestamp > PENDING_MISSION_TTL_MS) {
      pendingMissionCreates.delete(key);
    }
  }
}

// Embed rendering and mission presentation labels are centralized in missionEmbeds.

async function handleList(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  organizationId: string
): Promise<void> {
  const statusFilter = interaction.isChatInputCommand()
    ? (interaction.options.getString('status') as MissionStatus | null)
    : null;
  const typeFilter = interaction.isChatInputCommand()
    ? (interaction.options.getString('type') as MissionType | null)
    : null;

  const result = await missionService.getAllMissions(
    organizationId,
    { page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'DESC' },
    {
      status: statusFilter ?? undefined,
      missionType: typeFilter ?? undefined,
    }
  );

  const filterParts: string[] = [];
  if (statusFilter) {
    filterParts.push(`Status: ${capitalise(statusFilter)}`);
  }
  if (typeFilter) {
    filterParts.push(`Type: ${capitalise(typeFilter)}`);
  }
  const filterText = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : '';

  const embed = buildMissionListEmbed(result.data, `🎯 Organization Missions${filterText}`);

  if (result.pagination.total > 10) {
    embed.setFooter({
      text: `Showing 10 of ${result.pagination.total} missions · Page ${result.pagination.page}/${result.pagination.totalPages}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleActive(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  organizationId: string
): Promise<void> {
  const missions = await missionService.getActiveMissions(organizationId);
  const embed = buildMissionListEmbed(missions, '🚀 Active Missions');
  await interaction.editReply({ embeds: [embed] });
}

export const mission: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('mission')
    .setDescription('Create, list, and manage organization missions'),
  cooldown: 5,
  category: 'events',
  guildOnly: true,
  examples: [
    '/mission create title:Mining Op type:Mining difficulty:Medium',
    '/mission list status:In Progress',
    '/mission view id:<mission-uuid>',
    '/mission active',
    '/mission status id:<mission-uuid> new_status:In Progress',
  ],

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'mission');
    if (!sub) {
      return;
    }

    if (sub === 'list' || sub === 'active') {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        if (sub === 'list') {
          await handleList(interaction, organizationId);
        } else {
          await handleActive(interaction, organizationId);
        }
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    } else if (sub === 'briefing') {
      // Open the briefing sub-panel
      const { buildCommandPanel } = await import('../utils/commandPanelBuilder');
      const { embed, components } = buildCommandPanel({
        prefix: 'briefing',
        title: '\ud83d\udcdd Mission Briefings',
        description: 'Generate briefings for your missions.',
        buttons: [
          {
            subcommand: 'usage',
            label: 'View Usage Stats',
            emoji: '\ud83d\udcca',
            style: ButtonStyle.Primary,
          },
          { subcommand: 'generate', label: 'Generate Briefing', emoji: '\ud83c\udfaf' },
          { subcommand: 'quick', label: 'Quick Briefing', emoji: '\u26a1' },
        ],
      });
      await interaction.reply({ embeds: [embed], components, flags: MessageFlags.Ephemeral });
    } else if (sub === 'create') {
      // Step 1: Show mission type select before the creation modal
      const row = buildMissionTypeSelect('mission_select_create_type');
      await interaction.reply({
        content: '🎯 **Create Mission** — What type of mission is this?',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === 'view' || sub === 'status') {
      // Populate with org missions
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const missions = await missionService.getActiveMissions(organizationId);

        if (missions.length > 0) {
          const options = missions.slice(0, 25).map(m => ({
            label: (m.title || 'Untitled').substring(0, 100),
            value: m.id,
            description: `${capitalise(m.status)} \u2022 ${capitalise(m.missionType)}`.substring(
              0,
              100
            ),
            emoji: getStatusEmoji(m.status),
          }));
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(sub === 'view' ? 'mission_view_select' : 'mission_status_pick')
              .setPlaceholder('Select a mission...')
              .addOptions(options)
          );
          await interaction.editReply({
            content:
              sub === 'view' ? 'Select a mission to view:' : 'Select a mission to update status:',
            components: [row],
          });
          return;
        }
        // No missions found
        await interaction.editReply(
          'No active missions found. Create one first with the Create Mission button.'
        );
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: `\u274c Error: ${msg}` });
        } else {
          await interaction.reply({
            content: `\u274c Error: ${msg}`,
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    const { customId } = interaction;

    // ── Pre-modal type select for mission creation ──
    if (customId === 'mission_select_create_type') {
      cleanPendingMissionCreates();
      const selectedType = interaction.values[0] as MissionType;
      if (!Object.values(MissionType).includes(selectedType)) {
        await interaction.reply({
          content: '❌ Invalid mission type selected.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Store selected type keyed by user id
      pendingMissionCreates.set(interaction.user.id, {
        missionType: selectedType,
        timestamp: Date.now(),
      });

      // Show the creation modal
      const modal = new ModalBuilder()
        .setCustomId('mission_create_modal')
        .setTitle(`Create ${capitalise(selectedType)} Mission`);

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setPlaceholder('Enter mission title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setPlaceholder('Describe the mission objectives...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(1000);

      const locationInput = new TextInputBuilder()
        .setCustomId('location')
        .setPlaceholder('e.g. Stanton, Pyro, Crusader')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

      const rewardInput = new TextInputBuilder()
        .setCustomId('reward')
        .setPlaceholder('e.g. 50,000 aUEC')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(100);

      modal.addLabelComponents(
        new LabelBuilder().setLabel('Mission Title').setTextInputComponent(titleInput),
        new LabelBuilder().setLabel('Description (optional)').setTextInputComponent(descInput),
        new LabelBuilder().setLabel('Location (optional)').setTextInputComponent(locationInput),
        new LabelBuilder().setLabel('Reward (optional)').setTextInputComponent(rewardInput)
      );
      await interaction.showModal(modal);
      return;
    }

    if (customId === 'mission_view_select') {
      const missionId = interaction.values[0];
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const mission = await missionService.getMissionById(missionId, organizationId);
        if (!mission) {
          await interaction.editReply({ content: '\u274c Mission not found.' });
          return;
        }
        const embed = buildMissionDetailEmbed(mission);
        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({ content: `\u274c Error: ${getErrorMessage(error)}` });
      }
    } else if (customId === 'mission_status_pick') {
      const missionId = interaction.values[0];
      const row = buildMissionStatusSelect(`mission_status_select_${missionId}`);
      await interaction.reply({
        content: `Select the new status for this mission:`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else if (customId.startsWith('mission_status_select_')) {
      const missionId = customId.replace('mission_status_select_', '');
      const newStatus = interaction.values[0] as MissionStatus;

      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const mission = await missionService.transitionStatus(missionId, organizationId, newStatus);
        if (!mission) {
          await interaction.editReply({
            content: '\u274c Mission not found or status transition not allowed.',
          });
          return;
        }
        emitRealtimeToOrg(organizationId, 'mission:status_changed', {
          missionId: mission.id,
          title: mission.title,
          status: mission.status,
        });
        const embed = buildMissionStatusUpdatedEmbed({
          missionId: mission.id,
          missionTitle: mission.title,
          status: mission.status,
        });
        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({ content: `\u274c Error: ${getErrorMessage(error)}` });
      }
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    const { customId } = interaction;

    if (customId === 'mission_create_modal') {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim() || undefined;
        const location = interaction.fields.getTextInputValue('location').trim() || undefined;
        const reward = interaction.fields.getTextInputValue('reward').trim() || undefined;

        // Retrieve the mission type selected in the pre-modal step (default: CUSTOM)
        const pending = pendingMissionCreates.get(interaction.user.id);
        const missionType = pending?.missionType ?? MissionType.CUSTOM;
        pendingMissionCreates.delete(interaction.user.id);

        // Validate against the same Joi schema used by the REST endpoint so
        // bot users get the same field-level errors as web clients.
        const { error: validationError, value: validated } = missionSchemas.create.validate(
          {
            title,
            description,
            missionType,
            difficulty: MissionDifficulty.MEDIUM,
            priority: MissionPriority.NORMAL,
            location,
            reward,
          },
          { abortEarly: false, stripUnknown: true }
        );
        if (validationError) {
          await replyWithError(interaction, validationError, { context: 'mission.create.modal' });
          return;
        }

        const mission = await missionService.createMission(organizationId, {
          ...(validated as Record<string, unknown>),
          createdBy: interaction.user.id,
        });

        emitRealtimeToOrg(organizationId, 'mission:created', {
          missionId: mission.id,
          title: mission.title,
          missionType: mission.missionType,
          createdBy: interaction.user.id,
        });

        const embed = buildMissionCreatedEmbed({
          missionId: mission.id,
          missionTitle: mission.title,
          missionType: mission.missionType,
          difficulty: mission.difficulty,
          priority: mission.priority,
          location: mission.location,
          reward: mission.reward,
        });

        await dmAwareEditReply(interaction, { embeds: [embed] });
      } catch (error: unknown) {
        await replyWithError(interaction, error, { context: 'mission.create.modal' });
      }
    } else if (customId === 'mission_view_modal') {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await guildOrgService.resolveOrganization(interaction.guildId);
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const missionId = interaction.fields.getTextInputValue('mission_id').trim();
        const mission = await missionService.getMissionById(missionId, organizationId);

        if (!mission) {
          await interaction.editReply({ content: '\u274c Mission not found.' });
          return;
        }

        const embed = buildMissionDetailEmbed(mission);
        await interaction.editReply({ embeds: [embed] });
      } catch (error: unknown) {
        await interaction.editReply({ content: `\u274c Error: ${getErrorMessage(error)}` });
      }
    } else if (customId === 'mission_status_modal') {
      const missionId = interaction.fields.getTextInputValue('mission_id').trim();

      const row = buildMissionStatusSelect(`mission_status_select_${missionId}`);
      await interaction.reply({
        content: `Select the new status for mission \`${missionId}\`:`,
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '\u274c This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const panelConfig: CommandPanelConfig = {
      prefix: 'mission',
      title: '\ud83c\udfaf Mission Command',
      description: 'Create and manage organization missions.',
      buttons: [
        {
          subcommand: 'list',
          label: 'List Missions',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'active', label: 'Active Missions', emoji: '\ud83d\udfe2' },
        {
          subcommand: 'create',
          label: 'Create Mission',
          emoji: '\u2795',
          style: ButtonStyle.Success,
        },
        { subcommand: 'view', label: 'View Mission', emoji: '\ud83d\udd0d' },
        { subcommand: 'status', label: 'Update Status', emoji: '\ud83d\udd04' },
        { subcommand: 'briefing', label: 'Briefing', emoji: '\ud83d\udcdd' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};
