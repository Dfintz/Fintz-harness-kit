/**
 * Event Edit Wizard ΓÇö category-button driven editing of an existing activity.
 *
 * Mirrors the UX of `eventCreationWizard.ts` but populates from an existing
 * activity and persists via `ActivityService.updateActivity`. This sidesteps
 * Discord's 5-input modal limit by breaking the edit surface into per-field
 * modals launched from a panel of buttons.
 *
 * Flow:
 * 1. User clicks "Edit" on an event embed ΓåÆ wizard panel (ephemeral) appears.
 * 2. User clicks a field button ΓåÆ focused modal pre-filled with current value.
 * 3. Submitting the modal updates the in-memory session and refreshes the panel.
 * 4. User clicks "Save Changes" ΓåÆ persists via ActivityService and refreshes
 *    the original event embed in the channel.
 *
 * Sessions are keyed by `{guildId}:{userId}:{activityId}` so a user can edit
 * multiple events independently. Sessions expire after 15 minutes of inactivity.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { ActivityParticipantService, ActivityService } from '../../services/activity';
import { UserService } from '../../services/user/UserService';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { buildEventComponentRows, buildEventEmbed } from '../embeds/eventEmbed';
import { publishMirrorRefresh } from '../mirrorSyncPublisher';
import { WizardSessionStore } from '../utils/wizardSessionStore';

import {
  buildEmbedDataFromActivity,
  collectUserIdsForEmbed,
  resolveDiscordIdMap,
} from './eventButtons';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SESSION_TTL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 200;
const MAX_REQUIREMENTS_LENGTH = 500;

const CUSTOM_ID_PREFIX = 'event_edw_';

/* ------------------------------------------------------------------ */
/*  Session state                                                      */
/* ------------------------------------------------------------------ */

interface EditSessionState {
  activityId: string;
  guildId: string;
  channelId: string;
  /** The Discord message that carries the public event embed (to refresh on save). */
  embedMessageId?: string;
  userId: string;
  userName: string;

  title?: string;
  description?: string;
  location?: string;
  scheduledStartDate?: Date;
  scheduledEndDate?: Date;
  estimatedDuration?: number;
  maxParticipants?: number;
  requirements?: string;
  recurrencePattern?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceEndDate?: Date;

  /** Existing metadata so we can merge rather than overwrite on save. */
  baseMetadata: Record<string, unknown>;

  lastInteraction: number;
}

const sessions = new WizardSessionStore<EditSessionState>({
  ttlMs: SESSION_TTL_MS,
  cleanupIntervalMs: CLEANUP_INTERVAL_MS,
  keyFactory: (guildId: string, userId: string, activityId: string) =>
    `${guildId}:${userId}:${activityId}`,
  getLastInteraction: session => session.lastInteraction,
  touch: (session, now) => {
    session.lastInteraction = now;
  },
});

function sessionKey(guildId: string, userId: string, activityId: string): string {
  return sessions.makeKey(guildId, userId, activityId);
}

/* ------------------------------------------------------------------ */
/*  Lazy services                                                      */
/* ------------------------------------------------------------------ */

let _activityService: ActivityService | null = null;
function getActivityService(): ActivityService {
  _activityService ??= new ActivityService();
  return _activityService;
}

let _participantService: ActivityParticipantService | null = null;
function getParticipantService(): ActivityParticipantService {
  _participantService ??= new ActivityParticipantService();
  return _participantService;
}

