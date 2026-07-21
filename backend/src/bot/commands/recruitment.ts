import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  type ColorResolvable,
} from 'discord.js';

import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import {
  getDiscordWebLoginUrl,
  parseDiscordAccountLinkPrompt,
  type DiscordAccountLinkPrompt,
} from '../../utils/discordAccountLink';
import { getErrorMessage, isAxiosError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { API_BASE_URL } from '../constants/api';
import {
  buildPanelButtons,
  buildPanelEmbed,
  buildPanelModal,
  parsePanelButtonId,
  type PanelConfig,
  type PanelModalFieldDef,
} from '../embeds/panelEmbed';
import {
  buildApplicationConfirmationEmbed,
  buildClosedRecruitmentPanelEmbed,
  buildDecisionNoticeEmbed,
  buildDiscordAccountLinkPromptEmbed,
  buildMultiQuickApplyEmbed,
  buildMyApplicationsView,
  buildRecruitmentDetailsEmbed,
  buildRecruitmentPanelEmbed,
  buildSingleQuickApplyEmbed,
  buildStaffReviewEmbed,
  buildViewPositionsEmbed,
  RECRUITMENT_MY_APPS_PAGE_PREFIX,
  type MyApplicationView,
  type RecruitmentDetailsInput,
  type RecruitmentSummary,
  type StaffReviewThreadInput,
} from '../embeds/recruitmentEmbeds';
import { botApiClient as axios } from '../utils/botApiClient';
import { formatBotApiError } from '../utils/botErrorFormat';
import {
  parsePanelCustomId,
  replyWithCommandPanel,
  type CommandPanelConfig,
} from '../utils/commandPanelBuilder';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';
import { EmbedColors } from '../utils/embedBuilder';
import {
  buildDynamicRecruitmentApplyPayload,
  buildLegacyRecruitmentApplyPayload,
  type RecruitmentApplyPayload,
} from '../utils/recruitmentApplyPayload';
export type { RecruitmentSummary };

import { closeApplicantChannel, openApplicantChannel } from './recruitmentApplicantChannel';

// Use module-level singleton for settings
function getSettingsService() {
  return discordSettingsService;
}

import { BotCommand } from './types';

// Track pre-modal select menu answers per user (userId → { recruitmentId, answers })
const pendingSelectAnswers = new Map<
  string,
  { recruitmentId: string; answers: Record<string, string>; timestamp: number }
>();

// Cleanup stale pending answers every 10 minutes.
// Unref so this housekeeping timer never keeps Node/Jest alive on its own.
const stalePendingAnswersCleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of pendingSelectAnswers) {
      if (now - val.timestamp > 10 * 60 * 1000) {
        pendingSelectAnswers.delete(key);
      }
    }
    for (const [key, val] of pendingDynamicApplications) {
      if (now - val.timestamp > 10 * 60 * 1000) {
        pendingDynamicApplications.delete(key);
      }
    }
  },
  10 * 60 * 1000
);
stalePendingAnswersCleanupTimer.unref();

// ─── Dynamic application state (paginated modals) ──────────────────────
// Discord modals support a maximum of 5 components. When an organization
// configures more than 5 application questions, we paginate across multiple
// modals chained by a "Continue Application" button.
const DISCORD_MODAL_MAX_FIELDS = 5;

interface PendingDynamicApplication {
  recruitmentId: string;
  /** All questions (both select and text) — used for final answer assembly */
  questions: ApplicationQuestion[];
  /** Questions shown in the modal (text-only, after selects are pre-answered) */
  modalQuestions: ApplicationQuestion[];
  // Map of questionId → submitted answer value
  answers: Record<string, string>;
  timestamp: number;
}

const pendingDynamicApplications = new Map<string, PendingDynamicApplication>();

async function submitRecruitmentApplicationAndNotify(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  recruitmentId: string,
  payload: RecruitmentApplyPayload,
  staffReviewInput: StaffReviewThreadInput
): Promise<void> {
  const appResponse = await axios.post(
    `${API_BASE_URL}/v2/recruitment/${recruitmentId}/apply`,
    payload,
    {
      headers: {
        'X-Discord-User-Id': interaction.user.id,
        'X-Discord-Guild-Id': interaction.guildId,
      },
    }
  );

  const application = appResponse.data as Record<string, unknown>;

  // Enrich the staff-review embed with submission timestamp + initial stage from the API response.
  const enrichedReviewInput: StaffReviewThreadInput = {
    ...staffReviewInput,
    appliedAt:
      typeof application.appliedAt === 'string' ? application.appliedAt : new Date().toISOString(),
    applicationStatus: typeof application.status === 'string' ? application.status : 'pending',
  };

  await interaction.editReply({ embeds: [buildApplicationConfirmationEmbed(payload)] });
  await createStaffReviewThread(interaction, recruitmentId, application, enrichedReviewInput);

  // Open an ephemeral private channel (applicant + staff role) when configured.
  // Self-contained + non-fatal: must never surface a false apply failure.
  await openApplicantChannel(interaction, recruitmentId, application);
}

/**
 * Surface a recruitment-application submission failure to the user.
 *
 * Centralises the apply catch sites: honours the Discord account-link prompt,
 * logs hygienically via formatBotApiError (structured fields only — never the
 * raw axios error, which would dump the request body and TLS socket bytes), and
 * shows a graceful "no longer available" message when the posting 404s
 * (closed/removed) instead of a raw "Route not found".
 */
async function replyRecruitmentApplyError(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  error: unknown
): Promise<void> {
  const accountLinkPrompt = getDiscordAccountLinkPrompt(error);
  if (accountLinkPrompt) {
    await replyWithDiscordAccountLinkPrompt(interaction, accountLinkPrompt);
    return;
  }

  // Logs structured details only (status/url/method/data) — no raw axios/TLS dump.
  const apiMsg = formatBotApiError(error, 'Failed to submit application', 'recruitment-apply');

  const content =
    isAxiosError(error) && error.response?.status === 404
      ? '❌ This recruitment posting is no longer available — it may have been closed or removed. Refresh the recruitment panel and try again.'
      : `❌ Failed to submit application: ${apiMsg}`;

  await interaction.editReply({ content });
}

function getDiscordAccountLinkPrompt(error: unknown): DiscordAccountLinkPrompt | null {
  return parseDiscordAccountLinkPrompt(error, {
    allowedStatusCodes: [401, 403, 404, 409],
    fallbackMessage:
      'Sign in with Discord SSO on the web app before applying through the recruitment panel.',
    fallbackLoginUrl: getDiscordWebLoginUrl(),
  });
}

async function replyWithDiscordAccountLinkPrompt(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  prompt: DiscordAccountLinkPrompt
): Promise<void> {
  const embed = buildDiscordAccountLinkPromptEmbed(prompt.message);

  const loginButton = new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setURL(prompt.loginUrl)
    .setLabel('Sign In with Discord')
    .setEmoji('🔐');

  await interaction.editReply({
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(loginButton)],
  });
}

/**
 * Convert an ApplicationQuestion into a Discord modal text input definition.
 * Discord modals only support text inputs, so non-text question types
 * (`select`, `checkbox`, `rules`) are degraded to a paragraph field whose
 * placeholder lists the available options or instructions.
 */
