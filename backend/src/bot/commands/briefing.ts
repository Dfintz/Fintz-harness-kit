import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';

import { MissionDifficulty, MissionType } from '../../models/Mission';
import {
  AIBriefingElement,
  AIBriefingGenerationService,
} from '../../services/content/AIBriefingGenerationService';
import { MissionService } from '../../services/content/MissionService';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  buildBriefingUsageEmbed,
  buildGeneratedMissionBriefingEmbed,
  buildQuickMissionBriefingEmbed,
} from '../embeds/briefingEmbeds';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { BotFeatureFlag, resolveGuildFeatureFlag } from '../utils/guildFeatureFlags';
import { buildMissionTypeSelect } from '../utils/sharedChoices';

import { BotCommand } from './types';

let _services: {
  missionService: MissionService;
  aiBriefingService: AIBriefingGenerationService;
  guildOrgService: GuildOrganizationService;
} | null = null;

function getServices() {
  _services ??= {
    missionService: new MissionService(),
    aiBriefingService: new AIBriefingGenerationService(),
    guildOrgService: GuildOrganizationService.getInstance(),
  };
  return _services;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum embed description length (Discord limit is 4096) */
const MAX_DESCRIPTION_LENGTH = 3900;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ');
}

function getElementIcon(type: AIBriefingElement['type']): string {
  switch (type) {
    case 'header':
      return '📌';
    case 'text':
      return '';
    case 'objective':
      return '🎯';
    case 'warning':
      return '⚠️';
    case 'timeline':
      return '⏱️';
    case 'role-assignment':
      return '👤';
    default:
      return '';
  }
}

/**
 * Render AI briefing elements into a Markdown string suitable for Discord embeds.
 */
function renderBriefingElements(elements: AIBriefingElement[]): string {
  const lines: string[] = [];

  for (const el of elements) {
    const icon = getElementIcon(el.type);

    switch (el.type) {
      case 'header':
        lines.push(`\n**${icon} ${el.content}**`);
        break;
      case 'warning':
        lines.push(`${icon} **Warning:** ${el.content}`);
        break;
      case 'objective':
        lines.push(`${icon} ${el.content}`);
        break;
      case 'timeline':
        lines.push(`${icon} ${el.content}`);
        break;
      case 'role-assignment':
        lines.push(`${icon} ${el.content}`);
        break;
      case 'text':
      default:
        lines.push(el.content);
        break;
    }
  }

  const text = lines.join('\n').trim();

  // Truncate if too long for Discord embed
  if (text.length > MAX_DESCRIPTION_LENGTH) {
    return `${text.slice(
      0,
      MAX_DESCRIPTION_LENGTH
    )}\n\n*...briefing truncated for Discord. View full briefing on the web app.*`;
  }

  return text;
}

// ---------------------------------------------------------------------------
// Subcommand handlers
// ---------------------------------------------------------------------------

async function handleUsage(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  organizationId: string
): Promise<void> {
  const stats = await getServices().aiBriefingService.getUsageStats(organizationId);
  const embed = buildBriefingUsageEmbed(stats);

  await interaction.editReply({ embeds: [embed] });
}

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

