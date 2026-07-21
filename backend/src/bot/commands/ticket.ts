import { isAxiosError } from 'axios';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalSubmitInteraction,
  SlashCommandBuilder,
} from 'discord.js';

import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { DmEventType, DmNotificationService } from '../../services/discord/DmNotificationService';
import { TicketActivityLogService } from '../../services/discord/TicketActivityLogService';
import { TicketTranscriptService } from '../../services/discord/TicketTranscriptService';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import {
  buildPanelButtons,
  buildPanelEmbed,
  buildPanelModal,
  parsePanelButtonId,
  type PanelConfig,
  type PanelModalFieldDef,
} from '../embeds/panelEmbed';
import { botApiClient } from '../utils/botApiClient';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';
import { buildCustomId, parseCustomId } from '../utils/customId';
import { buildPaginationRow, paginate } from '../utils/paginationControls';

import { closeTicketChannel, openTicketChannel } from './ticketIssueChannel';
import { BotCommand } from './types';

// Ticket categories with emojis
const TICKET_CATEGORIES = [
  { value: 'hr', label: 'HR', emoji: '👥', description: 'Human Resources related inquiries' },
  {
    value: 'recruitment',
    label: 'Recruitment',
    emoji: '📋',
    description: 'Recruitment and applications',
  },
  {
    value: 'diplomacy',
    label: 'Diplomacy',
    emoji: '🤝',
    description: 'Inter-org relations and alliances',
  },
  { value: 'general', label: 'General', emoji: '💬', description: 'General support inquiries' },
  {
    value: 'support',
    label: 'Technical Support',
    emoji: '🔧',
    description: 'Technical issues and help',
  },
];

function buildTicketCancelCloseCustomId(ticketNumber: string): string {
  return buildCustomId('ticket', 'cancelclose', ticketNumber);
}

export function parseTicketCancelCloseTicketNumber(customId: string): string | null {
  const parsed = parseCustomId(customId);
  if (parsed.prefix !== 'ticket' || parsed.action !== 'cancelclose') {
    return null;
  }

  const [ticketNumber = ''] = parsed.params;
  return ticketNumber.length > 0 ? ticketNumber : null;
}