function questionToModalField(q: ApplicationQuestion): PanelModalFieldDef {
  const baseStyle: 'short' | 'paragraph' = q.type === 'short' ? 'short' : 'paragraph';
  let placeholder = q.placeholder ?? '';

  if ((q.type === 'select' || q.type === 'checkbox') && q.options?.length) {
    const opts = q.options.join(', ');
    placeholder = placeholder ? `${placeholder} (Options: ${opts})` : `Options: ${opts}`;
  } else if (q.type === 'rules') {
    placeholder = placeholder || 'Type "I agree" to accept the rules';
  }

  // Discord modal limits: customId max 100 chars, placeholder max 100 chars,
  // label max 45 chars, maxLength <= 4000 for paragraphs / 1000 for short.
  return {
    customId: q.id.slice(0, 100),
    label: q.label.slice(0, 45),
    placeholder: placeholder.slice(0, 100) || undefined,
    style: baseStyle,
    required: q.required,
    maxLength: q.maxLength ?? (baseStyle === 'paragraph' ? 1000 : 200),
  };
}

/**
 * Fetch a recruitment's snapshotted application questions from the API.
 * Returns an empty array if the recruitment has no custom questions or the
 * fetch fails (caller falls back to the fixed APPLICATION_MODAL_FIELDS).
 */
