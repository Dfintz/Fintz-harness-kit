/**
 * Event Creation Wizard ΓÇö Raid-Helper style interactive event creation.
 *
 * Flow:
 * 1. User runs `/events create` ΓåÆ ephemeral wizard embed with numbered options
 * 2. User clicks buttons to configure each option (opens modals / select menus)
 * 3. User clicks "Finish" to create the event and post the RSVP embed
 *
 * State is held in-memory per user, keyed by `{guildId}:{userId}`.
 * Sessions expire after 15 minutes of inactivity.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  LabelBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { ActivityType } from '../../models/Activity';
import { ActivityParticipantService, ActivityService } from '../../services/activity';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { UserService } from '../../services/user/UserService';
import { logger } from '../../utils/logger';
import { buildEventComponentRows, buildEventEmbed, EventEmbedData } from '../embeds/eventEmbed';
import {
  ACTIVITY_TYPE_LABELS,
  buildEventDifficultySelect,
  buildEventTypeSelect,
} from '../utils/sharedChoices';
import { WizardSessionStore } from '../utils/wizardSessionStore';
import { createEventTempVoiceChannel } from '../voice/voiceAutoCreate';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Wizard sessions expire after 15 minutes of inactivity. */
const SESSION_TTL_MS = 15 * 60 * 1000;

/** Max length for user-provided strings in wizard fields. */
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_LOCATION_LENGTH = 200;
const MAX_REQUIREMENTS_LENGTH = 500;

/** Cleanup interval for expired sessions (every 5 minutes). */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

type VoiceChannelMode = 'none' | 'current' | 'temp';

/* ------------------------------------------------------------------ */
/*  Wizard Session State                                               */
/* ------------------------------------------------------------------ */

export interface WizardSessionState {
  /** Title of the event. */
  title?: string;
  /** Description text. */
  description?: string;
  /** Activity type. */
  activityType: ActivityType;
  /** Scheduled start date/time. */
  scheduledStartDate?: Date;
  /** Duration in minutes. */
  estimatedDuration?: number;
  /** Location text. */
  location?: string;
  /** Difficulty level. */
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  /** Max participants. */
  maxParticipants?: number;
  /** Voice channel mode for the created event. */
  voiceChannelMode: VoiceChannelMode;
  /** Voice channel user limit. */
  voiceChannelLimit?: number;
  /** Free-text requirements. */
  requirements?: string;
  /** Guild ID. */
  guildId: string;
  /** Channel ID where the wizard was started. */
  channelId: string;
  /** User ID of the creator. */
  userId: string;
  /** Username of the creator. */
  userName: string;
  /** Last interaction timestamp for TTL management. */
  lastInteraction: number;
}

type WizardLaunchInteraction = ButtonInteraction | ChatInputCommandInteraction;

/** Active wizard sessions, keyed by `{guildId}:{userId}`. */
const wizardSessions = new WizardSessionStore<WizardSessionState>({
  ttlMs: SESSION_TTL_MS,
  cleanupIntervalMs: CLEANUP_INTERVAL_MS,
  keyFactory: (guildId: string, userId: string) => `${guildId}:${userId}`,
  getLastInteraction: session => session.lastInteraction,
  touch: (session, now) => {
    session.lastInteraction = now;
  },
});

function sessionKey(guildId: string, userId: string): string {
  return wizardSessions.makeKey(guildId, userId);
}

function getActiveSessionForLaunch(key: string): WizardSessionState | null {
  return wizardSessions.get(key);
}

function prepareWizardSession(
  interaction: WizardLaunchInteraction,
  guildId: string
): {
  session: WizardSessionState;
  isResumed: boolean;
} {
  const key = sessionKey(guildId, interaction.user.id);
  const existingSession = getActiveSessionForLaunch(key);

  const session: WizardSessionState = existingSession ?? {
    activityType: ActivityType.EVENT,
    voiceChannelMode: 'none',
    guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    userName: interaction.user.username,
    lastInteraction: Date.now(),
  };

  wizardSessions.set(key, session);
  return { session, isResumed: existingSession !== null };
}

async function ensureEventCreationAllowed(
  interaction: WizardLaunchInteraction,
  guildId: string
): Promise<boolean> {
  if (!interaction.member || !('roles' in interaction.member)) {
    return true;
  }

  try {
    const { discordSettingsService } =
      await import('../../services/discord/DiscordSettingsService');
    const orgId = await getGuildOrgService().resolveOrganization(guildId);
    const guildSettings = orgId ? await discordSettingsService.getSettings(orgId, guildId) : null;
    const eventConfig = guildSettings?.eventSettings;

    if (!eventConfig?.bannedRoleIds?.length) {
      return true;
    }

    const memberRoles = new Set(
      Array.isArray(interaction.member.roles)
        ? interaction.member.roles
        : [...(interaction.member.roles as { cache: Map<string, unknown> }).cache.keys()]
    );
    const hasBanned = eventConfig.bannedRoleIds.some((roleId: string) => memberRoles.has(roleId));

    if (hasBanned) {
      await interaction.reply({
        content: 'Γ¥î You do not have permission to create events.',
        flags: MessageFlags.Ephemeral,
      });
      return false;
    }
  } catch {
    // Non-fatal ΓÇö continue without role check
  }

  return true;
}

/* ------------------------------------------------------------------ */
/*  Lazy services                                                      */
/* ------------------------------------------------------------------ */

