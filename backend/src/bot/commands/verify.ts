import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import {
  getDiscordWebLoginUrl,
  parseDiscordAccountLinkPrompt,
} from '../../utils/discordAccountLink';
import { API_BASE_URL } from '../constants/api';
import {
  buildDiscordAccountNotLinkedEmbed,
  buildNoRsiLinkEmbed,
  buildRsiLinkInitiatedEmbed,
  buildRsiLinkStatusEmbed,
  buildRsiLinkStatusNotLinkedEmbed,
  buildRsiUnlinkedEmbed,
  buildVerificationCompleteEmbed,
  buildVerificationPendingEmbed,
  type RsiLinkStatusInput,
} from '../embeds/verifyEmbeds';
// Use the bot's pre-configured axios instance so all internal API calls
// carry the X-Bot-Internal-Token header. Absolute URLs (built from
// API_BASE_URL) are passed through unchanged by axios.
import { botApiClient as axios, discordHeaders } from '../utils/botApiClient';
import { formatBotApiError } from '../utils/botErrorFormat';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';

import {
  handleRsiSyncAdminAction,
  isRsiSyncAdminAction,
  resolveOrgIdFromGuild,
} from './shared/rsiSyncAdminActions';
import { BotCommand } from './types';

async function tryReplyWithDiscordAccountLinkHint(
  interaction: ModalSubmitInteraction,
  error: unknown
): Promise<boolean> {
  const accountLinkHint = parseDiscordAccountLinkPrompt(error, {
    fallbackMessage: 'Sign in with Discord SSO on the web app, then retry this command.',
    fallbackLoginUrl: getDiscordWebLoginUrl(),
  });
  if (!accountLinkHint) {
    return false;
  }

  const embed = buildDiscordAccountNotLinkedEmbed(accountLinkHint.message);

  const loginButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(accountLinkHint.loginUrl)
    .setLabel('Sign In with Discord')
    .setEmoji('🔐');
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(loginButton);

  await interaction.editReply({ embeds: [embed], components: [row] });
  return true;
}

type VerifyActionSubcommand = 'user' | 'unlink' | 'check';

const VERIFY_ACTION_HANDLERS: Record<
  VerifyActionSubcommand,
  (interaction: ButtonInteraction, orgId: string | null) => Promise<void>
> = {
  user: handleUserButton,
  unlink: handleUnlinkButton,
  check: handleCheckButton,
};

function isVerifyActionSubcommand(value: string): value is VerifyActionSubcommand {
  return value === 'user' || value === 'unlink' || value === 'check';
}

const GUILD_LINK_REQUIRED_MESSAGE =
  '❌ This server is not linked to an organization.\n' +
  '• Ask an admin to run `/org` and use **Help → Server Setup** to verify the link.\n' +
  '• If you just linked it, wait ~30 seconds and try again.\n' +
  '• Ask an admin to use the `/org` server setup panel if this server is not linked yet.';

async function replyVerifyButtonActionError(
  interaction: ButtonInteraction,
  error: unknown
): Promise<void> {
  const msg = error instanceof Error ? error.message : 'An unexpected error occurred';
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content: `\u274c Error: ${msg}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `\u274c Error: ${msg}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleVerifyActionSubcommand(
  sub: VerifyActionSubcommand,
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  try {
    await VERIFY_ACTION_HANDLERS[sub](interaction, orgId);
  } catch (error: unknown) {
    await replyVerifyButtonActionError(interaction, error);
  }
}

async function showVerifyLinkModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('verify_link_modal').setTitle('Link RSI Account');

  const handleInput = new TextInputBuilder()
    .setCustomId('rsi_handle')
    .setPlaceholder('Enter your RSI / Star Citizen handle')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(60);

  const handleLabel = new LabelBuilder().setLabel('RSI Handle').setTextInputComponent(handleInput);

  modal.addLabelComponents(handleLabel);
  await interaction.showModal(modal);
}