// Per-category modal form field definitions
const CATEGORY_MODAL_FIELDS: Record<string, PanelModalFieldDef[]> = {
  hr: [
    {
      customId: 'ticket_subject',
      label: 'Subject',
      placeholder: 'Brief summary (e.g., Leave request)',
      style: 'short',
      required: true,
      minLength: 3,
      maxLength: 200,
    },
    {
      customId: 'ticket_description',
      label: 'Details',
      placeholder: 'Provide full details about your HR request...',
      style: 'paragraph',
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
    {
      customId: 'ticket_member',
      label: 'Member(s) involved (optional)',
      placeholder: 'Discord usernames or IDs',
      style: 'short',
      required: false,
      maxLength: 200,
    },
  ],
  recruitment: [
    {
      customId: 'ticket_subject',
      label: 'Subject',
      placeholder: 'e.g., Application to join as Pilot',
      style: 'short',
      required: true,
      minLength: 3,
      maxLength: 200,
    },
    {
      customId: 'ticket_description',
      label: 'Tell us about yourself',
      placeholder: 'Experience, playstyle, availability...',
      style: 'paragraph',
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
    {
      customId: 'ticket_rsi_handle',
      label: 'RSI Handle (optional)',
      placeholder: 'Your Star Citizen handle',
      style: 'short',
      required: false,
      maxLength: 100,
    },
  ],
  diplomacy: [
    {
      customId: 'ticket_subject',
      label: 'Subject',
      placeholder: 'e.g., Alliance proposal from OrgXYZ',
      style: 'short',
      required: true,
      minLength: 3,
      maxLength: 200,
    },
    {
      customId: 'ticket_description',
      label: 'Details',
      placeholder: 'Describe the diplomatic request or incident...',
      style: 'paragraph',
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
    {
      customId: 'ticket_org_name',
      label: 'Organization name (optional)',
      placeholder: 'The other organization involved',
      style: 'short',
      required: false,
      maxLength: 200,
    },
  ],
  general: [
    {
      customId: 'ticket_subject',
      label: 'Subject',
      placeholder: 'Brief summary of your question',
      style: 'short',
      required: true,
      minLength: 3,
      maxLength: 200,
    },
    {
      customId: 'ticket_description',
      label: 'Description',
      placeholder: 'Provide detailed information...',
      style: 'paragraph',
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
  ],
  support: [
    {
      customId: 'ticket_subject',
      label: 'Subject',
      placeholder: 'Brief summary of the issue',
      style: 'short',
      required: true,
      minLength: 3,
      maxLength: 200,
    },
    {
      customId: 'ticket_description',
      label: 'Steps to reproduce',
      placeholder: 'What happened? What did you expect?',
      style: 'paragraph',
      required: true,
      minLength: 10,
      maxLength: 2000,
    },
    {
      customId: 'ticket_browser',
      label: 'Browser / Device (optional)',
      placeholder: 'e.g., Chrome 120 on Windows 11',
      style: 'short',
      required: false,
      maxLength: 100,
    },
  ],
};

// Button style per category
const CATEGORY_BUTTON_STYLE: Record<string, ButtonStyle> = {
  support: ButtonStyle.Danger,
  recruitment: ButtonStyle.Success,
  diplomacy: ButtonStyle.Secondary,
};

// Panel configuration (used by buildPanelEmbed / buildPanelButtons)
const TICKET_PANEL_CONFIG: PanelConfig = {
  title: '🎫 Support Ticket System',
  description:
    'Need help? Create a support ticket by clicking one of the buttons below.\n\n' +
    'Our team will respond to your ticket as soon as possible.',
  prefix: 'ticket',
  footer: 'Click a button below to create a ticket',
  buttons: TICKET_CATEGORIES.map(cat => ({
    action: cat.value,
    label: cat.label,
    style: CATEGORY_BUTTON_STYLE[cat.value] ?? ButtonStyle.Primary,
    emoji: cat.emoji,
    description: cat.description,
  })),
};

const TICKET_STATUS_COLOR: Record<string, number> = { open: 0x00ff88, closed: 0xff4444 };
function _ticketStatusColor(status: string): number {
  return TICKET_STATUS_COLOR[status] ?? 0xffaa00;
}

// Ticket priorities with emojis
const TICKET_PRIORITIES = [
  { value: 'low', label: 'Low', emoji: '🟢' },
  { value: 'medium', label: 'Medium', emoji: '🟡' },
  { value: 'high', label: 'High', emoji: '🟠' },
  { value: 'urgent', label: 'Urgent', emoji: '🔴' },
];

type ApiTicketPayload = {
  id?: string;
  ticketNumber?: string;
  subject?: string;
  category?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
};

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function extractTicketPayload(data: unknown): ApiTicketPayload | null {
  const direct = toRecord(data);
  if (!direct) {
    return null;
  }

  if (typeof direct.ticketNumber === 'string' || typeof direct.id === 'string') {
    return direct;
  }

  const nested = toRecord(direct.data);
  if (nested && (typeof nested.ticketNumber === 'string' || typeof nested.id === 'string')) {
    return nested;
  }

  return null;
}

function extractTicketList(data: unknown): ApiTicketPayload[] {
  const payload = toRecord(data);
  if (!payload) {
    return [];
  }

  const candidates = [payload.data, payload.tickets, payload.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(item => toRecord(item) as ApiTicketPayload | null)
        .filter((item): item is ApiTicketPayload => item !== null);
    }
  }

  return [];
}

function resolveTicketNumber(ticket: ApiTicketPayload | null): string {
  const rawNum = ticket?.ticketNumber ?? ticket?.id;
  if (typeof rawNum !== 'string') {
    return 'unknown';
  }

  const normalized = rawNum.trim();
  return normalized.length > 0 ? normalized : 'unknown';
}

function getPriorityEmoji(priority: string | undefined): string {
  return TICKET_PRIORITIES.find(item => item.value === priority)?.emoji || '\u26aa';
}

function getCategoryEmoji(category: string | undefined): string {
  return TICKET_CATEGORIES.find(item => item.value === category)?.emoji || '\ud83d\udcac';
}

function normalizeTicketListDisplay(ticket: ApiTicketPayload): {
  ticketNumber: string;
  subject: string;
  status: string;
  createdAtRelative: string;
} {
  const ticketNumber =
    typeof ticket.ticketNumber === 'string' && ticket.ticketNumber.trim().length > 0
      ? ticket.ticketNumber
      : 'UNKNOWN';
  const subject =
    typeof ticket.subject === 'string' && ticket.subject.trim().length > 0
      ? ticket.subject
      : 'No subject';
  const status =
    typeof ticket.status === 'string' && ticket.status.trim().length > 0 ? ticket.status : 'open';
  const createdAtTimestamp =
    typeof ticket.createdAt === 'string' ? Date.parse(ticket.createdAt) : Number.NaN;

  let createdAtRelative = 'Unknown';
  if (Number.isFinite(createdAtTimestamp) && createdAtTimestamp > 0) {
    createdAtRelative = `<t:${Math.floor(createdAtTimestamp / 1000)}:R>`;
  }

  return {
    ticketNumber,
    subject,
    status,
    createdAtRelative,
  };
}

function resolveKnownCategory(
  requestedCategory: string,
  parsedTicket: ApiTicketPayload | null,
  fallbackTicket: ApiTicketPayload | null
): string {
  if (
    parsedTicket?.category &&
    TICKET_CATEGORIES.some(item => item.value === parsedTicket.category)
  ) {
    return parsedTicket.category;
  }

  if (
    fallbackTicket?.category &&
    TICKET_CATEGORIES.some(item => item.value === fallbackTicket.category)
  ) {
    return fallbackTicket.category;
  }

  return requestedCategory;
}

async function findLatestTicketForDiscordUser(
  discordUserId: string,
  guildId: string | null,
  subject: string
): Promise<ApiTicketPayload | null> {
  try {
    const response = await botApiClient.get('/v2/tickets', {
      params: {
        creatorDiscordId: discordUserId,
        status: 'open',
        limit: 10,
      },
      headers: {
        'X-Discord-User-Id': discordUserId,
        'X-Discord-Guild-Id': guildId,
      },
    });

    const tickets = extractTicketList(response.data);
    if (tickets.length === 0) {
      return null;
    }

    const exactMatch = tickets.find(ticket => ticket.subject === subject);
    return exactMatch ?? tickets[0] ?? null;
  } catch (error) {
    logger.warn('Fallback ticket lookup failed after create response parsing', {
      error: getErrorMessage(error),
    });
    return null;
  }
}

export const ticket: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create and manage support tickets'),

  cooldown: 5,
  category: 'moderation',

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'ticket',
      title: 'Support Tickets',
      description: 'Create and manage support tickets.',
      buttons: [
        {
          subcommand: 'create',
          label: 'Create Ticket',
          emoji: '\ud83c\udfab',
          style: ButtonStyle.Success,
        },
        {
          subcommand: 'list',
          label: 'My Tickets',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        { subcommand: 'panel', label: 'Post Ticket Panel', emoji: '\ud83d\udccc' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },

  async handleButton(interaction: ButtonInteraction) {
    // ── Command panel buttons: ticket_panel_{subcommand} ──
    const sub = parsePanelCustomId(interaction.customId, 'ticket');
    if (sub) {
      switch (sub) {
        case 'create': {
          // Show category selection — reuse the persistent panel's category buttons
          const categoryEmbed = new EmbedBuilder()
            .setColor(0x00d9ff)
            .setTitle('\ud83c\udfab Select Ticket Category')
            .setDescription('Choose a category for your support ticket:');
          const categoryButtons = buildPanelButtons(TICKET_PANEL_CONFIG);
          await interaction.reply({
            embeds: [categoryEmbed],
            components: [categoryButtons],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        case 'list':
          await _handleListTicketsButton(interaction);
          return;
        case 'panel':
          await _handleCreatePanelButton(interaction);
          return;
        default:
          // Not a command panel button — fall through to persistent panel / other routing
          break;
      }
    }

    // ── Persistent panel buttons: ticket_panel_{category} (from panelEmbed) ──
    const parsed = parsePanelButtonId(interaction.customId);
    if (parsed?.prefix === 'ticket') {
      const category = parsed.action;
      const categoryInfo = TICKET_CATEGORIES.find(c => c.value === category);
      if (!categoryInfo) {
        await interaction.reply({
          content: '❌ Unknown ticket category.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Recruitment category: redirect to the org's application form instead of a ticket modal
      if (category === 'recruitment') {
        await _handleRecruitmentRedirect(interaction);
        return;
      }

      const fields = CATEGORY_MODAL_FIELDS[category] ?? CATEGORY_MODAL_FIELDS['general'];
      const modal = buildPanelModal(
        `ticket_create_${category}`,
        `${categoryInfo.emoji} Create ${categoryInfo.label} Ticket`,
        fields
      );
      await interaction.showModal(modal);
      return;
    }

    // Handle ticket action buttons: ticket_reply_{number}, ticket_close_{number}
    const replyMatch = /^ticket_reply_(.+)$/.exec(interaction.customId);
    if (replyMatch) {
      const ticketNumber = replyMatch[1];
      const fields: PanelModalFieldDef[] = [
        {
          customId: 'reply_content',
          label: 'Your reply',
          placeholder: 'Type your message...',
          style: 'paragraph',
          required: true,
          minLength: 1,
          maxLength: 2000,
        },
      ];
      const modal = buildPanelModal(
        `ticket_reply_modal_${ticketNumber}`,
        `Reply to ${ticketNumber}`,
        fields
      );
      await interaction.showModal(modal);
      return;
    }

    // Paginated open-ticket list navigation: ticket_listpage_{page}
    const listPageMatch = /^ticket_listpage_(\d+)$/.exec(interaction.customId);
    if (listPageMatch) {
      await _handleTicketListPageButton(interaction, Number.parseInt(listPageMatch[1], 10));
      return;
    }

    // Handle resolve button: ticket_resolve_{number}
    const resolveMatch = /^ticket_resolve_(.+)$/.exec(interaction.customId);
    if (resolveMatch) {
      const ticketNumber = resolveMatch[1];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const ticketResponse = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
          headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
          },
        });
        await botApiClient.put(
          `/v2/tickets/${ticketResponse.data.id}/resolve`,
          {
            resolution: `Resolved via Discord button by ${interaction.user.username}`,
          },
          {
            headers: {
              'X-Discord-User-Id': interaction.user.id,
              'X-Discord-Guild-Id': interaction.guildId,
            },
          }
        );

        const activityLog = TicketActivityLogService.getInstance();
        await activityLog.logActivity(
          interaction.guildId ?? '',
          ticketNumber,
          'closed',
          interaction.user.username
        );

        // DM the ticket creator (fire-and-forget).
        if (interaction.guildId) {
          void _sendCloseDm(interaction.guildId, ticketResponse.data as ApiTicketCloseData);
        }

        // Tear down private ticket channel if one was opened.
        if (interaction.guild) {
          void closeTicketChannel(
            interaction.guild,
            ticketResponse.data.id as string,
            ticketNumber
          );
        }

        await interaction.editReply({
          content: `✅ Ticket **${ticketNumber}** has been resolved.`,
        });
      } catch (error) {
        logger.error('Failed to resolve ticket via button:', error);
        await interaction.editReply({
          content: `❌ Failed to resolve ticket: ${getErrorMessage(error)}`,
        });
      }
      return;
    }

    const closeMatch = /^ticket_close_(.+)$/.exec(interaction.customId);
    if (closeMatch) {
      const ticketNumber = closeMatch[1];

      // Check if two-step close is enabled
      const settingsService = discordSettingsService;
      const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
      const twoStepEnabled = settings?.[0]?.ticketSettings?.twoStepCloseEnabled ?? false;

      if (twoStepEnabled) {
        // Show a uniform confirmation prompt (C2 shared primitive) instead of
        // closing directly. The confirm button re-enters this handler as
        // `ticket_confirmclose_<num>`; the cancel button as `ticket_cancelclose_<num>`.
        await interaction.reply(
          buildConfirmationPrompt({
            confirmCustomId: `ticket_confirmclose_${ticketNumber}`,
            cancelCustomId: buildTicketCancelCloseCustomId(ticketNumber),
            message: `close ticket **${ticketNumber}**`,
            confirmLabel: 'Confirm Close',
          })
        );
        return;
      }

      // Direct close (legacy behavior)
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const ticketResponse = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
          headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
          },
        });
        await botApiClient.put(
          `/v2/tickets/${ticketResponse.data.id}/close`,
          {},
          {
            headers: {
              'X-Discord-User-Id': interaction.user.id,
              'X-Discord-Guild-Id': interaction.guildId,
            },
          }
        );

        // Log activity
        const activityLog = TicketActivityLogService.getInstance();
        await activityLog.logActivity(
          interaction.guildId ?? '',
          ticketNumber,
          'closed',
          interaction.user.username
        );

        // Post transcript to the configured transcript channel (fire-and-forget).
        if (interaction.guildId) {
          void _postCloseTranscript(interaction.guildId, ticketResponse.data as ApiTicketCloseData);
        }

        // DM the ticket creator (fire-and-forget).
        if (interaction.guildId) {
          void _sendCloseDm(interaction.guildId, ticketResponse.data as ApiTicketCloseData);
        }

        // Tear down private ticket channel if one was opened.
        if (interaction.guild) {
          void closeTicketChannel(
            interaction.guild,
            ticketResponse.data.id as string,
            ticketNumber
          );
        }

        await interaction.editReply({ content: `✅ Ticket **${ticketNumber}** has been closed.` });
      } catch (error) {
        logger.error('Failed to close ticket via button:', error);
        await interaction.editReply({
          content: `❌ Failed to close ticket: ${getErrorMessage(error)}`,
        });
      }
      return;
    }

    // Handle confirm close button (two-step)
    const confirmCloseMatch = /^ticket_confirmclose_(.+)$/.exec(interaction.customId);
    if (confirmCloseMatch) {
      const ticketNumber = confirmCloseMatch[1];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const ticketResponse = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
          headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
          },
        });
        await botApiClient.put(
          `/v2/tickets/${ticketResponse.data.id}/close`,
          {},
          {
            headers: {
              'X-Discord-User-Id': interaction.user.id,
              'X-Discord-Guild-Id': interaction.guildId,
            },
          }
        );

        const activityLog = TicketActivityLogService.getInstance();
        await activityLog.logActivity(
          interaction.guildId ?? '',
          ticketNumber,
          'closed',
          interaction.user.username
        );

        // Post transcript to the configured transcript channel (fire-and-forget).
        if (interaction.guildId) {
          void _postCloseTranscript(interaction.guildId, ticketResponse.data as ApiTicketCloseData);
        }

        // DM the ticket creator (fire-and-forget).
        if (interaction.guildId) {
          void _sendCloseDm(interaction.guildId, ticketResponse.data as ApiTicketCloseData);
        }

        // Tear down private ticket channel if one was opened.
        if (interaction.guild) {
          void closeTicketChannel(
            interaction.guild,
            ticketResponse.data.id as string,
            ticketNumber
          );
        }

        await interaction.editReply({ content: `✅ Ticket **${ticketNumber}** has been closed.` });
      } catch (error) {
        logger.error('Failed to close ticket via confirm:', error);
        await interaction.editReply({
          content: `❌ Failed to close ticket: ${getErrorMessage(error)}`,
        });
      }
      return;
    }

    // Handle cancel close button (two-step)
    if (parseTicketCancelCloseTicketNumber(interaction.customId)) {
      await respondConfirmationCancelled(interaction);
      return;
    }

    // Handle claim button
    const claimMatch = /^ticket_claim_(.+)$/.exec(interaction.customId);
    if (claimMatch) {
      const ticketNumber = claimMatch[1];
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const ticketResponse = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
          headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
          },
        });
        await botApiClient.put(
          `/v2/tickets/${ticketResponse.data.id}/assign`,
          { assigneeId: interaction.user.id, assigneeName: interaction.user.username },
          {
            headers: {
              'X-Discord-User-Id': interaction.user.id,
              'X-Discord-Guild-Id': interaction.guildId,
            },
          }
        );

        const activityLog = TicketActivityLogService.getInstance();
        await activityLog.logActivity(
          interaction.guildId ?? '',
          ticketNumber,
          'claimed',
          interaction.user.username
        );

        await interaction.editReply({
          content: `✋ You have claimed ticket **${ticketNumber}**.`,
        });
      } catch (error) {
        logger.error('Failed to claim ticket via button:', error);
        await interaction.editReply({
          content: `❌ Failed to claim ticket: ${getErrorMessage(error)}`,
        });
      }
    }
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    // Handle ticket creation modals: ticket_create_{category}
    const createMatch = /^ticket_create_([a-z]+)$/.exec(interaction.customId);
    if (createMatch) {
      await handleTicketCreateModal(interaction, createMatch[1]);
      return;
    }

    // Handle reply modals: ticket_reply_modal_{number}
    const replyMatch = /^ticket_reply_modal_(.+)$/.exec(interaction.customId);
    if (replyMatch) {
      await handleTicketReplyModal(interaction, replyMatch[1]);
    }
  },
};