async function fetchRecruitmentQuestions(
  recruitmentId: string,
  discordUserId: string,
  guildId: string | null
): Promise<ApplicationQuestion[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/v2/recruitment/${recruitmentId}`, {
      headers: {
        'X-Discord-User-Id': discordUserId,
        ...(guildId ? { 'X-Discord-Guild-Id': guildId } : {}),
      },
    });
    const questions = response.data?.applicationQuestions;
    if (!Array.isArray(questions)) {
      return [];
    }
    // Defensive: ensure shape matches ApplicationQuestion (drop malformed)
    return questions.filter(
      (q): q is ApplicationQuestion =>
        !!q && typeof q.id === 'string' && typeof q.label === 'string'
    );
  } catch (err) {
    logger.warn('Failed to fetch recruitment questions for dynamic modal', {
      recruitmentId,
      error: getErrorMessage(err),
    });
    return [];
  }
}

/**
 * Build a paginated modal showing questions[page*5 .. page*5+5).
 * customId pattern: `recruitment_apply_dyn_{recruitmentId}_{page}`
 */
function buildDynamicApplicationModal(
  recruitmentId: string,
  questions: ApplicationQuestion[],
  page: number
) {
  const totalPages = Math.ceil(questions.length / DISCORD_MODAL_MAX_FIELDS);
  const start = page * DISCORD_MODAL_MAX_FIELDS;
  const slice = questions.slice(start, start + DISCORD_MODAL_MAX_FIELDS);
  const fields = slice.map(questionToModalField);
  const titleSuffix = totalPages > 1 ? ` (${page + 1}/${totalPages})` : '';
  return buildPanelModal(
    `recruitment_apply_dyn_${recruitmentId}_${page}`,
    `📋 Application${titleSuffix}`,
    fields
  );
}

/**
 * Fetch org questions and show either the dynamic paginated modal (when
 * questions are configured) or the legacy fixed-field modal as a fallback.
 *
 * When questions include `type: 'select'` with options, those are shown as
 * Discord StringSelectMenus BEFORE the modal opens. This avoids the UX
 * degradation of listing options in a text placeholder.
 *
 * Flow: select questions (chained) → text/paragraph modal (paginated)
 */
async function showApplicationModal(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  recruitmentId: string,
  legacyModalTitle: string
): Promise<void> {
  const questions = await fetchRecruitmentQuestions(
    recruitmentId,
    interaction.user.id,
    interaction.guildId
  );

  if (questions.length === 0) {
    const modal = buildPanelModal(
      `recruitment_apply_modal_${recruitmentId}`,
      legacyModalTitle,
      APPLICATION_MODAL_FIELDS
    );
    await interaction.showModal(modal);
    return;
  }

  // Separate select-type questions (answerable via dropdown) from text-only ones
  const selectQuestions = questions.filter(
    q => q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25
  );
  const textQuestions = questions.filter(
    q => !(q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25)
  );

  // Store ALL questions for the full flow — text questions go in modal, select answers merge later
  pendingDynamicApplications.set(interaction.user.id, {
    recruitmentId,
    questions,
    modalQuestions: textQuestions,
    answers: {},
    timestamp: Date.now(),
  });

  if (selectQuestions.length > 0) {
    // Start the select chain — show the first select-type question
    await showNextSelectQuestion(interaction, recruitmentId, selectQuestions, 0);
  } else {
    // No select questions — go straight to modal with all questions
    const modal = buildDynamicApplicationModal(recruitmentId, textQuestions, 0);
    await interaction.showModal(modal);
  }
}

/**
 * Show the next select-type question as a StringSelectMenu.
 * When all selects are answered, opens the text-only modal.
 */
async function showNextSelectQuestion(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  recruitmentId: string,
  selectQuestions: ApplicationQuestion[],
  index: number
): Promise<void> {
  const q = selectQuestions[index];
  const totalSelects = selectQuestions.length;
  const stepLabel = totalSelects > 1 ? ` (${index + 1}/${totalSelects})` : '';

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`recruitment_dynselect_${recruitmentId}_${index}`)
      .setPlaceholder(q.placeholder?.slice(0, 100) || `Select ${q.label}...`.slice(0, 100))
      .addOptions(
        q.options!.slice(0, 25).map(opt => ({
          label: opt.slice(0, 100),
          value: opt.slice(0, 100),
        }))
      )
  );

  const content = `📋 **${q.label}**${stepLabel}\n${q.required ? '*(required)*' : '*(optional)*'}`;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await interaction.reply({
      content,
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Submit a dynamic application when all questions were select-type
 * (no text modal was shown). Reuses the same API call pattern as
 * the final-page handler.
 */
async function submitDynamicApplication(
  interaction: StringSelectMenuInteraction | ModalSubmitInteraction,
  pendingApp: PendingDynamicApplication
): Promise<void> {
  const pendingSelect = pendingSelectAnswers.get(interaction.user.id);
  const selectAnswers =
    pendingSelect?.recruitmentId === pendingApp.recruitmentId ? pendingSelect.answers : {};
  pendingSelectAnswers.delete(interaction.user.id);
  pendingDynamicApplications.delete(interaction.user.id);

  const payload = buildDynamicRecruitmentApplyPayload({
    questions: pendingApp.questions,
    answersByQuestionId: pendingApp.answers,
    selectedPreferredRole: selectAnswers.preferred_role,
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
  });

  try {
    await submitRecruitmentApplicationAndNotify(interaction, pendingApp.recruitmentId, payload, {
      payload,
    });
  } catch (error: unknown) {
    await replyRecruitmentApplyError(interaction, error);
  }
}

// ─── Panel Configuration ───────────────────────────────────────────────

const RECRUITMENT_PANEL_CONFIG: PanelConfig = {
  title: '📋 Join Our Organization',
  description: [
    "Welcome! We're always looking for talented pilots to join our fleet.",
    '',
    '**How to Apply:**',
    '1. Click **View Positions** to see available roles',
    '2. Find a position that matches your skills',
    '3. Click **Quick Apply** to submit an application',
    '',
    '**What We Offer:**',
    '• Active community and regular events',
    '• Training and mentorship programs',
    '• Fleet operations and group activities',
    '',
    'We look forward to flying with you! 🚀',
  ].join('\n'),
  footer: 'Applications are reviewed within 24-48 hours',
  prefix: 'recruitment',
  buttons: [
    {
      action: 'view',
      label: 'View Positions',
      style: ButtonStyle.Primary,
      emoji: '📋',
      description: 'Browse all open recruitment positions',
    },
    {
      action: 'quick_apply',
      label: 'Quick Apply',
      style: ButtonStyle.Success,
      emoji: '📝',
      description: 'Apply to the most recent open position',
    },
  ],
};

// ─── Dynamic Recruitment Embed ─────────────────────────────────────────

/**
 * Frontend recruitment status priority for panel display: an active (open)
 * posting always wins, then the most recent closed, then paused.
 */
const RECRUITMENT_STATUS_PRIORITY: Record<string, number> = {
  open: 0,
  closed: 1,
  paused: 2,
};

/**
 * Select the single most relevant recruitment for the panel from a mixed-status
 * list (BOT-06). Prefers an open posting, then the most recent closed, then the
 * most recent paused; within a status group the most recently updated/created
 * posting wins. Recency is read from each record's own timestamps, so selection
 * does not depend on the server's list ordering. Pure — exported for testing.
 */
export function selectLatestRecruitment(
  recruitments: readonly RecruitmentSummary[]
): RecruitmentSummary | null {
  let best: RecruitmentSummary | null = null;
  let bestPriority = Number.POSITIVE_INFINITY;
  let bestRecency = Number.NEGATIVE_INFINITY;

  for (const recruitment of recruitments) {
    const priority = RECRUITMENT_STATUS_PRIORITY[recruitment.status ?? 'closed'] ?? 1;
    const parsed = Date.parse(recruitment.updatedAt ?? recruitment.createdAt ?? '');
    const recency = Number.isNaN(parsed) ? 0 : parsed;
    if (priority < bestPriority || (priority === bestPriority && recency > bestRecency)) {
      best = recruitment;
      bestPriority = priority;
      bestRecency = recency;
    }
  }

  return best;
}

/**
 * Fetch the most relevant recruitment for the guild's linked organization
 * regardless of status (open, closed, paused). Used by the panel builder to
 * show a "Recruitment Closed" state when no positions are open.
 *
 * BOT-06: a single recency-bounded lookup across all statuses (one round-trip
 * instead of three sequential open→closed→paused calls), with deterministic
 * client-side selection via {@link selectLatestRecruitment}.
 */
async function fetchLatestRecruitment(guildId: string | null): Promise<RecruitmentSummary | null> {
  if (!guildId) {
    return null;
  }
  try {
    const response = await axios.get(`${API_BASE_URL}/v2/recruitment`, {
      // No status filter: fetch the org's recruitments in one call (bounded so a
      // single page covers all of a typical org's postings) and choose locally.
      params: { limit: 50 },
      headers: { 'X-Discord-Guild-Id': guildId },
    });
    const list = (response.data?.data ?? []) as RecruitmentSummary[];
    return selectLatestRecruitment(list);
  } catch (err) {
    logger.warn('Failed to fetch recruitments for panel (any status)', {
      guildId,
      error: getErrorMessage(err),
    });
    return null;
  }
}

/**
 * Build a panel embed for a closed/paused recruitment. The embed has a muted
 * colour and indicates that recruitment is currently closed.
 */
// ─── Application Modal Fields ──────────────────────────────────────────

const APPLICATION_MODAL_FIELDS: PanelModalFieldDef[] = [
  {
    customId: 'rsi_handle',
    label: 'RSI Handle',
    placeholder: 'Your Star Citizen handle',
    style: 'short',
    required: true,
    maxLength: 100,
  },
  {
    customId: 'timezone',
    label: 'Timezone',
    placeholder: 'e.g., UTC, EST, PST, GMT+1',
    style: 'short',
    required: true,
    maxLength: 50,
  },
  {
    customId: 'experience',
    label: 'Tell us about your experience',
    placeholder: 'Your experience with Star Citizen and relevant skills...',
    style: 'paragraph',
    required: true,
    minLength: 50,
    maxLength: 1000,
  },
  {
    customId: 'availability',
    label: 'Available playtimes',
    placeholder: 'e.g., Weekends, Evenings EST, etc.',
    style: 'short',
    required: true,
    maxLength: 200,
  },
  {
    customId: 'motivation',
    label: 'Why do you want to join?',
    placeholder: 'What attracts you to this organization...',
    style: 'paragraph',
    required: true,
    minLength: 50,
    maxLength: 1000,
  },
];

const LEGACY_REVIEW_BUTTON_MESSAGE =
  '⚠️ This button uses an outdated format. Please re-post the recruitment listing to get updated Accept/Deny buttons.';
const APPLY_BUTTON_REGEX = /^recruitment_apply_(.+)$/;
const CONTINUE_BUTTON_REGEX = /^recruitment_apply_continue_(.+)_(\d+)$/;
const VIEW_BUTTON_REGEX = /^recruitment_view_(.+)$/;
const ACCEPT_BUTTON_REGEX = /^recruitment_accept_([0-9a-f-]+)_([0-9a-f-]+)$/;
const LEGACY_ACCEPT_BUTTON_REGEX = /^recruitment_accept_([0-9a-f-]+)$/;
const DENY_BUTTON_REGEX = /^recruitment_deny_([0-9a-f-]+)_([0-9a-f-]+)$/;
const LEGACY_DENY_BUTTON_REGEX = /^recruitment_deny_([0-9a-f-]+)$/;
const CONFIRM_DENY_BUTTON_REGEX = /^recruitment_confirmdeny_([0-9a-f-]+)_([0-9a-f-]+)$/;
const DENY_DISMISS_BUTTON_REGEX = /^recruitment_denydismiss_([0-9a-f-]+)_([0-9a-f-]+)$/;

async function tryHandleCommandPanelButton(interaction: ButtonInteraction): Promise<boolean> {
  const sub = parsePanelCustomId(interaction.customId, 'recruitment');
  if (!sub) {
    return false;
  }

  const handlers: Record<string, (i: ButtonInteraction) => Promise<void>> = {
    list: handlePanelViewPositions,
    apply: handlePanelQuickApply,
    my_apps: _handleMyApplicationsButton,
    panel: _handleCreatePanelButton,
    customize: _handleCreatePanelButton,
  };

  const handler = handlers[sub];
  if (!handler) {
    return false;
  }

  await handler(interaction);
  return true;
}

async function tryHandlePersistentPanelButton(interaction: ButtonInteraction): Promise<boolean> {
  const parsed = parsePanelButtonId(interaction.customId);
  if (parsed?.prefix !== 'recruitment') {
    return false;
  }

  if (parsed.action === 'view') {
    await handlePanelViewPositions(interaction);
    return true;
  }

  if (parsed.action === 'quick_apply') {
    await handlePanelQuickApply(interaction);
    return true;
  }

  await interaction.reply({
    content: '❌ Unknown panel action.',
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

async function tryHandleApplyButton(interaction: ButtonInteraction): Promise<boolean> {
  const match = APPLY_BUTTON_REGEX.exec(interaction.customId);
  if (!match) {
    return false;
  }

  await showApplicationModal(interaction, match[1], '📋 Recruitment Application');
  return true;
}

async function tryHandleContinueButton(interaction: ButtonInteraction): Promise<boolean> {
  const match = CONTINUE_BUTTON_REGEX.exec(interaction.customId);
  if (!match) {
    return false;
  }

  const recruitmentId = match[1];
  const nextPage = Number(match[2]);
  const pending = pendingDynamicApplications.get(interaction.user.id);
  if (pending?.recruitmentId !== recruitmentId) {
    await interaction.reply({
      content: '❌ Your application session expired. Please start again.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const modal = buildDynamicApplicationModal(recruitmentId, pending.modalQuestions, nextPage);
  await interaction.showModal(modal);
  return true;
}

async function tryHandleViewButton(interaction: ButtonInteraction): Promise<boolean> {
  const match = VIEW_BUTTON_REGEX.exec(interaction.customId);
  if (!match) {
    return false;
  }

  await handleButtonViewRecruitment(interaction, match[1]);
  return true;
}

async function tryHandleReviewButtons(interaction: ButtonInteraction): Promise<boolean> {
  const acceptMatch = ACCEPT_BUTTON_REGEX.exec(interaction.customId);
  if (acceptMatch) {
    await handleAcceptApplication(interaction, acceptMatch[1], acceptMatch[2]);
    return true;
  }

  const legacyAcceptMatch = LEGACY_ACCEPT_BUTTON_REGEX.exec(interaction.customId);
  if (legacyAcceptMatch) {
    await interaction.reply({
      content: LEGACY_REVIEW_BUTTON_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const denyMatch = DENY_BUTTON_REGEX.exec(interaction.customId);
  if (denyMatch) {
    // Confirm by default before denying (C2): the actual denial runs on confirm
    // via `recruitment_confirmdeny_*`, which re-enters this handler.
    await interaction.reply(
      buildConfirmationPrompt({
        confirmCustomId: `recruitment_confirmdeny_${denyMatch[1]}_${denyMatch[2]}`,
        cancelCustomId: `recruitment_denydismiss_${denyMatch[1]}_${denyMatch[2]}`,
        message: 'deny this application',
        confirmLabel: 'Deny Application',
        cancelLabel: 'Keep Pending',
        confirmEmoji: '❌',
        cancelEmoji: '↩️',
      })
    );
    return true;
  }

  const confirmDenyMatch = CONFIRM_DENY_BUTTON_REGEX.exec(interaction.customId);
  if (confirmDenyMatch) {
    await handleDenyApplication(interaction, confirmDenyMatch[1], confirmDenyMatch[2]);
    return true;
  }

  if (DENY_DISMISS_BUTTON_REGEX.test(interaction.customId)) {
    await respondConfirmationCancelled(interaction);
    return true;
  }

  const legacyDenyMatch = LEGACY_DENY_BUTTON_REGEX.exec(interaction.customId);
  if (!legacyDenyMatch) {
    return false;
  }

  await interaction.reply({
    content: LEGACY_REVIEW_BUTTON_MESSAGE,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

/**
 * Recruitment Command - Appy.bot-like functionality
 *
 * Provides Discord integration for recruitment applications including:
 * - Viewing open recruitments
 * - Applying to recruitments through Discord
 * - Managing recruitment postings
 * - Creating application forms that bind to Discord invites
 */
export const recruitment: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('recruitment')
    .setDescription('Recruitment and application management'),

  cooldown: 5,
  category: 'organization',

  async execute(interaction: ChatInputCommandInteraction) {
    const panelConfig: CommandPanelConfig = {
      prefix: 'recruitment',
      title: 'Recruitment',
      description: 'Browse open positions and manage applications.',
      buttons: [
        {
          subcommand: 'list',
          label: 'View Positions',
          emoji: '\ud83d\udccb',
          style: ButtonStyle.Primary,
        },
        {
          subcommand: 'apply',
          label: 'Quick Apply',
          emoji: '\ud83d\udcdd',
          style: ButtonStyle.Success,
        },
        { subcommand: 'my_apps', label: 'My Applications', emoji: '\ud83d\udcc4' },
        { subcommand: 'panel', label: 'Post Recruitment Panel', emoji: '\ud83d\udccc' },
      ],
    };
    await replyWithCommandPanel(interaction, panelConfig);
  },

  async handleButton(interaction: ButtonInteraction) {
    // My-applications pagination (recruitment_myappspage_<n>) — edits in place.
    if (interaction.customId.startsWith(RECRUITMENT_MY_APPS_PAGE_PREFIX)) {
      await handleMyApplicationsPageButton(interaction);
      return;
    }

    if (await tryHandleCommandPanelButton(interaction)) {
      return;
    }

    if (await tryHandlePersistentPanelButton(interaction)) {
      return;
    }

    if (await tryHandleApplyButton(interaction)) {
      return;
    }

    if (await tryHandleContinueButton(interaction)) {
      return;
    }

    if (await tryHandleViewButton(interaction)) {
      return;
    }

    await tryHandleReviewButtons(interaction);
  },

  async handleSelectMenu(interaction: StringSelectMenuInteraction) {
    // Handle chained select questions for dynamic applications
    const dynSelectMatch = /^recruitment_dynselect_(.+)_(\d+)$/.exec(interaction.customId);
    if (dynSelectMatch) {
      const recruitmentId = dynSelectMatch[1];
      const selectIndex = Number(dynSelectMatch[2]);

      const pendingApp = pendingDynamicApplications.get(interaction.user.id);
      if (pendingApp?.recruitmentId !== recruitmentId) {
        await interaction.reply({
          content: '❌ Application session expired. Please start over.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Store the answer
      const allQuestions = pendingApp.questions;
      const selectQuestions = allQuestions.filter(
        q => q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25
      );
      const textQuestions = allQuestions.filter(
        q => !(q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25)
      );

      const answeredQ = selectQuestions[selectIndex];
      if (answeredQ) {
        pendingApp.answers[answeredQ.id] = interaction.values[0];
        pendingApp.timestamp = Date.now();
      }

      const nextIndex = selectIndex + 1;
      if (nextIndex < selectQuestions.length) {
        // More selects to show
        await showNextSelectQuestion(interaction, recruitmentId, selectQuestions, nextIndex);
      } else if (textQuestions.length > 0) {
        // All selects answered — show the text-only modal
        const modal = buildDynamicApplicationModal(recruitmentId, textQuestions, 0);
        await interaction.showModal(modal);
      } else {
        // No text questions — submit directly
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await submitDynamicApplication(interaction, pendingApp);
      }
      return;
    }

    // Handle pre-modal select menu for preferred role (legacy pattern)
    const selectMatch = /^recruitment_premodal_(.+)$/.exec(interaction.customId);
    if (selectMatch) {
      const recruitmentId = selectMatch[1];
      const selectedValue = interaction.values[0];

      // Store the select answer for this user
      const existing = pendingSelectAnswers.get(interaction.user.id);
      pendingSelectAnswers.set(interaction.user.id, {
        recruitmentId,
        answers: {
          ...(existing?.recruitmentId === recruitmentId ? existing.answers : {}),
          preferred_role: selectedValue,
        },
        timestamp: Date.now(),
      });

      // Now show the application modal (dynamic if org has custom questions,
      // legacy 5-field otherwise). Any answers captured by the dynamic flow
      // will be merged with `pendingSelectAnswers` on final submit.
      await showApplicationModal(interaction, recruitmentId, '📋 Recruitment Application');
    }
  },

  async handleModal(interaction: ModalSubmitInteraction) {
    // Handle panel customization modal
    if (interaction.customId === 'recruitment_panel_customize') {
      await handlePanelCustomizeSubmit(interaction);
      return;
    }

    // Handle dynamic paginated application modal:
    //   recruitment_apply_dyn_{recruitmentId}_{page}
    const dynamicMatch = /^recruitment_apply_dyn_(.+)_(\d+)$/.exec(interaction.customId);
    if (dynamicMatch) {
      await handleDynamicApplicationPageSubmit(
        interaction,
        dynamicMatch[1],
        Number(dynamicMatch[2])
      );
      return;
    }

    // Handle legacy fixed-field application modal: recruitment_apply_modal_{id}
    const applyMatch = /^recruitment_apply_modal_(.+)$/.exec(interaction.customId);
    if (applyMatch) {
      await handleApplicationSubmit(interaction, applyMatch[1]);
    }
  },
};

/* ── Panel customization modal handler ──────────────────────────────── */

async function handlePanelCustomizeSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const customTitle = interaction.fields.getTextInputValue('panel_title').trim() || undefined;
  const customDescription =
    interaction.fields.getTextInputValue('panel_description').trim() || undefined;

  const recruitment = await fetchLatestRecruitment(interaction.guildId);
  const isOpen = recruitment?.status === 'open';

  let embed: EmbedBuilder;
  let buttons: ActionRowBuilder<ButtonBuilder>;

  if (recruitment && isOpen) {
    // Open recruitment — colourful embed with active buttons
    embed = buildRecruitmentPanelEmbed(recruitment, customTitle, customDescription);
    buttons = buildPanelButtons(RECRUITMENT_PANEL_CONFIG);
  } else if (recruitment) {
    // Closed/paused recruitment — grey embed with disabled buttons
    embed = buildClosedRecruitmentPanelEmbed(recruitment, customTitle, customDescription);
    buttons = buildDisabledPanelButtons(RECRUITMENT_PANEL_CONFIG);
  } else {
    // No recruitment at all — static fallback with disabled buttons
    const fallbackConfig: PanelConfig = {
      ...RECRUITMENT_PANEL_CONFIG,
      title: customTitle ? `📋 ${customTitle}` : RECRUITMENT_PANEL_CONFIG.title,
      description:
        customDescription ??
        'No recruitment postings found. Create a recruitment on the web dashboard first.',
    };
    embed = buildPanelEmbed(fallbackConfig);
    buttons = buildDisabledPanelButtons(RECRUITMENT_PANEL_CONFIG);
  }

  await interaction.reply({
    content: '✅ Recruitment panel created!',
    flags: MessageFlags.Ephemeral,
  });
  // @ts-expect-error - interaction.channel may be a PartialGroupDMChannel which lacks send(); safe here because guildOnly guards guarantee a guild text channel
  await interaction.channel?.send({ embeds: [embed], components: [buttons] });
}

/**
 * Build an ActionRow of disabled buttons from a PanelConfig.
 * Used when recruitment is closed/paused so buttons appear greyed-out.
 */
function buildDisabledPanelButtons(config: PanelConfig): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const btn of config.buttons) {
    const builder = new ButtonBuilder()
      .setCustomId(`${config.prefix}_panel_${btn.action}`)
      .setLabel(btn.label)
      .setStyle(ButtonStyle.Secondary) // Grey
      .setDisabled(true);

    if (btn.emoji) {
      builder.setEmoji(btn.emoji);
    }

    row.addComponents(builder);
  }

  return row;
}

/* ── Panel button handlers (ephemeral command panel) ─────────────────── */

async function _handleMyApplicationsButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const applications = await fetchMyApplications(interaction);

    if (applications.length === 0) {
      await interaction.editReply({
        content: "\ud83d\udced You haven't submitted any applications yet.",
      });
      return;
    }

    await interaction.editReply(buildMyApplicationsView(applications, 0));
  } catch (error: unknown) {
    await interaction.editReply({
      content: `\u274c Failed to fetch applications: ${getErrorMessage(error)}`,
    });
  }
}

/** Fetch the current user's applications as the typed wire shape. */
async function fetchMyApplications(interaction: ButtonInteraction): Promise<MyApplicationView[]> {
  const response = await axios.get<{ data?: MyApplicationView[] }>(
    `${API_BASE_URL}/v2/recruitment/my-applications`,
    {
      headers: {
        'X-Discord-User-Id': interaction.user.id,
        'X-Discord-Guild-Id': interaction.guildId,
      },
    }
  );
  return response.data?.data ?? [];
}

/** Page through the "Your Applications" list via the shared pagination row. */
async function handleMyApplicationsPageButton(interaction: ButtonInteraction): Promise<void> {
  const page = Number.parseInt(
    interaction.customId.slice(RECRUITMENT_MY_APPS_PAGE_PREFIX.length),
    10
  );
  // Ignore a non-numeric/negative page (the disabled control emits `..._-1`).
  if (Number.isNaN(page) || page < 0) {
    return;
  }

  // Defer the update first: the list re-fetch is an HTTP round-trip, which can
  // exceed Discord's 3s response deadline for a bare `interaction.update`.
  await interaction.deferUpdate();

  try {
    const applications = await fetchMyApplications(interaction);

    if (applications.length === 0) {
      await interaction.editReply({
        content: "\ud83d\udced You haven't submitted any applications yet.",
        embeds: [],
        components: [],
      });
      return;
    }

    await interaction.editReply(buildMyApplicationsView(applications, page));
  } catch (error: unknown) {
    await interaction.editReply({
      content: `\u274c Failed to fetch applications: ${getErrorMessage(error)}`,
    });
  }
}

async function _handleCreatePanelButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({
      content: '\u274c You need Administrator permissions to create a recruitment panel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Show the customization modal immediately — no API call before showModal
  // to stay within Discord's 3-second interaction deadline. The actual
  // recruitment fetch happens in handlePanelCustomizeSubmit after the user
  // submits the modal (where we can defer).
  const modal = new ModalBuilder()
    .setCustomId('recruitment_panel_customize')
    .setTitle('Customize Recruitment Panel');

  const titleInput = new TextInputBuilder()
    .setCustomId('panel_title')
    .setPlaceholder('e.g., Join Our Organization')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(200);

  const descInput = new TextInputBuilder()
    .setCustomId('panel_description')
    .setPlaceholder('Custom description for the embed...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);

  const titleLabel = new LabelBuilder()
    .setLabel('Panel Title (leave blank for default)')
    .setTextInputComponent(titleInput);
  const descLabel = new LabelBuilder()
    .setLabel('Panel Description (leave blank for default)')
    .setTextInputComponent(descInput);

  modal.addLabelComponents(titleLabel, descLabel);

  await interaction.showModal(modal);
}

// ==================== ACTIVE PANEL HANDLERS ====================
// These functions are called from handleButton/handleModal above.

interface RecruitmentListItem {
  id: string;
  title: string;
  status: string;
  description?: string;
  rolesNeeded?: string[];
  currentApplicants?: number | null;
  maxPositions?: number | null;
}

async function fetchOpenRecruitments(
  interaction: ButtonInteraction
): Promise<RecruitmentListItem[]> {
  const response = await axios.get(`${API_BASE_URL}/v2/recruitment`, {
    params: { status: 'open' },
    headers: { 'X-Discord-Guild-Id': interaction.guildId },
  });

  return (response.data.data ?? []) as RecruitmentListItem[];
}

function buildRecruitmentLoadErrorMessage(error: unknown): string {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const respData = isAxiosError(error)
    ? (error.response?.data as Record<string, string> | undefined)
    : undefined;
  const apiError = respData?.error;
  const apiDetail = apiError ?? respData?.message;

  if (
    isAxiosError(error) &&
    (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))
  ) {
    return '❌ The API did not respond in time. The server may be starting up — please try again in a moment.';
  }

  if (status === 403) {
    if (apiError?.includes('Direct access')) {
      return (
        '❌ The bot could not reach the API (blocked by Front Door).\n\n' +
        '• Ensure `BOT_API_INTERNAL_URL` is set to the internal API address.\n' +
        '• Ensure `BOT_INTERNAL_SECRET` matches between bot and API.'
      );
    }

    let content =
      '❌ This Discord server is not linked to a Fringe Core organization, ' +
      'or the link was just created and the cache has not yet refreshed.\n\n' +
      '• Ask an admin to run `/org` and use **Help → Server Setup** to verify the link.\n' +
      '• If you just linked it, wait ~30 seconds and try again.\n' +
      '• Otherwise an admin can link it via the `/org` server setup panel ' +
      'or in **Organization Settings → Discord Server** on the web dashboard.';

    if (apiError) {
      content += `\n\n🔍 API detail: ${apiError}`;
    }
    return content;
  }

  if (status === 401) {
    let content =
      '❌ The bot could not authenticate to the API.\n\n' +
      '• Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both the API and bot environments.\n' +
      '• Restart the bot after changing environment variables.';

    if (apiDetail) {
      content += `\n\n🔍 API detail: ${apiDetail}`;
    }
    return content;
  }

  return `❌ Failed to load positions: ${getErrorMessage(error)}`;
}

function buildRecruitmentApplyRows(
  recruitments: RecruitmentListItem[],
  style: ButtonStyle
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  // Discord message components allow up to 5 rows with 5 buttons each.
  for (let i = 0; i < Math.min(recruitments.length, 25); i++) {
    if (i % 5 === 0 && rows.length < 5) {
      rows.push(new ActionRowBuilder<ButtonBuilder>());
    }
    rows[Math.floor(i / 5)].addComponents(
      new ButtonBuilder()
        .setCustomId(`recruitment_apply_${recruitments[i].id}`)
        .setLabel(`Apply: ${recruitments[i].title.substring(0, 20)}`)
        .setStyle(style)
        .setEmoji('📝')
    );
  }
  return rows;
}

/* ── Button interaction handlers (extracted for readability) ─────────── */

async function handlePanelViewPositions(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const recruitments = await fetchOpenRecruitments(interaction);

    if (recruitments.length === 0) {
      await interaction.editReply({
        content: '📭 No open positions at this time. Check back later!',
      });
      return;
    }

    await interaction.editReply({
      embeds: [buildViewPositionsEmbed(recruitments)],
      components: buildRecruitmentApplyRows(recruitments, ButtonStyle.Primary),
    });
  } catch (error) {
    logger.error('Failed to fetch recruitments via panel:', error);
    await interaction.editReply({ content: buildRecruitmentLoadErrorMessage(error) });
  }
}

async function handlePanelQuickApply(interaction: ButtonInteraction): Promise<void> {
  // Defer first to avoid Discord's 3-second interaction timeout.
  // We cannot show a modal after deferring, so instead we present apply
  // buttons — clicking one triggers the modal via the existing
  // `recruitment_apply_{id}` handler.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const recruitments = await fetchOpenRecruitments(interaction);

    if (recruitments.length === 0) {
      await interaction.editReply({
        content: '📭 No open positions available right now. Check back later!',
      });
      return;
    }

    if (recruitments.length === 1) {
      const recruitment = recruitments[0];
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`recruitment_apply_${recruitment.id}`)
          .setLabel(`Apply: ${recruitment.title.substring(0, 30)}`)
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝')
      );

      await interaction.editReply({
        embeds: [buildSingleQuickApplyEmbed(recruitment)],
        components: [row],
      });
      return;
    }

    await interaction.editReply({
      embeds: [buildMultiQuickApplyEmbed(recruitments)],
      components: buildRecruitmentApplyRows(recruitments, ButtonStyle.Success),
    });
  } catch (error) {
    logger.error('Failed to fetch recruitments for quick apply:', error);
    await interaction.editReply({ content: buildRecruitmentLoadErrorMessage(error) });
  }
}

async function handleButtonViewRecruitment(
  interaction: ButtonInteraction,
  recruitmentId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const response = await axios.get<RecruitmentDetailsInput>(
      `${API_BASE_URL}/v2/recruitment/${recruitmentId}`,
      {
        headers: { 'X-Discord-Guild-Id': interaction.guildId },
      }
    );

    const recruitment = response.data;
    const embed = buildRecruitmentDetailsEmbed(recruitment);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`recruitment_apply_${recruitment.id}`)
        .setLabel('Apply Now')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝')
        .setDisabled(recruitment.status !== 'open')
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    logger.error('Failed to fetch recruitment details via button:', error);
    await interaction.editReply({
      content: `❌ Failed to load recruitment: ${getErrorMessage(error)}`,
    });
  }
}

/* ── Modal submission handlers ──────────────────────────────────────── */

async function handleApplicationSubmit(
  interaction: ModalSubmitInteraction,
  recruitmentId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const rsiHandle = interaction.fields.getTextInputValue('rsi_handle');
  const timezone = interaction.fields.getTextInputValue('timezone');
  const experience = interaction.fields.getTextInputValue('experience');
  const availability = interaction.fields.getTextInputValue('availability');
  const motivation = interaction.fields.getTextInputValue('motivation');

  // Collect any pre-modal select answers
  const pending = pendingSelectAnswers.get(interaction.user.id);
  const selectAnswers = pending?.recruitmentId === recruitmentId ? pending.answers : {};
  pendingSelectAnswers.delete(interaction.user.id);

  try {
    const payload = buildLegacyRecruitmentApplyPayload({
      rsiHandle,
      timezone,
      experience,
      availability,
      motivation,
      selectedPreferredRole: selectAnswers.preferred_role,
      discordUserId: interaction.user.id,
      discordUsername: interaction.user.username,
    });

    await submitRecruitmentApplicationAndNotify(interaction, recruitmentId, payload, {
      payload,
      legacySummary: {
        availability,
        experience,
        motivation,
        preferredRole: selectAnswers.preferred_role,
      },
    });
  } catch (error) {
    await replyRecruitmentApplyError(interaction, error);
  }
}

/**
 * Handle a single page of a paginated dynamic application modal.
 * - Reads the submitted text inputs by question id
 * - Persists them onto the in-flight pending application
 * - If more pages remain: replies with a "Continue Application" button
 * - If this was the final page: posts the full application to the API
 */
async function handleDynamicApplicationPageSubmit(
  interaction: ModalSubmitInteraction,
  recruitmentId: string,
  page: number
): Promise<void> {
  const pendingApp = pendingDynamicApplications.get(interaction.user.id);
  if (pendingApp?.recruitmentId !== recruitmentId) {
    await interaction.reply({
      content: '❌ Your application session expired. Please start the application again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const modalQs = pendingApp.modalQuestions;
  const totalPages = Math.ceil(modalQs.length / DISCORD_MODAL_MAX_FIELDS);
  const start = page * DISCORD_MODAL_MAX_FIELDS;
  const pageQuestions = modalQs.slice(start, start + DISCORD_MODAL_MAX_FIELDS);

  // Capture the answers from this modal page
  for (const q of pageQuestions) {
    try {
      pendingApp.answers[q.id] = interaction.fields.getTextInputValue(q.id.slice(0, 100));
    } catch {
      pendingApp.answers[q.id] = '';
    }
  }
  pendingApp.timestamp = Date.now();

  if (page + 1 < totalPages) {
    // More pages: prompt user to continue.
    const continueBtn = new ButtonBuilder()
      .setCustomId(`recruitment_apply_continue_${recruitmentId}_${page + 1}`)
      .setLabel(`Continue Application → Page ${page + 2}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➡️');
    await interaction.reply({
      content: `✅ Page ${page + 1}/${totalPages} saved. Click below to continue.`,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(continueBtn)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Final page: submit the full application.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Merge any pre-modal select answers (e.g. preferred_role) captured before
  // the dynamic modal was shown via the pre-modal select handler.
  const pendingSelect = pendingSelectAnswers.get(interaction.user.id);
  const selectAnswers = pendingSelect?.recruitmentId === recruitmentId ? pendingSelect.answers : {};
  pendingSelectAnswers.delete(interaction.user.id);

  // Build canonical payload that matches recruitmentSchemas.apply exactly.
  const payload = buildDynamicRecruitmentApplyPayload({
    questions: pendingApp.questions,
    answersByQuestionId: pendingApp.answers,
    selectedPreferredRole: selectAnswers.preferred_role,
    discordUserId: interaction.user.id,
    discordUsername: interaction.user.username,
  });

  try {
    await submitRecruitmentApplicationAndNotify(interaction, recruitmentId, payload, {
      payload,
    });
  } catch (error) {
    await replyRecruitmentApplyError(interaction, error);
  } finally {
    pendingDynamicApplications.delete(interaction.user.id);
  }
}

interface RecruitmentConfig {
  acceptRoleId?: string;
  denyRoleId?: string;
  acceptedRemovalRoleIds?: string[];
  deniedRemovalRoleIds?: string[];
  welcomeMessage?: string;
  deniedMessage?: string;
  acceptedChannelId?: string;
  deniedChannelId?: string;
}

function getApplicationDiscordUserId(application: Record<string, unknown>): string | undefined {
  const value = application.discordUserId;
  return typeof value === 'string' ? value : undefined;
}

function getApplicationDiscordUsername(
  application: Record<string, unknown>,
  fallback: string
): string {
  const value = application.discordUsername;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return fallback;
}

async function getRecruitmentConfig(guildId: string | null): Promise<RecruitmentConfig> {
  const settingsService = getSettingsService();
  const settings = await settingsService.getSettingsByGuildId(guildId ?? '');
  const recruitConfig = settings?.[0]?.recruitmentSettings;
  return recruitConfig ?? {};
}

async function updateApplicationStatus(
  interaction: ButtonInteraction,
  recruitmentId: string,
  applicationId: string,
  action: 'accept' | 'reject'
): Promise<Record<string, unknown>> {
  const response = await axios.put(
    `${API_BASE_URL}/v2/recruitment/${recruitmentId}/applications/${applicationId}`,
    { action },
    {
      headers: {
        'X-Discord-User-Id': interaction.user.id,
        'X-Discord-Guild-Id': interaction.guildId,
      },
    }
  );

  return (response.data ?? {}) as Record<string, unknown>;
}

interface ApplyDecisionRoleOptions {
  application: Record<string, unknown>;
  roleId: string | undefined;
  removalRoleIds: string[] | undefined;
  addReason: string;
  removeReason: string;
  missingPermissionMessage: string;
  successLogMessage: string;
}

async function applyDecisionRoleIfConfigured(
  interaction: ButtonInteraction,
  options: ApplyDecisionRoleOptions
): Promise<boolean> {
  const discordUserId = getApplicationDiscordUserId(options.application);
  if (!options.roleId || !discordUserId || !interaction.guild) {
    return false;
  }

  const canManageRoles =
    interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) === true;
  if (!canManageRoles) {
    logger.warn(options.missingPermissionMessage);
    return false;
  }

  try {
    const member = await interaction.guild.members.fetch(discordUserId);
    await member.roles.add(options.roleId, options.addReason);

    for (const removeRoleId of options.removalRoleIds ?? []) {
      await member.roles.remove(removeRoleId, options.removeReason).catch(() => {});
    }

    logger.info(options.successLogMessage);
    return true;
  } catch (roleError) {
    logger.warn('Failed to apply recruitment decision role:', roleError);
    return false;
  }
}

async function sendDecisionDmIfConfigured(
  interaction: ButtonInteraction,
  application: Record<string, unknown>,
  template: string | undefined,
  applicationId: string
): Promise<void> {
  const discordUserId = getApplicationDiscordUserId(application);
  if (!template || !discordUserId) {
    return;
  }

  try {
    const user = await interaction.client.users.fetch(discordUserId);
    const applicantName = getApplicationDiscordUsername(application, 'Applicant');
    const message = template
      .replaceAll('{user}', applicantName)
      .replaceAll('{application}', applicationId)
      .replaceAll('{reviewer}', interaction.user.username);
    await user.send(message);
  } catch {
    // DMs may be disabled.
  }
}

async function postDecisionNoticeIfConfigured(
  interaction: ButtonInteraction,
  application: Record<string, unknown>,
  applicationId: string,
  channelId: string | undefined,
  color: ColorResolvable,
  title: string,
  verb: string
): Promise<void> {
  if (!channelId || !interaction.guild) {
    return;
  }

  try {
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel?.isTextBased()) {
      return;
    }

    const applicantName = getApplicationDiscordUsername(application, applicationId);
    const embed = buildDecisionNoticeEmbed(
      color,
      title,
      applicantName,
      verb,
      interaction.user.username
    );
    await (channel as TextChannel).send({ embeds: [embed] });
  } catch {
    // Non-fatal.
  }
}