/**
 * /verify — User-facing RSI verification panel.
 *
 * Allows members to link/unlink their RSI handle and check
 * their verification status. Admin sync features live in /rsisync.
 */
export const verify: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link and verify your RSI account'),

  category: 'organization',
  examples: ['/verify'],
  guildOnly: true,
  cooldown: 10,

  handleButton: async (interaction: ButtonInteraction) => {
    const sub = parsePanelCustomId(interaction.customId, 'verify');
    if (!sub) {
      return;
    }

    if (isRsiSyncAdminAction(sub)) {
      await handleRsiSyncAdminAction(sub, interaction);
      return;
    }

    // Resolve orgId from guild for button interactions (no slash-command options available)
    const guildId = interaction.guildId;
    const orgId = guildId ? await resolveOrgIdFromGuild(guildId) : null;

    if (isVerifyActionSubcommand(sub)) {
      await handleVerifyActionSubcommand(sub, interaction, orgId);
      return;
    }

    if (sub === 'link') {
      await showVerifyLinkModal(interaction);
    }
  },

  handleModal: async (interaction: ModalSubmitInteraction) => {
    if (interaction.customId === 'verify_link_modal') {
      const handle = interaction.fields.getTextInputValue('rsi_handle').trim();

      // Re-use the link handler by faking the options
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const orgId = interaction.guildId ? await resolveOrgIdFromGuild(interaction.guildId) : null;

        if (!orgId) {
          await interaction.editReply('\u274c Could not resolve organization for this server.');
          return;
        }

        const response = await axios.post<{
          data: { verificationUrl?: string; verificationCode?: string };
        }>(
          `${API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`,
          {
            rsiHandle: handle,
            verificationMethod: 'bio_code',
          },
          {
            headers: discordHeaders(interaction),
          }
        );

        const linkData = response.data.data;
        const profileUrl = `https://robertsspaceindustries.com/citizens/${encodeURIComponent(handle)}`;
        const verificationLink =
          typeof linkData.verificationUrl === 'string' ? linkData.verificationUrl : undefined;
        const verificationCode =
          typeof linkData.verificationCode === 'string' ? linkData.verificationCode : undefined;

        const embed = buildRsiLinkInitiatedEmbed(
          handle,
          profileUrl,
          verificationLink,
          verificationCode
        );

        // Add a "Check Verification" button so the user can verify immediately
        const checkButton = new ButtonBuilder()
          .setCustomId('verify_panel_check')
          .setLabel('Check Verification')
          .setEmoji('\u2705')
          .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(checkButton);

        await interaction.editReply({ embeds: [embed], components: [row] });
      } catch (error: unknown) {
        if (await tryReplyWithDiscordAccountLinkHint(interaction, error)) {
          return;
        }

        const msg = formatBotApiError(
          error,
          'Failed to link RSI account',
          `link:guild=${interaction.guildId}:user=${interaction.user.id}`
        );
        await interaction.editReply(`\u274c ${msg}`);
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const canManageRoles =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ?? false;

    const panelButtons: CommandPanelConfig['buttons'] = [
      {
        subcommand: 'link',
        label: 'Link RSI',
        emoji: '\ud83d\udd17',
        style: ButtonStyle.Success,
      },
      { subcommand: 'unlink', label: 'Unlink RSI', emoji: '\u274c' },
      {
        subcommand: 'user',
        label: 'My Verification',
        emoji: '\ud83d\udc64',
        style: ButtonStyle.Primary,
      },
    ];

    if (canManageRoles) {
      panelButtons.push(
        {
          subcommand: 'status',
          label: 'Sync Status',
          emoji: '📊',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'setup',
          label: 'Setup Wizard',
          emoji: '🔧',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'run',
          label: 'Run Sync',
          emoji: '🔄',
          style: ButtonStyle.Secondary,
        },
        {
          subcommand: 'audit',
          label: 'Audit',
          emoji: '📝',
          style: ButtonStyle.Secondary,
        }
      );
    }

    const panelConfig: CommandPanelConfig = {
      prefix: 'verify',
      title: '\u2705 RSI Verification Panel',
      description:
        `Link and verify your RSI account.\n\n` +
        `**Getting Started:**\n` +
        `1\ufe0f\u20e3 Click **Link RSI** to connect your RSI account\n` +
        `2\ufe0f\u20e3 Add the verification link to your [RSI bio](https://robertsspaceindustries.com/account/profile)\n` +
        `3\ufe0f\u20e3 Click **My Verification** to check your status\n\n${
          canManageRoles
            ? '**Admin shortcuts:** Sync Status, Setup Wizard, Run Sync, and Audit are available below.'
            : '*If you are an org admin, `/rsisync` provides role sync management controls.*'
        }`,
      buttons: panelButtons,
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },
};

/* ------------------------------------------------------------------ */
/*  Button-specific handlers (ButtonInteraction, orgId pre-resolved)  */
/* ------------------------------------------------------------------ */

async function handleUserButton(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content: GUILD_LINK_REQUIRED_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await axios.get<{ data: RsiLinkStatusInput }>(
      `${API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`,
      {
        headers: discordHeaders(interaction),
      }
    );

    const linkData = response.data.data;

    await interaction.editReply({ embeds: [buildRsiLinkStatusEmbed(linkData)] });
  } catch (error: unknown) {
    const axiosError = error as {
      response?: { status?: number; data?: { error?: string; message?: string } };
    };

    // 404 = no link found — show a friendly "not linked" message
    if (axiosError.response?.status === 404) {
      await interaction.editReply({ embeds: [buildRsiLinkStatusNotLinkedEmbed()] });
      return;
    }

    const errorMessage = formatBotApiError(
      error,
      'Unknown error',
      `user:org=${orgId}:user=${interaction.user.id}`
    );
    await interaction.editReply({ content: `❌ Failed to get user status: ${errorMessage}` });
  }
}