/* ── Panel button handlers (ephemeral command panel) ─────────────────── */

/* ── Recruitment redirect: use the org's application form ────────────── */

async function _handleRecruitmentRedirect(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await botApiClient.get(`/v2/recruitment`, {
      params: { status: 'open' },
      headers: { 'X-Discord-Guild-Id': interaction.guildId },
    });

    const recruitments = response.data.data || [];

    if (recruitments.length === 0) {
      await interaction.editReply({
        content: '📭 No open recruitment positions at this time. Please check back later!',
      });
      return;
    }

    const embed = _buildRecruitmentListEmbed(recruitments);
    const rows = _buildRecruitmentApplyButtons(recruitments);

    await interaction.editReply({ embeds: [embed], components: rows });
  } catch (error) {
    logger.error('Failed to fetch recruitments from ticket panel:', error);
    await interaction.editReply({
      content: `❌ Failed to load recruitment positions: ${getErrorMessage(error)}`,
    });
  }
}

function _recruitmentStatusEmoji(status: string): string {
  if (status === 'open') {
    return '🟢';
  }
  if (status === 'paused') {
    return '🟡';
  }
  return '🔴';
}

function _buildRecruitmentListEmbed(recruitments: Array<Record<string, unknown>>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle('📋 Open Recruitment Positions')
    .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
    .setTimestamp();

  for (const r of recruitments.slice(0, 10)) {
    const emoji = _recruitmentStatusEmoji(r.status as string);
    const rolesText =
      (r.rolesNeeded as string[] | undefined)?.slice(0, 3).join(', ') || 'Various roles';
    const desc = (r.description as string) ?? '';
    const truncDesc = desc.length > 100 ? `${desc.substring(0, 100)}...` : desc;
    const applicantCount = (r.currentApplicants as number) || 0;
    const maxPos = r.maxPositions as number | undefined;
    const applicants = maxPos ? `${applicantCount}/${maxPos}` : String(applicantCount);

    embed.addFields({
      name: `${emoji} ${r.title as string}`,
      value: [`📝 ${truncDesc}`, `🎯 Roles: ${rolesText}`, `👥 Applicants: ${applicants}`].join(
        '\n'
      ),
      inline: false,
    });
  }

  return embed;
}