async function tryArchiveApplicationThread(
  interaction: ButtonInteraction,
  reason: string
): Promise<void> {
  try {
    if (interaction.channel?.isThread()) {
      await interaction.channel.setArchived(true, reason);
    }
  } catch {
    // Non-critical — thread may already be archived or bot lacks ManageThreads.
  }
}

/* ── Accept / Deny handlers ─────────────────────────────────────────── */

async function handleAcceptApplication(
  interaction: ButtonInteraction,
  recruitmentId: string,
  applicationId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const application = await updateApplicationStatus(
      interaction,
      recruitmentId,
      applicationId,
      'accept'
    );
    const recruitConfig = await getRecruitmentConfig(interaction.guildId);

    const roleAssigned = await applyDecisionRoleIfConfigured(interaction, {
      application,
      roleId: recruitConfig.acceptRoleId,
      removalRoleIds: recruitConfig.acceptedRemovalRoleIds,
      addReason: 'Recruitment application accepted',
      removeReason: 'Accepted — role removed',
      missingPermissionMessage:
        'Recruitment: bot lacks ManageRoles, skipping accept role assignment',
      successLogMessage: `Added accept role ${recruitConfig.acceptRoleId ?? 'unknown'} to user ${getApplicationDiscordUserId(application) ?? 'unknown'}`,
    });

    await sendDecisionDmIfConfigured(
      interaction,
      application,
      recruitConfig.welcomeMessage,
      applicationId
    );

    await postDecisionNoticeIfConfigured(
      interaction,
      application,
      applicationId,
      recruitConfig.acceptedChannelId,
      EmbedColors.SUCCESS,
      'Application Accepted',
      'accepted'
    );

    const applicantName = getApplicationDiscordUsername(application, applicationId);
    await interaction.editReply({
      content: `✅ Application from **${applicantName}** has been **accepted**.${roleAssigned ? ' Role has been assigned.' : ''}`,
    });

    await tryArchiveApplicationThread(interaction, 'Application accepted');
    await closeApplicantChannel(interaction.guild, applicationId, 'Application accepted');
  } catch (error) {
    logger.error('Failed to accept application:', error);
    await interaction.editReply({
      content: `❌ Failed to accept application: ${getErrorMessage(error)}`,
    });
  }
}