let _userService: UserService | null = null;
function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function sanitizeText(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

function formatDateForInput(d?: Date | string | null): string {
  if (!d) {
    return '';
  }
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function parseDateInput(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}:00Z`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Format a Date as a UTC `YYYY-MM-DD` string (empty for nullish/invalid). */
function formatDateOnly(d?: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) {
    return '';
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const RECURRENCE_CHOICES = ['none', 'daily', 'weekly', 'monthly'] as const;
type RecurrenceChoice = (typeof RECURRENCE_CHOICES)[number];

/**
 * Validate and normalize the recurrence modal inputs (pure ΓÇö unit tested).
 *
 * Pattern is case-insensitive and defaults to `none` when empty. An end date is
 * only meaningful for a recurring pattern; it is parsed as a UTC date
 * (`YYYY-MM-DD` or `YYYY-MM-DD HH:mm`) and cleared for `none`/empty input.
 */
export function normalizeRecurrenceInput(
  patternRaw: string,
  endRaw: string
): { ok: true; pattern: RecurrenceChoice; endDate?: Date } | { ok: false; error: string } {
  const pattern = patternRaw.trim().toLowerCase();
  if (pattern && !RECURRENCE_CHOICES.includes(pattern as RecurrenceChoice)) {
    return { ok: false, error: 'Repeat must be none, daily, weekly, or monthly.' };
  }
  const normalized = (pattern || 'none') as RecurrenceChoice;
  if (normalized === 'none') {
    return { ok: true, pattern: 'none' };
  }
  const endTrimmed = endRaw.trim();
  if (!endTrimmed) {
    return { ok: true, pattern: normalized };
  }
  const endDate = parseDateInput(endTrimmed);
  if (!endDate) {
    return { ok: false, error: 'Invalid end date. Use `YYYY-MM-DD` (UTC).' };
  }
  return { ok: true, pattern: normalized, endDate };
}

function getSession(
  guildId: string | null,
  userId: string,
  activityId: string
): EditSessionState | null {
  if (!guildId) {
    return null;
  }
  const key = sessionKey(guildId, userId, activityId);
  return sessions.get(key);
}

async function resolveInternalUserId(discordId: string): Promise<string | null> {
  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Custom-id parsing                                                  */
/* ------------------------------------------------------------------ */

/** All wizard custom ids follow `event_edw_<kind>_<field>_<activityId>` or
 * `event_edw_<field>_<activityId>` for plain buttons. */
function parseCustomId(
  customId: string
): { kind: 'button' | 'modal' | 'select'; field: string; activityId: string } | null {
  if (!customId.startsWith(CUSTOM_ID_PREFIX)) {
    return null;
  }
  const rest = customId.slice(CUSTOM_ID_PREFIX.length);
  // forms: `modal_<field>_<id>` | `select_<field>_<id>` | `<field>_<id>`
  const modalMatch = /^modal_([a-z]+)_(.+)$/.exec(rest);
  if (modalMatch) {
    return { kind: 'modal', field: modalMatch[1], activityId: modalMatch[2] };
  }
  const selectMatch = /^select_([a-z]+)_(.+)$/.exec(rest);
  if (selectMatch) {
    return { kind: 'select', field: selectMatch[1], activityId: selectMatch[2] };
  }
  const buttonMatch = /^([a-z]+)_(.+)$/.exec(rest);
  if (buttonMatch) {
    return { kind: 'button', field: buttonMatch[1], activityId: buttonMatch[2] };
  }
  return null;
}

export function isEditWizardButtonId(customId: string): boolean {
  if (!customId.startsWith(CUSTOM_ID_PREFIX)) {
    return false;
  }
  const rest = customId.slice(CUSTOM_ID_PREFIX.length);
  return !rest.startsWith('modal_') && !rest.startsWith('select_');
}

export function isEditWizardModalId(customId: string): boolean {
  return customId.startsWith(`${CUSTOM_ID_PREFIX}modal_`);
}

/* ------------------------------------------------------------------ */
/*  Embed + buttons                                                    */
/* ------------------------------------------------------------------ */

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'None',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function buildEditEmbed(session: EditSessionState): EmbedBuilder {
  const check = (v: unknown): string =>
    v !== undefined && v !== null && v !== '' ? 'Γ£Å∩╕Å' : 'Γ¼¢';

  const startStr = session.scheduledStartDate
    ? `<t:${Math.floor(session.scheduledStartDate.getTime() / 1000)}:F>`
    : '_not set_';
  const endStr = session.scheduledEndDate
    ? `<t:${Math.floor(session.scheduledEndDate.getTime() / 1000)}:F>`
    : '_not set_';
  const durStr = session.estimatedDuration ? `${session.estimatedDuration} min` : '_not set_';
  const recStr = session.recurrencePattern
    ? `${RECURRENCE_LABELS[session.recurrencePattern] ?? session.recurrencePattern}${
        session.recurrenceEndDate
          ? ` (until <t:${Math.floor(session.recurrenceEndDate.getTime() / 1000)}:d>)`
          : ''
      }`
    : '_none_';

  const lines = [
    `${check(session.title)} **Title** ΓÇö ${session.title ?? '_not set_'}`,
    `${check(session.description)} **Description** ΓÇö ${session.description ? `${session.description.slice(0, 80)}${session.description.length > 80 ? 'ΓÇª' : ''}` : '_not set_'}`,
    `${check(session.location)} **Location** ΓÇö ${session.location ?? '_not set_'}`,
    `${check(session.scheduledStartDate)} **Starts** ΓÇö ${startStr}`,
    `${check(session.scheduledEndDate)} **Ends** ΓÇö ${endStr}`,
    `${check(session.estimatedDuration)} **Duration** ΓÇö ${durStr}`,
    `${check(session.maxParticipants)} **Max Participants** ΓÇö ${session.maxParticipants ?? '_unlimited_'}`,
    `${check(session.requirements)} **Requirements** ΓÇö ${session.requirements ? `${session.requirements.slice(0, 80)}${session.requirements.length > 80 ? 'ΓÇª' : ''}` : '_none_'}`,
    `${check(session.recurrencePattern && session.recurrencePattern !== 'none')} **Recurrence** ΓÇö ${recStr}`,
  ];

  return new EmbedBuilder()
    .setColor(0xfaa61a)
    .setTitle('Γ£Å∩╕Å Edit Event')
    .setDescription(
      `Click a field to edit it, then **Save Changes** to apply.\n\n${lines.join('\n')}`
    )
    .setFooter({ text: 'Session expires after 15 minutes of inactivity' })
    .setTimestamp();
}

function buildEditButtons(activityId: string): ActionRowBuilder<ButtonBuilder>[] {
  const mk = (field: string, label: string, style = ButtonStyle.Secondary): ButtonBuilder =>
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID_PREFIX}${field}_${activityId}`)
      .setLabel(label)
      .setStyle(style);

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mk('title', '≡ƒô¥ Title'),
    mk('desc', '≡ƒôä Description'),
    mk('location', '≡ƒôì Location'),
    mk('start', '≡ƒòÆ Start')
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mk('end', '≡ƒÅü End'),
    mk('duration', 'ΓÅ▒∩╕Å Duration'),
    mk('max', '≡ƒæÑ Max Players'),
    mk('reqs', '≡ƒôï Requirements')
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(mk('recur', '≡ƒöü Recurrence'));
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mk('save', '≡ƒÆ╛ Save Changes', ButtonStyle.Success),
    mk('cancel', 'Γ£û∩╕Å Cancel', ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4];
}