let _activityService: ActivityService | null = null;
function getActivityService(): ActivityService {
  _activityService ??= new ActivityService();
  return _activityService;
}

let _guildOrgService: GuildOrganizationService | null = null;
function getGuildOrgService(): GuildOrganizationService {
  _guildOrgService ??= GuildOrganizationService.getInstance();
  return _guildOrgService;
}

let _userService: UserService | null = null;
function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

let _participantService: ActivityParticipantService | null = null;
function getParticipantService(): ActivityParticipantService {
  _participantService ??= new ActivityParticipantService();
  return _participantService;
}

/* ------------------------------------------------------------------ */
/*  Sanitize helpers                                                   */
/* ------------------------------------------------------------------ */

function sanitizeText(input: string, maxLength: number): string {
  return input.trim().slice(0, maxLength);
}

/* ------------------------------------------------------------------ */
/*  Activity Type display helpers                                      */
/* ------------------------------------------------------------------ */

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '≡ƒƒó Easy',
  medium: '≡ƒƒí Medium',
  hard: '≡ƒƒá Hard',
  expert: '≡ƒö┤ Expert',
};

const VOICE_MODE_LABELS: Record<VoiceChannelMode, string> = {
  none: 'Disabled',
  current: 'Use Current Channel',
  temp: 'Create Temporary Channel',
};

function buildDescriptionField(description: string): {
  name: string;
  value: string;
  inline: boolean;
} {
  const value = description.length > 100 ? `${description.slice(0, 97)}...` : description;
  return { name: 'Description', value, inline: true };
}

function buildDurationField(durationMinutes: number): {
  name: string;
  value: string;
  inline: boolean;
} {
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const value = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  return { name: 'Duration', value, inline: true };
}

function buildVoiceField(session: WizardSessionState): {
  name: string;
  value: string;
  inline: boolean;
} | null {
  if (session.voiceChannelMode === 'none') {
    return null;
  }

  let limitSuffix = '';
  if (session.voiceChannelMode === 'temp') {
    limitSuffix = session.voiceChannelLimit
      ? ` (${session.voiceChannelLimit} user limit)`
      : ' (unlimited)';
  }

  return {
    name: 'Voice Channel',
    value: `${VOICE_MODE_LABELS[session.voiceChannelMode]}${limitSuffix}`,
    inline: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Build the Wizard Embed                                             */
/* ------------------------------------------------------------------ */

function buildWizardFields(
  session: WizardSessionState
): Array<{ name: string; value: string; inline: boolean }> {
  const typeInfo = ACTIVITY_TYPE_LABELS[session.activityType] ?? { emoji: '≡ƒôà', label: 'Event' };
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  if (session.title) {
    fields.push({ name: 'Title', value: session.title, inline: true });
  }
  if (session.description) {
    fields.push(buildDescriptionField(session.description));
  }
  fields.push({ name: 'Type', value: `${typeInfo.emoji} ${typeInfo.label}`, inline: true });
  if (session.scheduledStartDate) {
    const ts = Math.floor(session.scheduledStartDate.getTime() / 1000);
    fields.push({ name: 'Date & Time', value: `<t:${ts}:F> (<t:${ts}:R>)`, inline: true });
  }
  if (session.estimatedDuration) {
    fields.push(buildDurationField(session.estimatedDuration));
  }
  if (session.location) {
    fields.push({ name: 'Location', value: session.location, inline: true });
  }
  if (session.difficulty) {
    fields.push({
      name: 'Difficulty',
      value: DIFFICULTY_LABELS[session.difficulty] ?? session.difficulty,
      inline: true,
    });
  }
  if (session.maxParticipants) {
    fields.push({ name: 'Max Participants', value: String(session.maxParticipants), inline: true });
  }
  const voiceField = buildVoiceField(session);
  if (voiceField) {
    fields.push(voiceField);
  }
  if (session.requirements) {
    fields.push({ name: 'Requirements', value: session.requirements, inline: false });
  }

  return fields;
}

function buildWizardEmbed(session: WizardSessionState): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2) // Discord blurple
    .setTitle('Select an option or finish the event creation.')
    .setDescription(buildWizardStatusText(session))
    .setFooter({ text: 'Session expires after 15 minutes of inactivity' })
    .setTimestamp();

  const fields = buildWizardFields(session);
  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

function buildWizardStatusText(session: WizardSessionState): string {
  const check = (val: unknown): string => (val ? 'Γ£à' : 'Γ¼¢');

  const lines = [
    `01 ${check(session.title)}  **Title**`,
    `02 ${check(session.description)}  **Description**`,
    `03 ${check(true)}  **Type** ΓÇö ${(ACTIVITY_TYPE_LABELS[session.activityType] ?? { label: 'Event' }).label}`,
    `04 ${check(session.scheduledStartDate)}  **Date & Time**`,
    `05 ${check(session.estimatedDuration)}  **Duration**`,
    `06 ${check(session.location)}  **Location**`,
    `07 ${check(session.difficulty)}  **Difficulty**`,
    `08 ${check(session.maxParticipants)}  **Max Participants**`,
    `09 ${check(session.voiceChannelMode !== 'none')}  **Voice Channel** ΓÇö ${VOICE_MODE_LABELS[session.voiceChannelMode]}`,
    `10 ${check(session.requirements)}  **Requirements**`,
  ];

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Build the Wizard Buttons                                           */
/* ------------------------------------------------------------------ */

function buildWizardButtons(): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1: Title, Description, Type, Date & Time
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('event_wiz_title')
      .setLabel('01 Title')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_description')
      .setLabel('02 Description')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_type')
      .setLabel('03 Type')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_datetime')
      .setLabel('04 Date & Time')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 2: Duration, Location, Difficulty, Max Participants
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('event_wiz_duration')
      .setLabel('05 Duration')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_location')
      .setLabel('06 Location')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_difficulty')
      .setLabel('07 Difficulty')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_maxplayers')
      .setLabel('08 Max Players')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 3: Voice Channel, Requirements
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('event_wiz_voice')
      .setLabel('09 Voice')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('event_wiz_requirements')
      .setLabel('10 Requirements')
      .setStyle(ButtonStyle.Secondary)
  );

  // Row 4: Finish / Cancel
  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('event_wiz_finish')
      .setLabel('Finish')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('event_wiz_cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3, row4];
}

/* ------------------------------------------------------------------ */
/*  Launch the Wizard                                                  */
/* ------------------------------------------------------------------ */

export async function launchEventCreationWizard(
  interaction: WizardLaunchInteraction
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'Γ¥î This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await ensureEventCreationAllowed(interaction, guildId))) {
    return;
  }

  const { session, isResumed } = prepareWizardSession(interaction, guildId);

  const embed = buildWizardEmbed(session);
  const buttons = buildWizardButtons();

  await interaction.reply({
    content: isResumed ? 'Γå⌐∩╕Å Resumed your existing event draft.' : undefined,
    embeds: [embed],
    components: buttons,
    flags: MessageFlags.Ephemeral,
  });
}