async function handleDenyApplication(
  interaction: ButtonInteraction,
  recruitmentId: string,
  applicationId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const application = await updateApplicationStatus(
      interaction,
      recruitmentId,
      applicationId,
      'reject'
    );
    const recruitConfig = await getRecruitmentConfig(interaction.guildId);

    await applyDecisionRoleIfConfigured(interaction, {
      application,
      roleId: recruitConfig.denyRoleId,
      removalRoleIds: recruitConfig.deniedRemovalRoleIds,
      addReason: 'Recruitment application denied',
      removeReason: 'Denied — role removed',
      missingPermissionMessage: 'Recruitment: bot lacks ManageRoles, skipping deny role assignment',
      successLogMessage: `Added deny role ${recruitConfig.denyRoleId ?? 'unknown'} to user ${getApplicationDiscordUserId(application) ?? 'unknown'}`,
    });

    await sendDecisionDmIfConfigured(
      interaction,
      application,
      recruitConfig.deniedMessage,
      applicationId
    );

    await postDecisionNoticeIfConfigured(
      interaction,
      application,
      applicationId,
      recruitConfig.deniedChannelId,
      EmbedColors.ERROR,
      'Application Denied',
      'denied'
    );

    const applicantName = getApplicationDiscordUsername(application, applicationId);
    await interaction.editReply({
      content: `❌ Application from **${applicantName}** has been **denied**.`,
    });

    await tryArchiveApplicationThread(interaction, 'Application denied');
    await closeApplicantChannel(interaction.guild, applicationId, 'Application denied');
  } catch (error) {
    logger.error('Failed to deny application:', error);
    await interaction.editReply({
      content: `❌ Failed to deny application: ${getErrorMessage(error)}`,
    });
  }
}