/* ------------------------------------------------------------------ */
/*  Launch                                                             */
/* ------------------------------------------------------------------ */

export async function launchEventEditWizard(
  interaction: ButtonInteraction,
  activityId: string
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'Γ¥î This can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const activity = await getActivityService().getActivityById(activityId);
  if (!activity) {
    await interaction.reply({
      content: 'ΓÜá∩╕Å Activity no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Verify creator
  const internalUserId = await resolveInternalUserId(interaction.user.id);
  if (activity.creatorId !== internalUserId && activity.creatorId !== interaction.user.id) {
    await interaction.reply({
      content: 'Γ¥î Only the event creator can edit this event.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const status = (activity.status ?? '').toLowerCase();
  if (status === 'cancelled' || status === 'completed') {
    await interaction.reply({
      content: `ΓÜá∩╕Å Cannot edit a ${status} event.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const baseMetadata = (activity.metadata ?? {}) as Record<string, unknown>;
  const recurrencePattern = baseMetadata.recurrencePattern as
    'none' | 'daily' | 'weekly' | 'monthly' | undefined;
  const recurrenceEndDateRaw = baseMetadata.recurrenceEndDate;
  const recurrenceEndDate =
    recurrenceEndDateRaw instanceof Date
      ? recurrenceEndDateRaw
      : typeof recurrenceEndDateRaw === 'string'
        ? new Date(recurrenceEndDateRaw)
        : undefined;

  const session: EditSessionState = {
    activityId,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    embedMessageId: interaction.message?.id,
    userId: interaction.user.id,
    userName: interaction.user.username,

    title: activity.title ?? undefined,
    description: activity.description ?? undefined,
    location: activity.location ?? undefined,
    scheduledStartDate: activity.scheduledStartDate ?? undefined,
    scheduledEndDate: activity.scheduledEndDate ?? undefined,
    estimatedDuration: activity.estimatedDuration ?? undefined,
    maxParticipants: activity.maxParticipants ?? undefined,
    requirements:
      typeof activity.requirements === 'string'
        ? activity.requirements
        : activity.requirements
          ? JSON.stringify(activity.requirements)
          : undefined,
    recurrencePattern,
    recurrenceEndDate:
      recurrenceEndDate && !Number.isNaN(recurrenceEndDate.getTime())
        ? recurrenceEndDate
        : undefined,
    baseMetadata,
    lastInteraction: Date.now(),
  };

  sessions.set(sessionKey(interaction.guildId, interaction.user.id, activityId), session);

  await interaction.reply({
    embeds: [buildEditEmbed(session)],
    components: buildEditButtons(activityId),
    flags: MessageFlags.Ephemeral,
  });
}

/* ------------------------------------------------------------------ */
/*  Button handler                                                     */
/* ------------------------------------------------------------------ */

export async function handleEditWizardButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed?.kind !== 'button') {
    return;
  }

  const { field, activityId } = parsed;
  const session = getSession(interaction.guildId, interaction.user.id, activityId);
  if (!session) {
    await interaction.reply({
      content: 'ΓÜá∩╕Å Your edit session has expired. Click **Edit** again to start over.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (field) {
    case 'title':
      return showTextModal(interaction, activityId, 'title', 'Edit Title', 'Title', session.title, {
        style: TextInputStyle.Short,
        required: true,
        maxLength: MAX_TITLE_LENGTH,
        minLength: 3,
      });
    case 'desc':
      return showTextModal(
        interaction,
        activityId,
        'desc',
        'Edit Description',
        'Description',
        session.description,
        { style: TextInputStyle.Paragraph, maxLength: MAX_DESCRIPTION_LENGTH }
      );
    case 'location':
      return showTextModal(
        interaction,
        activityId,
        'location',
        'Edit Location',
        'Location',
        session.location,
        { style: TextInputStyle.Short, maxLength: MAX_LOCATION_LENGTH }
      );
    case 'start':
      return showDateTimeModal(
        interaction,
        activityId,
        'start',
        'Edit Start Time',
        session.scheduledStartDate
      );
    case 'end':
      return showDateTimeModal(
        interaction,
        activityId,
        'end',
        'Edit End Time',
        session.scheduledEndDate
      );
    case 'duration':
      return showNumberModal(
        interaction,
        activityId,
        'duration',
        'Edit Duration',
        'Duration in minutes (1-1440)',
        session.estimatedDuration
      );
    case 'max':
      return showNumberModal(
        interaction,
        activityId,
        'max',
        'Edit Max Participants',
        'Max participants (1-100, empty = unlimited)',
        session.maxParticipants,
        false
      );
    case 'reqs':
      return showTextModal(
        interaction,
        activityId,
        'reqs',
        'Edit Requirements',
        'Requirements (free text)',
        session.requirements,
        { style: TextInputStyle.Paragraph, maxLength: MAX_REQUIREMENTS_LENGTH }
      );
    case 'recur':
      return showRecurrenceModal(interaction, activityId, session);
    case 'save':
      return handleSave(interaction, session);
    case 'cancel':
      return handleCancel(interaction, session);
    default:
      await interaction.reply({
        content: 'Γ¥î Unknown edit action.',
        flags: MessageFlags.Ephemeral,
      });
  }
}

/* ------------------------------------------------------------------ */
/*  Modal builders                                                     */
/* ------------------------------------------------------------------ */

interface TextModalOptions {
  style: TextInputStyle;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
}

async function showTextModal(
  interaction: ButtonInteraction,
  activityId: string,
  field: string,
  title: string,
  label: string,
  currentValue: string | undefined,
  options: TextModalOptions
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
    .setStyle(options.style)
    .setRequired(options.required ?? false);

  if (options.maxLength) {
    input.setMaxLength(options.maxLength);
  }
  if (options.minLength) {
    input.setMinLength(options.minLength);
  }
  if (currentValue) {
    input.setValue(currentValue);
  }

  modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
  await interaction.showModal(modal);
}

async function showNumberModal(
  interaction: ButtonInteraction,
  activityId: string,
  field: string,
  title: string,
  label: string,
  currentValue: number | undefined,
  required = true
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(required)
    .setMaxLength(4);

  if (currentValue !== undefined) {
    input.setValue(String(currentValue));
  }

  modal.addLabelComponents(new LabelBuilder().setLabel(label).setTextInputComponent(input));
  await interaction.showModal(modal);
}

async function showDateTimeModal(
  interaction: ButtonInteraction,
  activityId: string,
  field: string,
  title: string,
  currentValue: Date | undefined
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}modal_${field}_${activityId}`)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}input_${field}`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(16)
    .setPlaceholder('2026-05-25 19:30');

  if (currentValue) {
    input.setValue(formatDateForInput(currentValue));
  }

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('UTC: YYYY-MM-DD HH:mm (empty to clear)')
      .setTextInputComponent(input)
  );
  await interaction.showModal(modal);
}

async function showRecurrenceModal(
  interaction: ButtonInteraction,
  activityId: string,
  session: EditSessionState
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}modal_recur_${activityId}`)
    .setTitle('Edit Recurrence');

  const patternInput = new TextInputBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}input_recur`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(7)
    .setPlaceholder('none')
    .setValue(session.recurrencePattern ?? 'none');

  const endInput = new TextInputBuilder()
    .setCustomId(`${CUSTOM_ID_PREFIX}input_recurend`)
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(16)
    .setPlaceholder('2026-12-31');

  const existingEnd = formatDateOnly(session.recurrenceEndDate);
  if (existingEnd) {
    endInput.setValue(existingEnd);
  }

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('Repeat: none, daily, weekly, or monthly')
      .setTextInputComponent(patternInput),
    new LabelBuilder()
      .setLabel('Repeat until (UTC YYYY-MM-DD, optional)')
      .setTextInputComponent(endInput)
  );
  await interaction.showModal(modal);
}

/* ------------------------------------------------------------------ */
/*  Modal handler                                                      */
/* ------------------------------------------------------------------ */

export async function handleEditWizardModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (parsed?.kind !== 'modal') {
    return;
  }

  const { field, activityId } = parsed;
  const session = getSession(interaction.guildId, interaction.user.id, activityId);
  if (!session) {
    await interaction.reply({
      content: 'ΓÜá∩╕Å Your edit session has expired. Click **Edit** again to start over.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const raw = interaction.fields.getTextInputValue(`${CUSTOM_ID_PREFIX}input_${field}`).trim();

  switch (field) {
    case 'title': {
      if (!raw) {
        await interaction.reply({
          content: 'Γ¥î Title is required.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.title = sanitizeText(raw, MAX_TITLE_LENGTH);
      break;
    }
    case 'desc':
      session.description = raw ? sanitizeText(raw, MAX_DESCRIPTION_LENGTH) : undefined;
      break;
    case 'location':
      session.location = raw ? sanitizeText(raw, MAX_LOCATION_LENGTH) : undefined;
      break;
    case 'reqs':
      session.requirements = raw ? sanitizeText(raw, MAX_REQUIREMENTS_LENGTH) : undefined;
      break;
    case 'start': {
      if (!raw) {
        session.scheduledStartDate = undefined;
        break;
      }
      const parsedDate = parseDateInput(raw);
      if (!parsedDate) {
        await interaction.reply({
          content: 'Γ¥î Invalid date. Use `YYYY-MM-DD HH:mm` in UTC.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.scheduledStartDate = parsedDate;
      break;
    }
    case 'end': {
      if (!raw) {
        session.scheduledEndDate = undefined;
        break;
      }
      const parsedDate = parseDateInput(raw);
      if (!parsedDate) {
        await interaction.reply({
          content: 'Γ¥î Invalid date. Use `YYYY-MM-DD HH:mm` in UTC.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.scheduledEndDate = parsedDate;
      break;
    }
    case 'duration': {
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n) || n < 1 || n > 1440) {
        await interaction.reply({
          content: 'Γ¥î Duration must be between 1 and 1440 minutes.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.estimatedDuration = n;
      break;
    }
    case 'max': {
      if (!raw) {
        session.maxParticipants = undefined;
        break;
      }
      const n = Number.parseInt(raw, 10);
      if (Number.isNaN(n) || n < 1 || n > 100) {
        await interaction.reply({
          content: 'Γ¥î Max participants must be between 1 and 100.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.maxParticipants = n;
      break;
    }
    case 'recur': {
      const endRaw = interaction.fields
        .getTextInputValue(`${CUSTOM_ID_PREFIX}input_recurend`)
        .trim();
      const result = normalizeRecurrenceInput(raw, endRaw);
      if (!result.ok) {
        await interaction.reply({
          content: `Γ¥î ${result.error}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      session.recurrencePattern = result.pattern;
      session.recurrenceEndDate = result.endDate;
      break;
    }
    default:
      await interaction.reply({
        content: 'Γ¥î Unknown field.',
        flags: MessageFlags.Ephemeral,
      });
      return;
  }

  await refreshPanel(interaction, session);
}

/* ------------------------------------------------------------------ */
/*  Refresh / save / cancel                                            */
/* ------------------------------------------------------------------ */

async function refreshPanel(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  session: EditSessionState
): Promise<void> {
  const embed = buildEditEmbed(session);
  const buttons = buildEditButtons(session.activityId);

  if (interaction.isModalSubmit()) {
    await interaction.deferUpdate();
    await interaction.editReply({ embeds: [embed], components: buttons });
  } else {
    await interaction.update({ embeds: [embed], components: buttons });
  }
}

async function handleCancel(
  interaction: ButtonInteraction,
  session: EditSessionState
): Promise<void> {
  sessions.delete(sessionKey(session.guildId, session.userId, session.activityId));
  await interaction.update({
    content: 'Γ£û∩╕Å Edit cancelled. No changes saved.',
    embeds: [],
    components: [],
  });
}

async function handleSave(
  interaction: ButtonInteraction,
  session: EditSessionState
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const mergedMetadata: Record<string, unknown> = {
      ...session.baseMetadata,
    };
    if (session.recurrencePattern !== undefined) {
      mergedMetadata.recurrencePattern = session.recurrencePattern;
    }
    if (session.recurrenceEndDate !== undefined) {
      mergedMetadata.recurrenceEndDate = session.recurrenceEndDate;
    } else if (session.recurrencePattern === 'none') {
      delete mergedMetadata.recurrenceEndDate;
    }

    const updates: Record<string, unknown> = {
      title: session.title,
      description: session.description ?? null,
      location: session.location ?? null,
      scheduledStartDate: session.scheduledStartDate ?? null,
      scheduledEndDate: session.scheduledEndDate ?? null,
      estimatedDuration: session.estimatedDuration ?? null,
      maxParticipants: session.maxParticipants ?? null,
      requirements: session.requirements ?? null,
      metadata: mergedMetadata,
    };

    await getActivityService().updateActivity(session.activityId, updates);

    sessions.delete(sessionKey(session.guildId, session.userId, session.activityId));

    await interaction.editReply({
      content: 'Γ£à Event updated successfully.',
      embeds: [],
      components: [],
    });

    // Best-effort: refresh the original event embed in the channel.
    await refreshEventEmbed(interaction, session);

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: session.userId,
      username: session.userName,
      resource: `discord/guild/${session.guildId}/channel/${session.channelId}`,
      action: 'EVENT_EDIT',
      message: `User edited event via wizard: ${session.activityId}`,
      metadata: { activityId: session.activityId, action: 'edit' },
    });
  } catch (error: unknown) {
    logger.error(
      'Failed to save event edit',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.editReply({
      content: `Γ¥î Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
      embeds: [],
      components: [],
    });
  }
}

async function refreshEventEmbed(
  interaction: ButtonInteraction,
  session: EditSessionState
): Promise<void> {
  try {
    const updated = await getActivityService().getActivityById(session.activityId);
    if (!updated || !session.embedMessageId || !interaction.guild) {
      return;
    }

    const channel = interaction.guild.channels.cache.get(session.channelId);
    if (!channel || !('messages' in channel)) {
      return;
    }

    const message = await channel.messages.fetch(session.embedMessageId).catch(() => null);
    if (!message) {
      return;
    }

    const participants = await getParticipantService().getParticipants(session.activityId);
    const discordIdMap = await resolveDiscordIdMap(collectUserIdsForEmbed(updated, participants));
    const embedData = buildEmbedDataFromActivity(updated, participants, discordIdMap);

    const isActive = !['cancelled', 'completed'].includes((updated.status ?? '').toLowerCase());
    const components = buildEventComponentRows(session.activityId, { includeManage: isActive });

    await message.edit({ embeds: [buildEventEmbed(embedData)], components });

    // Propagate to mirrored events so they re-render with the latest state.
    publishMirrorRefresh(session.activityId, session.userId);
  } catch (err) {
    logger.debug('Failed to refresh event embed after wizard save', {
      activityId: session.activityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