export const briefing: BotCommand = {
  data: new SlashCommandBuilder().setName('briefing').setDescription('Generate mission briefings'),
  cooldown: 10,
  category: 'organization',
  guildOnly: true,
  examples: [
    '/briefing generate mission_id:<uuid>',
    '/briefing quick type:Combat difficulty:Hard location:Stanton',
    '/briefing usage',
  ],

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'briefing');
    if (!sub) {
      return;
    }

    if (sub === 'usage') {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await getServices().guildOrgService.resolveOrganization(
          interaction.guildId
        );
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        await handleUsage(interaction, organizationId);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    } else if (sub === 'generate') {
      // Populate mission select from org missions
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const organizationId = await getServices().guildOrgService.resolveOrganization(
          interaction.guildId
        );
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const missions = await getServices().missionService.getActiveMissions(organizationId);

        if (missions.length > 0) {
          const options = missions.slice(0, 25).map(m => ({
            label: (m.title || 'Untitled').substring(0, 100),
            value: m.id,
            description: `${m.missionType} \u2022 ${m.difficulty}`.substring(0, 100),
          }));
          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('briefing_generate_select')
              .setPlaceholder('Select a mission to generate briefing for...')
              .addOptions(options)
          );
          await interaction.editReply({
            content: 'Select a mission to generate a briefing for:',
            components: [row],
          });
          return;
        }
        await interaction.editReply('No active missions found. Create a mission first.');
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
    } else if (sub === 'quick') {
      // Show select menu for mission type
      const row = buildMissionTypeSelect('briefing_quick_type');
      await interaction.reply({
        content: 'Select the mission type for the quick briefing:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  },

  handleSelectMenu: async (interaction: StringSelectMenuInteraction) => {
    if (interaction.customId === 'briefing_generate_select') {
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
        const organizationId = await getServices().guildOrgService.resolveOrganization(
          interaction.guildId
        );
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        await handleGenerate_fromPanel(
          interaction as unknown as ModalSubmitInteraction,
          organizationId,
          missionId
        );
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    } else if (interaction.customId === 'briefing_quick_type') {
      const missionType = interaction.values[0] as MissionType;

      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await getServices().guildOrgService.resolveOrganization(
          interaction.guildId
        );
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        await handleQuick_fromPanel(interaction, organizationId, missionType);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    if (interaction.customId === 'briefing_generate_modal') {
      if (!interaction.guildId) {
        await interaction.reply({
          content: '\u274c Must be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const organizationId = await getServices().guildOrgService.resolveOrganization(
          interaction.guildId
        );
        if (!organizationId) {
          await interaction.editReply({
            content: '❌ This server is not linked to an organization. Use `/guild setup` first.',
          });
          return;
        }
        const missionId = interaction.fields.getTextInputValue('mission_id').trim();
        await handleGenerate_fromPanel(interaction, organizationId, missionId);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        await interaction.editReply({ content: `\u274c Error: ${msg}` });
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const panelConfig: CommandPanelConfig = {
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
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

// ---------------------------------------------------------------------------
// Panel helper functions (reuse generation logic without ChatInputCommandInteraction)
// ---------------------------------------------------------------------------

/**
 * ARCH-11 feature-flag gate: short-circuit the expensive Azure OpenAI call with a
 * friendly notice when the `aiBriefings` flag resolves disabled for this guild.
 * The flag is resolved by layering the operator env kill-switch
 * (`BOT_FEATURE_AI_BRIEFINGS`) over the guild's persisted override (the
 * `DiscordSettings` per-guild layer) over the default-on registry value. Returns
 * `true` when disabled so the caller stops before generating. Default-on, so this
 * is a no-op unless an operator or the guild explicitly disables it.
 */
async function aiBriefingsDisabled(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  organizationId: string
): Promise<boolean> {
  const { guildId } = interaction;
  const overrides = guildId
    ? await discordSettingsService.getGuildFeatureFlagOverrides(organizationId, guildId)
    : undefined;
  if (resolveGuildFeatureFlag(BotFeatureFlag.AI_BRIEFINGS, overrides)) {
    return false;
  }
  await interaction.editReply({
    content: 'ℹ️ AI briefing generation is currently disabled for this server.',
  });
  return true;
}

async function handleGenerate_fromPanel(
  interaction: ModalSubmitInteraction,
  organizationId: string,
  missionId: string
): Promise<void> {
  if (await aiBriefingsDisabled(interaction, organizationId)) {
    return;
  }

  const mission = await getServices().missionService.getMissionById(missionId, organizationId);
  if (!mission) {
    await interaction.editReply({
      content:
        '\u274c Mission not found. Ensure the mission ID is correct and belongs to your organization.',
    });
    return;
  }

  await interaction.editReply({
    content: `Generating briefing for **${mission.title}**... This may take a moment.`,
  });

  try {
    const result = await getServices().aiBriefingService.generateBriefing(
      organizationId,
      interaction.user.id,
      {
        missionType: mission.missionType,
        objectives: mission.objectives ?? [],
        difficulty: mission.difficulty,
        location: mission.location ?? undefined,
        participantCount: mission.participants?.length ?? 0,
        additionalContext: mission.description ?? undefined,
      }
    );

    const briefingText = renderBriefingElements(result.briefingElements);

    const embed = buildGeneratedMissionBriefingEmbed({
      missionTitle: mission.title,
      briefingText,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
      missionId: mission.id,
    });

    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (genError: unknown) {
    const msg = getErrorMessage(genError);
    if (msg.includes('rate limit') || msg.includes('429')) {
      await interaction.editReply({
        content: '\u26a0\ufe0f Daily briefing generation limit reached. Try again tomorrow.',
      });
      return;
    }
    if (msg.includes('not configured') || msg.includes('503')) {
      await interaction.editReply({
        content: '\u26a0\ufe0f Briefing generation is not configured. Contact an administrator.',
      });
      return;
    }
    throw genError;
  }
}

async function handleQuick_fromPanel(
  interaction: StringSelectMenuInteraction,
  organizationId: string,
  missionType: MissionType
): Promise<void> {
  if (await aiBriefingsDisabled(interaction, organizationId)) {
    return;
  }

  await interaction.editReply({
    content: `Generating quick briefing for a **${capitalise(missionType)}** mission...`,
  });

  try {
    const result = await getServices().aiBriefingService.generateBriefing(
      organizationId,
      interaction.user.id,
      {
        missionType,
        objectives: [],
        difficulty: MissionDifficulty.MEDIUM,
      }
    );

    const briefingText = renderBriefingElements(result.briefingElements);

    const embed = buildQuickMissionBriefingEmbed({
      missionTypeLabel: capitalise(missionType),
      briefingText,
      modelUsed: result.modelUsed,
      tokensUsed: result.tokensUsed,
    });

    await interaction.editReply({ content: null, embeds: [embed] });
  } catch (genError: unknown) {
    const msg = getErrorMessage(genError);
    if (msg.includes('rate limit') || msg.includes('429')) {
      await interaction.editReply({
        content: '\u26a0\ufe0f Daily briefing generation limit reached. Try again tomorrow.',
      });
      return;
    }
    if (msg.includes('not configured') || msg.includes('503')) {
      await interaction.editReply({
        content: '\u26a0\ufe0f Briefing generation is not configured. Contact an administrator.',
      });
      return;
    }
    throw genError;
  }
}