/* ── Staff review thread creation ───────────────────────────────────── */

async function createStaffReviewThread(
  interaction: ModalSubmitInteraction | StringSelectMenuInteraction,
  recruitmentId: string,
  application: Record<string, unknown>,
  reviewInput: StaffReviewThreadInput
): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
    // Use find() rather than [0] so the correct row is picked in multi-org guilds.
    const recruitRow = settings?.find(s => s.recruitmentSettings?.staffThreadChannelId);
    const staffChannelId = recruitRow?.recruitmentSettings?.staffThreadChannelId;
    const staffPingRoleId = recruitRow?.recruitmentSettings?.staffPingRoleId;

    if (!staffChannelId || !interaction.guild) {
      return;
    }

    const staffChannel = await interaction.guild.channels.fetch(staffChannelId);
    if (!staffChannel || !('threads' in staffChannel)) {
      return;
    }

    // Pre-check bot permission to create private threads
    const botMember = interaction.guild.members.me;
    if (botMember) {
      const channelPerms = staffChannel.permissionsFor(botMember);
      if (channelPerms && !channelPerms.has(PermissionFlagsBits.CreatePrivateThreads)) {
        logger.warn(
          `Recruitment: bot lacks CreatePrivateThreads in channel ${staffChannelId}, skipping staff thread`
        );
        return;
      }
    }

    // Create a thread for this application
    const thread = await (staffChannel as TextChannel).threads.create({
      name: `📋 ${interaction.user.username} - Application`,
      type: ChannelType.PrivateThread,
      reason: `Recruitment application from ${interaction.user.username}`,
    });

    const appRecord = application as { id?: string; applicationId?: string };
    const applicationId = appRecord.id || appRecord.applicationId || 'unknown';

    const reviewEmbed = buildStaffReviewEmbed(
      interaction.user.username,
      recruitmentId,
      interaction.user.id,
      reviewInput
    );

    // Accept/Deny buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`recruitment_accept_${recruitmentId}_${applicationId}`)
        .setLabel('Accept')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`recruitment_deny_${recruitmentId}_${applicationId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    // Ping staff role then send review embed
    const pingContent = staffPingRoleId ? `<@&${staffPingRoleId}> New application!` : '';
    await thread.send({
      content: pingContent || undefined,
      embeds: [reviewEmbed],
      components: [actionRow],
    });
  } catch (error) {
    logger.error('Failed to create staff review thread:', error);
    // Non-critical — application was already submitted
  }
}

/* ── Re-apply cooldown check ────────────────────────────────────────── */

async function _checkReapplyCooldown(guildId: string, userId: string): Promise<boolean> {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettingsByGuildId(guildId);
    const cooldownDays = settings?.[0]?.recruitmentSettings?.reapplyCooldownDays;

    if (!cooldownDays || cooldownDays <= 0) {
      return true;
    }

    // Check user's last application date via API
    const response = await axios.get(`${API_BASE_URL}/v2/recruitment/my-applications`, {
      params: { limit: 1, sort: 'appliedAt', order: 'desc' },
      headers: {
        'X-Discord-User-Id': userId,
        'X-Discord-Guild-Id': guildId,
      },
    });

    const applications = response.data.data || [];
    if (applications.length === 0) {
      return true;
    }

    const lastApplied = new Date(applications[0].appliedAt || applications[0].createdAt);
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    return Date.now() - lastApplied.getTime() >= cooldownMs;
  } catch {
    // Fail open — allow apply if check fails
    return true;
  }
}

/* ── Multiple-choice pre-modal select menu ──────────────────────────── */

async function _shouldShowPreModalSelect(
  guildId: string,
  _recruitmentId: string
): Promise<boolean> {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettingsByGuildId(guildId);
    // Check if recruitment settings define preferred roles / multiple-choice
    const roles = settings?.[0]?.recruitmentSettings as Record<string, unknown> | undefined;
    return !!(
      roles &&
      Array.isArray((roles as { preferredRoles?: string[] }).preferredRoles) &&
      ((roles as { preferredRoles?: string[] }).preferredRoles?.length ?? 0) > 0
    );
  } catch {
    return false;
  }
}

async function _showPreModalSelectMenu(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  recruitmentId: string
): Promise<void> {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
    const roles =
      (
        settings?.[0]?.recruitmentSettings as Record<string, unknown> & {
          preferredRoles?: string[];
        }
      )?.preferredRoles || [];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`recruitment_premodal_${recruitmentId}`)
      .setPlaceholder('Select your preferred role')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        roles.slice(0, 25).map((role: string) => ({
          label: role,
          value: role.toLowerCase().replace(/\s+/g, '_'),
          description: `Apply as ${role}`,
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content:
          '🎯 **Step 1 of 2:** Select your preferred role, then fill out the application form.',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content:
          '🎯 **Step 1 of 2:** Select your preferred role, then fill out the application form.',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    logger.error('Failed to show pre-modal select:', error);
    // Fallback: show modal directly
    const modal = buildPanelModal(
      `recruitment_apply_modal_${recruitmentId}`,
      '📋 Recruitment Application',
      APPLICATION_MODAL_FIELDS
    );
    if ('showModal' in interaction) {
      await interaction.showModal(modal);
    }
  }
}