/* ------------------------------------------------------------------ */
/*  Session lookup helper                                              */
/* ------------------------------------------------------------------ */

function getSession(guildId: string | null, userId: string): WizardSessionState | null {
  if (!guildId) {
    return null;
  }
  const key = sessionKey(guildId, userId);
  return wizardSessions.get(key);
}

/* ------------------------------------------------------------------ */
/*  Button Handler                                                     */
/* ------------------------------------------------------------------ */

/** Map of button customIds ΓåÆ handler functions for the wizard. */
const WIZARD_BUTTON_HANDLERS: Record<
  string,
  (interaction: ButtonInteraction, session: WizardSessionState) => Promise<void>
> = {
  event_wiz_title: showTitleModal,
  event_wiz_description: showDescriptionModal,
  event_wiz_type: showTypeSelect,
  event_wiz_datetime: showDateTimeModal,
  event_wiz_duration: showDurationModal,
  event_wiz_location: showLocationModal,
  event_wiz_difficulty: showDifficultySelect,
  event_wiz_maxplayers: showMaxPlayersModal,
  event_wiz_voice: handleVoiceToggle,
  event_wiz_requirements: showRequirementsModal,
  event_wiz_finish: handleWizardFinish,
  event_wiz_cancel: handleWizardCancel,
};

export async function handleWizardButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;
  const session = getSession(interaction.guildId, interaction.user.id);

  if (!session) {
    await interaction.reply({
      content:
        'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const handler = WIZARD_BUTTON_HANDLERS[customId];
  if (handler) {
    await handler(interaction, session);
  }
}

/* ------------------------------------------------------------------ */
/*  Individual button handlers (reduce cognitive complexity)           */
/* ------------------------------------------------------------------ */

async function showTitleModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder().setCustomId('event_wiz_modal_title').setTitle('Set Event Title');

  const titleInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_title')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Enter event title (3-200 characters)')
    .setMinLength(3)
    .setMaxLength(MAX_TITLE_LENGTH)
    .setRequired(true);

  if (session.title) {
    titleInput.setValue(session.title);
  }

  modal.addLabelComponents(new LabelBuilder().setLabel('Title').setTextInputComponent(titleInput));
  await interaction.showModal(modal);
}

async function showDescriptionModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('event_wiz_modal_desc')
    .setTitle('Set Event Description');

  const descInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_desc')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Enter event description')
    .setMaxLength(MAX_DESCRIPTION_LENGTH)
    .setRequired(false);

  if (session.description) {
    descInput.setValue(session.description);
  }

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Description').setTextInputComponent(descInput)
  );
  await interaction.showModal(modal);
}

async function showTypeSelect(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const row = buildEventTypeSelect('event_wiz_select_type', session.activityType);

  await interaction.reply({
    content: 'Select the activity type:',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function showDateTimeModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('event_wiz_modal_datetime')
    .setTitle('Set Date & Time');

  const dateInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_date')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('2026-04-24')
    .setMinLength(10)
    .setMaxLength(10)
    .setRequired(true);

  const timeInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_time')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('21:00')
    .setMinLength(4)
    .setMaxLength(5)
    .setRequired(true);

  if (session.scheduledStartDate) {
    const d = session.scheduledStartDate;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    dateInput.setValue(dateStr);
    timeInput.setValue(timeStr);
  }

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Date (YYYY-MM-DD)').setTextInputComponent(dateInput),
    new LabelBuilder().setLabel('Time (HH:MM, 24h format)').setTextInputComponent(timeInput)
  );
  await interaction.showModal(modal);
}

async function showDurationModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder().setCustomId('event_wiz_modal_duration').setTitle('Set Duration');

  const durInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_duration')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('60')
    .setMaxLength(4)
    .setRequired(true);

  if (session.estimatedDuration) {
    durInput.setValue(String(session.estimatedDuration));
  }

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Duration in minutes (1-1440)').setTextInputComponent(durInput)
  );
  await interaction.showModal(modal);
}