async function handleUnlinkButton(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content: GUILD_LINK_REQUIRED_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await axios.delete(
      `${API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/rsi-link`,
      {
        headers: discordHeaders(interaction),
      }
    );

    await interaction.editReply({ embeds: [buildRsiUnlinkedEmbed()] });
  } catch (error: unknown) {
    const errorMessage = formatBotApiError(
      error,
      'Unknown error',
      `unlink:org=${orgId}:user=${interaction.user.id}`
    );
    await interaction.editReply({ content: `❌ Failed to unlink RSI handle: ${errorMessage}` });
  }
}

async function handleCheckButton(
  interaction: ButtonInteraction,
  orgId: string | null
): Promise<void> {
  if (!orgId) {
    await interaction.reply({
      content: GUILD_LINK_REQUIRED_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await axios.post<{
      data: { verified: boolean; rsiHandle: string; error?: string };
    }>(
      `${API_BASE_URL}/bot/rsi/organizations/${orgId}/users/${interaction.user.id}/verify-check`,
      {},
      {
        headers: discordHeaders(interaction),
      }
    );

    const data = response.data.data;

    if (data.verified) {
      await interaction.editReply({
        embeds: [buildVerificationCompleteEmbed(data.rsiHandle)],
      });
    } else {
      // Re-show the Check Verification button so they can retry
      const retryButton = new ButtonBuilder()
        .setCustomId('verify_panel_check')
        .setLabel('Try Again')
        .setEmoji('\ud83d\udd04')
        .setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(retryButton);

      await interaction.editReply({
        embeds: [buildVerificationPendingEmbed(data.error)],
        components: [row],
      });
    }
  } catch (error: unknown) {
    const axiosError = error as {
      response?: { status?: number; data?: { error?: string; message?: string } };
    };

    if (axiosError.response?.status === 404) {
      await interaction.editReply({ embeds: [buildNoRsiLinkEmbed()] });
      return;
    }

    const errorMessage = formatBotApiError(
      error,
      'Unknown error',
      `verify-check:org=${orgId}:user=${interaction.user.id}`
    );
    await interaction.editReply({ content: `❌ Failed to check verification: ${errorMessage}` });
  }
}