function _buildRecruitmentApplyButtons(
  recruitments: Array<Record<string, unknown>>
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < Math.min(recruitments.length, 5); i++) {
    if (i % 5 === 0 && rows.length < 5) {
      rows.push(new ActionRowBuilder<ButtonBuilder>());
    }
    const title = (recruitments[i].title as string).substring(0, 20);
    rows[Math.floor(i / 5)].addComponents(
      new ButtonBuilder()
        .setCustomId(`recruitment_apply_${recruitments[i].id as string}`)
        .setLabel(`Apply: ${title}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝')
    );
  }
  return rows;
}

/** Open-ticket list page size (Discord embed field density). */
const TICKET_LIST_PAGE_SIZE = 10;

async function _handleListTicketsButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const tickets = await _fetchOpenTickets(interaction);

    if (tickets.length === 0) {
      await interaction.editReply({
        content: '\ud83d\udced You have no open tickets.',
      });
      return;
    }

    await interaction.editReply(_buildTicketListView(tickets, 0));
  } catch (error: unknown) {
    await interaction.editReply({
      content: `\u274c Failed to fetch tickets: ${getErrorMessage(error)}`,
    });
  }
}

/** Page through an already-rendered open-ticket list via the shared pagination row. */
async function _handleTicketListPageButton(
  interaction: ButtonInteraction,
  page: number
): Promise<void> {
  try {
    const tickets = await _fetchOpenTickets(interaction);

    if (tickets.length === 0) {
      // The list emptied out since it was opened — collapse the controls.
      await interaction.update({
        content: '\ud83d\udced You have no open tickets.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Edit the existing ephemeral list message in place (no new reply).
    await interaction.update(_buildTicketListView(tickets, page));
  } catch (error: unknown) {
    await interaction.reply({
      content: `\u274c Failed to load that page: ${getErrorMessage(error)}`,
      flags: MessageFlags.Ephemeral,
    });
  }
}

/** Fetch the requesting user's open tickets (full set; paged client-side). */
async function _fetchOpenTickets(interaction: ButtonInteraction): Promise<ApiTicketPayload[]> {
  const response = await botApiClient.get(`/v2/tickets`, {
    params: {
      creatorDiscordId: interaction.user.id,
      status: 'open',
    },
    headers: {
      'X-Discord-User-Id': interaction.user.id,
      'X-Discord-Guild-Id': interaction.guildId,
    },
  });
  return extractTicketList(response.data);
}

/**
 * Build the embed + pagination controls for one page of the open-ticket list.
 * Pure — the caller decides whether to `editReply` (initial) or `update` (paging).
 */
function _buildTicketListView(
  tickets: ApiTicketPayload[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(tickets, page, TICKET_LIST_PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setColor(0x00d9ff)
    .setTitle('\ud83c\udfab Your Open Tickets')
    .setDescription(`You have ${total} open ticket(s)`)
    .setTimestamp();

  for (const ticket of pageItems) {
    const priorityEmoji = getPriorityEmoji(ticket.priority);
    const categoryEmoji = getCategoryEmoji(ticket.category);
    const normalizedTicket = normalizeTicketListDisplay(ticket);

    embed.addFields({
      name: `${priorityEmoji} ${normalizedTicket.ticketNumber}`,
      value: `${categoryEmoji} **${normalizedTicket.subject}**\nStatus: \`${normalizedTicket.status}\` | Created: ${normalizedTicket.createdAtRelative}`,
      inline: false,
    });
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} tickets` });
  }

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage => `ticket_listpage_${targetPage}`,
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

async function _handleCreatePanelButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: '\u274c You need Administrator permissions to create a ticket panel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = buildPanelEmbed(TICKET_PANEL_CONFIG);
  const row = buildPanelButtons(TICKET_PANEL_CONFIG);

  await interaction.reply({ content: 'Ticket panel created!', flags: MessageFlags.Ephemeral });
  if (interaction.channel && 'send' in interaction.channel) {
    await interaction.channel.send({ embeds: [embed], components: [row] });
  }
}

/* ── Extracted modal handlers (reduce cognitive complexity) ──────────── */

const OPTIONAL_MODAL_FIELDS = [
  'ticket_member',
  'ticket_rsi_handle',
  'ticket_org_name',
  'ticket_browser',
];

async function handleTicketCreateModal(
  interaction: ModalSubmitInteraction,
  category: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Check ticket access control (blocked/required roles)
  const guildId = interaction.guildId ?? '';
  if (guildId && interaction.member && 'roles' in interaction.member) {
    try {
      const settingsService = discordSettingsService;
      const allSettings = await settingsService.getSettingsByGuildId(guildId);
      const ticketConfig = allSettings?.[0]?.ticketSettings;

      if (ticketConfig) {
        const memberRoles = new Set(
          Array.isArray(interaction.member.roles)
            ? interaction.member.roles
            : [...(interaction.member.roles as { cache: Map<string, unknown> }).cache.keys()]
        );

        // Check blocked roles
        if (ticketConfig.blockedRoleIds?.length) {
          const hasBlocked = ticketConfig.blockedRoleIds.some(r => memberRoles.has(r));
          if (hasBlocked) {
            await interaction.editReply({ content: '❌ You are not allowed to create tickets.' });
            return;
          }
        }

        // Check required roles
        if (ticketConfig.requiredRoleIds?.length) {
          const matchMode = ticketConfig.roleMatchMode ?? 'any';
          const hasRequired =
            matchMode === 'all'
              ? ticketConfig.requiredRoleIds.every(r => memberRoles.has(r))
              : ticketConfig.requiredRoleIds.some(r => memberRoles.has(r));
          if (!hasRequired) {
            await interaction.editReply({
              content: '❌ You do not have the required role to create tickets.',
            });
            return;
          }
        }
      }
    } catch {
      // Non-fatal — continue without role check
    }
  }

  const subject = interaction.fields.getTextInputValue('ticket_subject');
  const description = interaction.fields.getTextInputValue('ticket_description');

  // Collect optional fields per category
  const metadata: Record<string, string> = {};
  for (const fieldId of OPTIONAL_MODAL_FIELDS) {
    try {
      const value = interaction.fields.getTextInputValue(fieldId);
      if (value) {
        metadata[fieldId.replace('ticket_', '')] = value;
      }
    } catch {
      // Field not present in this modal — ignore
    }
  }

  // Map ticket category to the appropriate recipient type
  const categoryToRecipientType: Record<string, string> = {
    hr: 'hr_department',
    recruitment: 'recruitment',
    diplomacy: 'diplomacy',
    general: 'org_leadership',
    support: 'platform_admin',
  };

  try {
    const response = await botApiClient.post(
      `/v2/tickets`,
      {
        subject,
        description,
        category,
        priority: 'medium',
        recipientType: categoryToRecipientType[category] ?? 'org_leadership',
        creatorDiscordId: interaction.user.id,
        discordId: interaction.user.id,
      },
      {
        headers: {
          'X-Discord-User-Id': interaction.user.id,
          'X-Discord-Guild-Id': interaction.guildId,
        },
      }
    );

    const parsedTicket = extractTicketPayload(response.data);
    let fallbackTicket: ApiTicketPayload | null = null;
    let ticketNum = resolveTicketNumber(parsedTicket);
    if (ticketNum === 'unknown') {
      fallbackTicket = await findLatestTicketForDiscordUser(
        interaction.user.id,
        interaction.guildId,
        subject
      );
      ticketNum = resolveTicketNumber(fallbackTicket);
    }

    const resolvedCategory = resolveKnownCategory(category, parsedTicket, fallbackTicket);
    const categoryInfo = TICKET_CATEGORIES.find(c => c.value === resolvedCategory);

    // Log ticket creation activity
    const activityLog = TicketActivityLogService.getInstance();
    await activityLog.logActivity(
      interaction.guildId ?? '',
      ticketNum,
      'created',
      interaction.user.username,
      `Category: ${categoryInfo?.label ?? category}`
    );

    // Open a private ticket channel for direct communication (fire-and-forget).
    const ticketId = parsedTicket?.id ?? fallbackTicket?.id;
    if (interaction.guild && ticketId && ticketNum !== 'unknown') {
      void openTicketChannel(
        interaction.guild,
        ticketId,
        ticketNum,
        interaction.user.id,
        resolvedCategory,
        {
          subject,
          description,
          category: resolvedCategory,
        }
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle(`${categoryInfo?.emoji ?? '🎫'} Ticket Created: ${ticketNum}`)
      .setDescription(`Your ${categoryInfo?.label ?? category} ticket has been created!`)
      .addFields(
        { name: 'Subject', value: subject, inline: false },
        {
          name: 'Category',
          value: `${categoryInfo?.emoji ?? ''} ${categoryInfo?.label ?? category}`,
          inline: true,
        },
        { name: 'Priority', value: '🟡 Medium', inline: true },
        { name: 'Status', value: '`Open`', inline: true }
      )
      .setFooter({ text: `Use /ticket view ${ticketNum} to check status` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Failed to create ticket via panel:', error);
    let content = `❌ Failed to create ticket: ${getErrorMessage(error)}`;
    if (isAxiosError(error)) {
      const status = error.response?.status;
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        content =
          '❌ The API did not respond in time. The server may be starting up — please try again in a moment.';
      } else if (status === 403) {
        const apiError = (error.response?.data as Record<string, string> | undefined)?.error;
        if (apiError?.includes('Direct access')) {
          content =
            '❌ The bot could not reach the API (blocked by Front Door).\n\n' +
            '• Ensure `BOT_API_INTERNAL_URL` is set to the internal API address.\n' +
            '• Ensure `BOT_INTERNAL_SECRET` matches between bot and API.';
        } else {
          content =
            '❌ This Discord server is not linked to a Fringe Core organization.\n\n' +
            '• Ask an admin to run `/org` and use **Help → Server Setup** to verify the link.\n' +
            '• If you just linked it, wait ~30 seconds and try again.\n' +
            '• An admin can link it via the `/org` server setup panel or in **Organization Settings → Discord Server**.';
        }
      } else if (status === 401) {
        const apiDetail =
          (error.response?.data as Record<string, string> | undefined)?.error ??
          (error.response?.data as Record<string, string> | undefined)?.message;
        content =
          '❌ The bot could not authenticate to the API.\n\n' +
          '• Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both the API and bot environments.\n' +
          '• Restart the bot after changing environment variables.';
        if (apiDetail) {
          content += `\n\n🔍 API detail: ${apiDetail}`;
        }
      }
    }
    await interaction.editReply({ content });
  }
}

/**
 * Minimal shape of the ticket API response needed for transcript generation.
 * All fields are optional to guard against partial API responses.
 */
interface ApiTicketCloseData {
  ticketNumber?: string;
  subject?: string;
  category?: string;
  creatorName?: string;
  createdAt?: string;
  creatorDiscordId?: string;
  resolution?: string;
  messages?: Array<{
    id?: string;
    authorId?: string;
    authorName?: string;
    content?: string;
    createdAt?: string;
    isInternal?: boolean;
    attachments?: string[];
  }>;
}

/**
 * Post a transcript of a closed ticket to the guild's configured transcript channel.
 * Fire-and-forget — never throws; always warn-and-return on failure.
 */
async function _postCloseTranscript(
  guildId: string,
  ticketData: ApiTicketCloseData
): Promise<void> {
  try {
    // Need at minimum ticketNumber + subject + category + creatorName to produce a useful transcript.
    const { ticketNumber, subject, category, creatorName, createdAt, messages } = ticketData;
    if (!ticketNumber || !subject || !category || !creatorName) {
      return;
    }

    // Look up the guild's transcript channel.
    const allSettings = await discordSettingsService.getSettingsByGuildId(guildId);
    const transcriptChannelId = allSettings?.find(s => s.ticketSettings?.transcriptChannelId)
      ?.ticketSettings?.transcriptChannelId;
    if (!transcriptChannelId) {
      return;
    }

    // Build the transcript using the existing service.
    const transcriptService = TicketTranscriptService.getInstance();
    const parsedCreatedAt = createdAt ? new Date(createdAt) : new Date();
    const safeMessages = (messages ?? []).map(m => ({
      id: m.id ?? '',
      authorId: m.authorId ?? '',
      authorName: m.authorName ?? 'Unknown',
      content: m.content ?? '',
      createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
      isInternal: m.isInternal ?? false,
      attachments: m.attachments ?? [],
    }));

    const transcript = transcriptService.generateTranscript(
      ticketNumber,
      subject,
      category,
      creatorName,
      parsedCreatedAt,
      safeMessages
    );

    await transcriptService.postToChannel(transcriptChannelId, transcript);
  } catch (error: unknown) {
    logger.warn('ticket: failed to post close transcript', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/**
 * DM the ticket creator to notify them the ticket was closed.
 * Fire-and-forget — never throws; honours per-user DM opt-in via DmNotificationService.
 */
async function _sendCloseDm(guildId: string, ticketData: ApiTicketCloseData): Promise<void> {
  try {
    const { creatorDiscordId, ticketNumber, resolution } = ticketData;
    if (!creatorDiscordId || !ticketNumber) {
      return;
    }

    const dmService = DmNotificationService.getInstance();
    const embed = dmService.buildTicketClosedEmbed(ticketNumber, resolution);
    void dmService.sendNotifications({
      eventType: DmEventType.TICKET_CLOSED,
      recipientDiscordIds: [creatorDiscordId],
      embed,
      guildId,
    });
  } catch (error: unknown) {
    logger.warn('ticket: failed to send close DM', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function handleTicketReplyModal(
  interaction: ModalSubmitInteraction,
  ticketNumber: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const message = interaction.fields.getTextInputValue('reply_content');

  try {
    const ticketResponse = await botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
      headers: {
        'X-Discord-User-Id': interaction.user.id,
        'X-Discord-Guild-Id': interaction.guildId,
      },
    });
    await botApiClient.post(
      `/v2/tickets/${ticketResponse.data.id}/messages`,
      {
        content: message,
        authorName: interaction.user.username,
        authorId: interaction.user.id,
      },
      {
        headers: {
          'X-Discord-User-Id': interaction.user.id,
          'X-Discord-Guild-Id': interaction.guildId,
        },
      }
    );

    const activityLog = TicketActivityLogService.getInstance();
    await activityLog.logActivity(
      interaction.guildId ?? '',
      ticketNumber,
      'replied',
      interaction.user.username
    );

    await interaction.editReply({ content: `✅ Reply added to ticket **${ticketNumber}**.` });
  } catch (error) {
    logger.error('Failed to reply to ticket via modal:', error);
    await interaction.editReply({ content: `❌ Failed to reply: ${getErrorMessage(error)}` });
  }
}