async function showLocationModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder().setCustomId('event_wiz_modal_location').setTitle('Set Location');

  const locInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_location')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Stanton, Crusader, Port Olisar')
    .setMaxLength(MAX_LOCATION_LENGTH)
    .setRequired(false);

  if (session.location) {
    locInput.setValue(session.location);
  }

  modal.addLabelComponents(new LabelBuilder().setLabel('Location').setTextInputComponent(locInput));
  await interaction.showModal(modal);
}

async function showDifficultySelect(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const row = buildEventDifficultySelect('event_wiz_select_difficulty', session.difficulty);

  await interaction.reply({
    content: 'Select the difficulty level:',
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

async function showMaxPlayersModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('event_wiz_modal_maxplayers')
    .setTitle('Set Max Participants');

  const maxInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_maxplayers')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('20')
    .setMaxLength(3)
    .setRequired(true);

  if (session.maxParticipants) {
    maxInput.setValue(String(session.maxParticipants));
  }

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('Maximum number of participants (1-100)')
      .setTextInputComponent(maxInput)
  );
  await interaction.showModal(modal);
}

async function handleVoiceToggle(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const select = new StringSelectMenuBuilder()
    .setCustomId('event_wiz_select_voice_mode')
    .setPlaceholder('Select a voice channel mode')
    .addOptions(
      {
        label: 'No voice channel',
        value: 'none',
        description: 'Do not link or create a voice channel for this event',
        default: session.voiceChannelMode === 'none',
      },
      {
        label: 'Use my current voice channel',
        value: 'current',
        description: 'Link the voice channel you are currently in when the event is created',
        default: session.voiceChannelMode === 'current',
      },
      {
        label: 'Create a temporary event voice channel',
        value: 'temp',
        description: 'Create a temp channel that is cleaned up after the event when empty',
        default: session.voiceChannelMode === 'temp',
      }
    );

  await interaction.reply({
    content: 'Select how voice should work for this event:',
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

function buildVoiceSettingsModal(session: WizardSessionState): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId('event_wiz_modal_voice')
    .setTitle('Voice Channel Settings');

  const limitInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_voicelimit')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('0')
    .setMaxLength(2)
    .setRequired(false);

  if (session.voiceChannelLimit) {
    limitInput.setValue(String(session.voiceChannelLimit));
  }

  modal.addLabelComponents(
    new LabelBuilder()
      .setLabel('User limit (0 = unlimited, max 99)')
      .setTextInputComponent(limitInput)
  );
  return modal;
}

async function showRequirementsModal(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('event_wiz_modal_requirements')
    .setTitle('Set Requirements');

  const reqInput = new TextInputBuilder()
    .setCustomId('event_wiz_input_requirements')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('e.g., Must have combat experience, Bring own ship')
    .setMaxLength(MAX_REQUIREMENTS_LENGTH)
    .setRequired(false);

  if (session.requirements) {
    reqInput.setValue(session.requirements);
  }

  modal.addLabelComponents(
    new LabelBuilder().setLabel('Requirements (free text)').setTextInputComponent(reqInput)
  );
  await interaction.showModal(modal);
}

async function handleWizardCancel(
  interaction: ButtonInteraction,
  _session: WizardSessionState
): Promise<void> {
  if (interaction.guildId) {
    wizardSessions.delete(sessionKey(interaction.guildId, interaction.user.id));
  }
  await interaction.update({
    content: 'Γ¥î Event creation cancelled.',
    embeds: [],
    components: [],
  });
}

/* ------------------------------------------------------------------ */
/*  Modal Handler                                                      */
/* ------------------------------------------------------------------ */

/** Map of modal customIds ΓåÆ handler functions. */
const WIZARD_MODAL_HANDLERS: Record<
  string,
  (interaction: ModalSubmitInteraction, session: WizardSessionState) => Promise<void>
> = {
  event_wiz_modal_title: handleTitleModal,
  event_wiz_modal_desc: handleDescModal,
  event_wiz_modal_datetime: handleDateTimeModal,
  event_wiz_modal_duration: handleDurationModal,
  event_wiz_modal_location: handleLocationModal,
  event_wiz_modal_maxplayers: handleMaxPlayersModal,
  event_wiz_modal_voice: handleVoiceModal,
  event_wiz_modal_requirements: handleRequirementsModal,
};

export async function handleWizardModal(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;
  const session = getSession(interaction.guildId, interaction.user.id);

  if (!session) {
    await interaction.reply({
      content:
        'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const handler = WIZARD_MODAL_HANDLERS[customId];
  if (handler) {
    await handler(interaction, session);
  }
}

/* ------------------------------------------------------------------ */
/*  Individual modal handlers (reduce cognitive complexity)            */
/* ------------------------------------------------------------------ */

async function handleTitleModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_title');
  session.title = sanitizeText(raw, MAX_TITLE_LENGTH);
  await updateWizardMessage(interaction, session);
}

async function handleDescModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_desc');
  session.description = raw ? sanitizeText(raw, MAX_DESCRIPTION_LENGTH) : undefined;
  await updateWizardMessage(interaction, session);
}

async function handleDateTimeModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const dateStr = interaction.fields.getTextInputValue('event_wiz_input_date').trim();
  const timeStr = interaction.fields.getTextInputValue('event_wiz_input_time').trim();

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    await interaction.reply({
      content: 'Γ¥î Invalid date format. Use YYYY-MM-DD (e.g., 2026-04-24).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const timeParts = timeRegex.exec(timeStr);
  if (!timeParts) {
    await interaction.reply({
      content: 'Γ¥î Invalid time format. Use HH:MM in 24h format (e.g., 21:00).',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hours = Number.parseInt(timeParts[1], 10);
  const minutes = Number.parseInt(timeParts[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    await interaction.reply({
      content: 'Γ¥î Invalid time. Hours must be 0-23, minutes 0-59.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const parsedDate = new Date(
    `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  );
  if (Number.isNaN(parsedDate.getTime())) {
    await interaction.reply({
      content: 'Γ¥î Could not parse date. Use YYYY-MM-DD format.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  session.scheduledStartDate = parsedDate;
  await updateWizardMessage(interaction, session);
}

async function handleDurationModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_duration');
  const duration = Number.parseInt(raw, 10);
  if (Number.isNaN(duration) || duration < 1 || duration > 1440) {
    await interaction.reply({
      content: 'Γ¥î Duration must be between 1 and 1440 minutes.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  session.estimatedDuration = duration;
  await updateWizardMessage(interaction, session);
}

async function handleLocationModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_location');
  session.location = raw ? sanitizeText(raw, MAX_LOCATION_LENGTH) : undefined;
  await updateWizardMessage(interaction, session);
}

async function handleMaxPlayersModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_maxplayers');
  const max = Number.parseInt(raw, 10);
  if (Number.isNaN(max) || max < 1 || max > 100) {
    await interaction.reply({
      content: 'Γ¥î Max participants must be between 1 and 100.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  session.maxParticipants = max;
  await updateWizardMessage(interaction, session);
}

async function handleVoiceModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_voicelimit');
  let limit = 0;
  if (raw && raw.trim() !== '') {
    limit = Number.parseInt(raw, 10);
    if (Number.isNaN(limit) || limit < 0) {
      limit = 0;
    }
    if (limit > 99) {
      limit = 99;
    }
  }
  session.voiceChannelMode = 'temp';
  session.voiceChannelLimit = limit > 0 ? limit : undefined;
  await updateWizardMessage(interaction, session);
}

async function handleRequirementsModal(
  interaction: ModalSubmitInteraction,
  session: WizardSessionState
): Promise<void> {
  const raw = interaction.fields.getTextInputValue('event_wiz_input_requirements');
  session.requirements = raw ? sanitizeText(raw, MAX_REQUIREMENTS_LENGTH) : undefined;
  await updateWizardMessage(interaction, session);
}

/* ------------------------------------------------------------------ */
/*  Select Menu Handler                                                */
/* ------------------------------------------------------------------ */

export async function handleWizardSelectMenu(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const { customId, values } = interaction;
  const session = getSession(interaction.guildId, interaction.user.id);

  if (!session) {
    await interaction.reply({
      content:
        'ΓÜá∩╕Å Your event creation session has expired. Use `/events create` to start again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Type select
  if (customId === 'event_wiz_select_type') {
    const selectedType = values[0] as ActivityType;
    if (Object.values(ActivityType).includes(selectedType)) {
      session.activityType = selectedType;
    }
    const typeLabel = (
      ACTIVITY_TYPE_LABELS[session.activityType] ?? { label: session.activityType }
    ).label;
    await dismissSelectAndConfirm(interaction, `Γ£à Type set to **${typeLabel}**`);
    return;
  }

  // Difficulty select
  if (customId === 'event_wiz_select_difficulty') {
    const selectedDifficulty = values[0] as 'easy' | 'medium' | 'hard' | 'expert';
    const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
    if (validDifficulties.includes(selectedDifficulty)) {
      session.difficulty = selectedDifficulty;
    }
    const diffLabel = DIFFICULTY_LABELS[session.difficulty ?? 'medium'] ?? session.difficulty;
    await dismissSelectAndConfirm(interaction, `Γ£à Difficulty set to **${diffLabel}**`);
    return;
  }

  if (customId === 'event_wiz_select_voice_mode') {
    const selectedMode = values[0] as VoiceChannelMode;
    if (!['none', 'current', 'temp'].includes(selectedMode)) {
      await interaction.reply({
        content: 'Γ¥î Invalid voice mode selection.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (selectedMode === 'temp') {
      await interaction.showModal(buildVoiceSettingsModal(session));
      return;
    }

    session.voiceChannelMode = selectedMode;
    session.voiceChannelLimit = undefined;
    await dismissSelectAndConfirm(
      interaction,
      `Γ£à Voice mode set to **${VOICE_MODE_LABELS[selectedMode]}**`
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Wizard Finish ΓÇö Create the Activity                                */
/* ------------------------------------------------------------------ */

/** Try to create a linked Discord Scheduled Event. Returns the event URL or empty string. */
async function tryCreateDiscordEvent(
  session: WizardSessionState,
  title: string,
  startDate: Date,
  organizationId: string,
  participantSummary?: { participantCount?: number; participantCap?: number }
): Promise<string> {
  try {
    const { discordSettingsService } =
      await import('../../services/discord/DiscordSettingsService');
    const guildSettings = await discordSettingsService.getSettings(organizationId, session.guildId);
    const eventConfig = guildSettings?.eventSettings;

    if (!eventConfig?.createDiscordEvent) {
      return '';
    }

    const { DiscordEventService } = await import('../../services/discord/DiscordEventService');
    const discordEventId = await DiscordEventService.getInstance().createEvent(session.guildId, {
      title,
      description: session.description,
      scheduledStartDate: startDate,
      location: session.location ?? 'Star Citizen',
      participantCount: participantSummary?.participantCount,
      participantCap: participantSummary?.participantCap,
    });

    if (discordEventId) {
      return `https://discord.com/events/${session.guildId}/${discordEventId}`;
    }
  } catch {
    // Non-fatal ΓÇö Discord event creation is optional
  }
  return '';
}

/** Try to create a voice channel for the event. Non-fatal on failure.
 *  Returns the Discord channel ID if successful, undefined otherwise. */
async function tryCreateVoiceChannel(
  session: WizardSessionState,
  title: string,
  startDate: Date,
  activityId: string,
  guild: ButtonInteraction['guild'],
  organizationId: string
): Promise<string | undefined> {
  if (session.voiceChannelMode !== 'temp' || !guild) {
    return undefined;
  }

  try {
    const channelName = `≡ƒÄ« ${title}`;
    // Expire based on event duration (default 2h) + 30min grace period
    const durationMs = (session.estimatedDuration ?? 120) * 60 * 1000;
    const gracePeriodMs = 30 * 60 * 1000;
    const expiresAt = new Date(startDate.getTime() + durationMs + gracePeriodMs);
    const userLimit =
      session.voiceChannelLimit && session.voiceChannelLimit > 0
        ? session.voiceChannelLimit
        : undefined;

    // Resolve parent category from guild event settings (optional)
    let parentCategoryId: string | undefined;
    try {
      const { discordSettingsService: settingsSvc } =
        await import('../../services/discord/DiscordSettingsService');
      const guildSettings = await settingsSvc.getSettings(organizationId, session.guildId);
      parentCategoryId = guildSettings?.eventSettings?.eventVoiceCategoryId || undefined;
    } catch {
      // Non-fatal ΓÇö fall back to no parent
    }

    const creatorMember = guild.members.cache.get(session.userId);
    if (!creatorMember) {
      return undefined;
    }

    const result = await createEventTempVoiceChannel({
      guild,
      creator: creatorMember,
      channelName,
      parentCategoryId,
      userLimit,
      expiresAt,
      eventId: activityId,
    });

    if (result?.channelId) {
      return result.channelId;
    }
  } catch (voiceErr: unknown) {
    logger.warn(
      'Failed to create voice channel for wizard event',
      voiceErr instanceof Error ? voiceErr : new Error(String(voiceErr))
    );
  }
  return undefined;
}

function resolveCurrentVoiceChannel(
  interaction: ButtonInteraction,
  session: WizardSessionState
): { id: string; name: string } | undefined {
  const member = interaction.guild?.members.cache.get(session.userId);
  const currentVoiceChannel = member?.voice?.channel;

  if (!currentVoiceChannel) {
    return undefined;
  }

  return {
    id: currentVoiceChannel.id,
    name: currentVoiceChannel.name,
  };
}

async function persistVoiceChannelLink(
  activityId: string,
  channelId: string,
  channelName: string,
  options: { autoCreate: boolean; autoDelete: boolean }
): Promise<void> {
  await getActivityService().updateActivity(activityId, {
    voiceChannelId: channelId,
    voiceChannelName: channelName,
    voiceChannel: {
      autoCreate: options.autoCreate,
      autoDelete: options.autoDelete,
      channelId,
    },
  });
}

/** Build the confirmation embed shown after event creation. */
function buildConfirmationEmbed(
  session: WizardSessionState,
  activityId: string,
  title: string,
  startDate: Date,
  discordEventUrl: string
): EmbedBuilder {
  const descSuffix = session.description ? `\n${session.description}` : '';
  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle('Γ£à Activity Created Successfully!')
    .setDescription(`**${title}**${descSuffix}`)
    .addFields(
      { name: 'Activity ID', value: activityId, inline: true },
      { name: 'Type', value: session.activityType, inline: true },
      { name: 'Location', value: session.location ?? 'TBD', inline: true }
    );

  const ts = Math.floor(startDate.getTime() / 1000);
  embed.addFields({ name: 'Date', value: `<t:${ts}:F>`, inline: true });

  if (discordEventUrl) {
    embed.addFields({
      name: 'Discord Event',
      value: `[View in Discord](${discordEventUrl})`,
      inline: true,
    });
  }

  embed.setFooter({ text: `Activity ID: ${activityId}` }).setTimestamp();
  return embed;
}

async function handleWizardFinish(
  interaction: ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  // Validate required fields
  const { title, scheduledStartDate } = session;
  const missing: string[] = [];
  if (!title) {
    missing.push('Title');
  }
  if (!scheduledStartDate) {
    missing.push('Date & Time');
  }

  if (missing.length > 0 || !title || !scheduledStartDate) {
    const missingList = missing.map(f => `ΓÇó **${f}**`).join('\n');
    await interaction.reply({
      content: `Γ¥î Please fill in the required fields before finishing:\n${missingList}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const currentVoiceChannel =
    session.voiceChannelMode === 'current'
      ? resolveCurrentVoiceChannel(interaction, session)
      : undefined;

  if (session.voiceChannelMode === 'current' && !currentVoiceChannel) {
    await interaction.reply({
      content:
        'Γ¥î Join the voice channel you want to use before finishing, or switch to temporary voice mode.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  try {
    // Resolve org ΓÇö fail clearly if guild is not linked
    const orgId = await getGuildOrgService().resolveOrganization(session.guildId);
    if (!orgId) {
      await interaction.editReply({
        content:
          'Γ¥î **This Discord server is not linked to an organization.**\n' +
          'An admin needs to link this server to an organization in the web app before events can be created.',
        components: [],
      });
      return;
    }

    // Resolve internal user UUID from Discord ID so the event is
    // associated with the web app user (not the Discord snowflake).
    let creatorId = session.userId;
    let creatorName = session.userName;
    try {
      const internalUser = await getUserService().getUserByDiscordId(session.userId);
      if (internalUser) {
        creatorId = internalUser.id;
        creatorName = internalUser.username ?? session.userName;
      }
    } catch {
      // Non-fatal ΓÇö fall back to Discord ID
      logger.warn('Could not resolve internal user for event creator', {
        discordId: session.userId,
      });
    }

    // Create the activity
    const newActivity = await getActivityService().createActivity(orgId, {
      title,
      description: session.description ?? '',
      activityType: session.activityType,
      location: session.location ?? 'TBD',
      scheduledStartDate,
      estimatedDuration: session.estimatedDuration,
      maxParticipants: session.maxParticipants,
      creatorId,
      creatorName,
      metadata: {
        discordServerId: session.guildId,
        difficulty: session.difficulty,
        requirements: session.requirements,
      },
    });

    // Create linked Discord Scheduled Event if enabled
    const discordEventUrl = await tryCreateDiscordEvent(session, title, scheduledStartDate, orgId, {
      participantCount: 1,
      participantCap: session.maxParticipants,
    });
    if (discordEventUrl) {
      newActivity.discordEventId = discordEventUrl.split('/').pop();
      await getActivityService().updateActivity(newActivity.id, {
        discordEventId: newActivity.discordEventId,
      });
    }

    if (currentVoiceChannel) {
      await persistVoiceChannelLink(
        newActivity.id,
        currentVoiceChannel.id,
        currentVoiceChannel.name,
        {
          autoCreate: false,
          autoDelete: false,
        }
      );
    } else {
      const vcId = await tryCreateVoiceChannel(
        session,
        title,
        scheduledStartDate,
        newActivity.id,
        interaction.guild,
        orgId
      );

      if (vcId) {
        try {
          await persistVoiceChannelLink(newActivity.id, vcId, `≡ƒÄ« ${title}`, {
            autoCreate: true,
            autoDelete: true,
          });
        } catch {
          // Non-fatal ΓÇö VC still works, just harder to find on cancel
        }
      }
    }

    // Build and send confirmation
    const confirmEmbed = buildConfirmationEmbed(
      session,
      newActivity.id,
      title,
      scheduledStartDate,
      discordEventUrl
    );
    await interaction.editReply({ embeds: [confirmEmbed], components: [] });

    // Post persistent RSVP embed in the channel
    // Prefer the dedicated event-announcement channel from settings, falling back to the
    // channel where the wizard was invoked. This keeps general announcements separate from
    // RSVP/event embeds when the org configures it that way.
    let targetChannelId = session.channelId;
    let mentionContent = '';
    let shouldAutoPublish = false;
    let shouldCreateEventThread = false;
    try {
      const { discordSettingsService } =
        await import('../../services/discord/DiscordSettingsService');
      const guildSettings = await discordSettingsService.getSettings(orgId, session.guildId);
      const eventConfig = guildSettings?.eventSettings;
      if (eventConfig?.eventAnnouncementChannelId) {
        targetChannelId = eventConfig.eventAnnouncementChannelId;
      }
      shouldAutoPublish = eventConfig?.autoPublishAnnouncements === true;
      shouldCreateEventThread = eventConfig?.createEventThread === true;
      // Build mention prefix from configured notification roles, when mentions are enabled.
      const mentionsEnabled = eventConfig?.enableEventMentions !== false;
      if (mentionsEnabled) {
        const roleIds: string[] = [];
        if (Array.isArray(eventConfig?.eventNotificationRoleIds)) {
          roleIds.push(...eventConfig.eventNotificationRoleIds.filter(Boolean));
        }
        if (eventConfig?.eventNotificationRoleId) {
          roleIds.push(eventConfig.eventNotificationRoleId);
        }
        const uniqueRoleIds = Array.from(new Set(roleIds));
        if (uniqueRoleIds.length > 0) {
          mentionContent = uniqueRoleIds.map(id => `<@&${id}>`).join(' ');
        }
      }
    } catch (settingsErr) {
      logger.warn('Failed to resolve event announcement channel/mentions from settings', {
        guildId: session.guildId,
        error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr),
      });
    }

    const channel = interaction.guild?.channels.cache.get(targetChannelId);
    if (channel?.isTextBased()) {
      // Fetch the real participants so the initial embed shows the creator (auto-added
      // as LEADER in createActivity). Previously this was hard-coded to []
      // which made it look like nobody had joined yet.
      let participantList: EventEmbedData['participants'] = [];
      try {
        const rows = await getParticipantService().getParticipants(newActivity.id);
        participantList = rows.map(p => ({
          userId: p.userId,
          userName: p.userName ?? undefined,
          // The creator we just resolved is the only known mapping at this point.
          discordUserId: p.userId === creatorId ? session.userId : undefined,
          status: p.status ?? 'accepted',
          role: p.role ?? undefined,
          shipType: p.shipType ?? undefined,
          shipName: p.shipName ?? undefined,
        }));
      } catch (participantsErr) {
        logger.warn('Failed to fetch initial participants for wizard embed', {
          activityId: newActivity.id,
          error:
            participantsErr instanceof Error ? participantsErr.message : String(participantsErr),
        });
      }

      const eventEmbedData: EventEmbedData = {
        id: newActivity.id,
        title: newActivity.title,
        type: newActivity.activityType,
        status: newActivity.status ?? 'open',
        description: newActivity.description ?? undefined,
        location: newActivity.location ?? undefined,
        startDate: newActivity.scheduledStartDate ?? undefined,
        maxParticipants: session.maxParticipants ?? undefined,
        creatorName: session.userName,
        creatorId,
        participants: participantList,
        postedAt: newActivity.createdAt ?? new Date(),
        updatedAt: newActivity.updatedAt ?? newActivity.createdAt ?? new Date(),
      };

      const rsvpEmbed = buildEventEmbed(eventEmbedData);
      const eventRows = buildEventComponentRows(newActivity.id, { includeManage: true });

      const sentMsg = await channel.send({
        content: mentionContent || undefined,
        embeds: [rsvpEmbed],
        components: eventRows,
        allowedMentions: mentionContent
          ? { parse: [], roles: mentionContent.match(/\d{17,20}/g) ?? [] }
          : undefined,
      });

      if (shouldCreateEventThread && sentMsg?.startThread) {
        try {
          await sentMsg.startThread({
            name: `Event: ${title}`.slice(0, 100),
            autoArchiveDuration: 1440,
            reason: `Auto-created discussion thread for activity ${newActivity.id}`,
          });
        } catch (threadErr: unknown) {
          logger.warn('Failed to auto-create event discussion thread from wizard', {
            guildId: session.guildId,
            channelId: targetChannelId,
            activityId: newActivity.id,
            error: threadErr instanceof Error ? threadErr.message : String(threadErr),
          });
        }
      }

      // Auto-publish (crosspost) if the channel is an announcement channel
      if (
        shouldAutoPublish &&
        channel.type === ChannelType.GuildAnnouncement &&
        sentMsg?.crosspost
      ) {
        try {
          await sentMsg.crosspost();
        } catch (crosspostErr: unknown) {
          logger.warn('Failed to crosspost event wizard message', {
            guildId: session.guildId,
            channelId: targetChannelId,
            error: crosspostErr instanceof Error ? crosspostErr.message : String(crosspostErr),
          });
        }
      }
    }

    // Clean up session
    wizardSessions.delete(sessionKey(session.guildId, session.userId));

    logger.info(`Event created via wizard: ${newActivity.id} by ${session.userName}`);
  } catch (error: unknown) {
    logger.error(
      'Failed to create event via wizard',
      error instanceof Error ? error : new Error(String(error))
    );
    await interaction.editReply({
      content: 'Γ¥î Failed to create event. Please try again.',
      embeds: [],
      components: [],
    });

    // Clean up session on failure
    if (interaction.guildId) {
      wizardSessions.delete(sessionKey(interaction.guildId, interaction.user.id));
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Update helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Update the wizard embed after a session field changes.
 *
 * - **Button interactions** ΓåÆ `interaction.update()` edits the message in place.
 * - **Modal submissions** ΓåÆ `deferUpdate()` + `editReply()` to refresh the
 *   original ephemeral wizard message that spawned the modal.
 */
async function updateWizardMessage(
  interaction: ModalSubmitInteraction | ButtonInteraction,
  session: WizardSessionState
): Promise<void> {
  const embed = buildWizardEmbed(session);
  const buttons = buildWizardButtons();

  if (interaction.isModalSubmit()) {
    // deferUpdate acknowledges the modal and lets us edit the parent message
    await interaction.deferUpdate();
    await interaction.editReply({
      embeds: [embed],
      components: buttons,
    });
  } else {
    // Button interactions can use update() directly
    await interaction.update({
      embeds: [embed],
      components: buttons,
    });
  }
}

/**
 * Refresh the wizard embed from a select menu interaction.
 * Select menus live in a separate ephemeral reply, so we dismiss
 * the select message and the wizard embed refreshes on the next
 * button press (Discord does not allow editing a different message).
 */
async function dismissSelectAndConfirm(
  interaction: StringSelectMenuInteraction,
  confirmText: string
): Promise<void> {
  await interaction.update({
    content: confirmText,
    components: [],
  });
}

/* ------------------------------------------------------------------ */
/*  Custom ID matchers                                                 */
/* ------------------------------------------------------------------ */

/** Check if a customId belongs to the creation wizard. */
export function isWizardButtonId(customId: string): boolean {
  return customId.startsWith('event_wiz_');
}

/** Check if a customId belongs to a wizard modal. */
export function isWizardModalId(customId: string): boolean {
  return customId.startsWith('event_wiz_modal_');
}

/** Check if a customId belongs to a wizard select menu. */
export function isWizardSelectId(customId: string): boolean {
  return customId.startsWith('event_wiz_select_');
}
