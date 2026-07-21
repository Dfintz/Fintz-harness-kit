/**
 * Shared Discord select menu and choice builders for bot commands.
 *
 * Centralises enum → SelectMenuOption / APIApplicationCommandOptionChoice
 * mappings so every command referencing the same domain enum renders
 * consistent labels, emojis, and values.
 *
 * Usage in pre-modal select flows:
 *   import { buildBountyTypeSelect } from '../utils/sharedChoices';
 *   const row = buildBountyTypeSelect('bounty_create_type');
 *   await interaction.reply({ content: 'Pick type:', components: [row] });
 *
 * Usage in slash command builders (if needed later):
 *   .addStringOption(opt => opt.setName('type').addChoices(...BOUNTY_TYPE_CHOICES))
 */
import {
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';

import { ActivityType } from '../../models/Activity';
import { BountyDifficulty, BountyType } from '../../models/Bounty';
import {
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { LFGActivity } from '../../types';

// ─── Bounty ──────────────────────────────────────────────────

export const BOUNTY_TYPE_OPTIONS = [
  { label: 'Kill', value: BountyType.KILL, emoji: '💀' },
  { label: 'Capture', value: BountyType.CAPTURE, emoji: '🔗' },
  { label: 'Intel', value: BountyType.INTEL, emoji: '🔍' },
  { label: 'Transport', value: BountyType.TRANSPORT, emoji: '🚚' },
  { label: 'Rescue', value: BountyType.RESCUE, emoji: '🛟' },
  { label: 'Custom', value: BountyType.CUSTOM, emoji: '⚙️' },
] as const;

export const BOUNTY_DIFFICULTY_OPTIONS = [
  { label: 'Easy', value: BountyDifficulty.EASY, emoji: '🟢' },
  { label: 'Medium', value: BountyDifficulty.MEDIUM, emoji: '🟡' },
  { label: 'Hard', value: BountyDifficulty.HARD, emoji: '🟠' },
  { label: 'Expert', value: BountyDifficulty.EXPERT, emoji: '🔴' },
] as const;

// ─── Mission ─────────────────────────────────────────────────

export const MISSION_TYPE_OPTIONS = [
  { label: 'Combat', value: MissionType.COMBAT, emoji: '⚔️' },
  { label: 'Mining', value: MissionType.MINING, emoji: '⛏️' },
  { label: 'Trading', value: MissionType.TRADING, emoji: '💰' },
  { label: 'Exploration', value: MissionType.EXPLORATION, emoji: '🔭' },
  { label: 'Logistics', value: MissionType.LOGISTICS, emoji: '📦' },
  { label: 'Rescue', value: MissionType.RESCUE, emoji: '🛟' },
  { label: 'Reconnaissance', value: MissionType.RECONNAISSANCE, emoji: '🔍' },
  { label: 'Escort', value: MissionType.ESCORT, emoji: '🛡️' },
  { label: 'Salvage', value: MissionType.SALVAGE, emoji: '🔧' },
  { label: 'Custom', value: MissionType.CUSTOM, emoji: '⚙️' },
] as const;

export const MISSION_DIFFICULTY_OPTIONS = [
  { label: 'Trivial', value: MissionDifficulty.TRIVIAL, emoji: '⚪' },
  { label: 'Easy', value: MissionDifficulty.EASY, emoji: '🟢' },
  { label: 'Medium', value: MissionDifficulty.MEDIUM, emoji: '🟡' },
  { label: 'Hard', value: MissionDifficulty.HARD, emoji: '🟠' },
  { label: 'Extreme', value: MissionDifficulty.EXTREME, emoji: '🔴' },
] as const;

export const MISSION_PRIORITY_OPTIONS = [
  { label: 'Low', value: MissionPriority.LOW, emoji: '🔽' },
  { label: 'Normal', value: MissionPriority.NORMAL, emoji: '▶️' },
  { label: 'High', value: MissionPriority.HIGH, emoji: '🔺' },
  { label: 'Critical', value: MissionPriority.CRITICAL, emoji: '🔥' },
] as const;

export const MISSION_STATUS_OPTIONS = [
  { label: 'Planned', value: MissionStatus.PLANNED, emoji: '\u{1F4CB}' },
  { label: 'Briefed', value: MissionStatus.BRIEFED, emoji: '\u{1F4D1}' },
  { label: 'In Progress', value: MissionStatus.IN_PROGRESS, emoji: '\u{1F680}' },
  { label: 'Completed', value: MissionStatus.COMPLETED, emoji: '\u2705' },
  { label: 'Failed', value: MissionStatus.FAILED, emoji: '\u274C' },
  { label: 'Cancelled', value: MissionStatus.CANCELLED, emoji: '\u{1F6AB}' },
] as const;

// ─── LFG ─────────────────────────────────────────────────────

export const LFG_ACTIVITY_OPTIONS = [
  { label: 'PvP', value: LFGActivity.PVP, emoji: '⚔️' },
  { label: 'PvE', value: LFGActivity.PVE, emoji: '🎯' },
  { label: 'Mining', value: LFGActivity.MINING, emoji: '⛏️' },
  { label: 'Trading', value: LFGActivity.TRADING, emoji: '💰' },
  { label: 'Exploration', value: LFGActivity.EXPLORATION, emoji: '🔭' },
  { label: 'Bounty Hunting', value: LFGActivity.BOUNTY_HUNTING, emoji: '💀' },
  { label: 'Cargo Hauling', value: LFGActivity.CARGO_HAULING, emoji: '📦' },
  { label: 'Racing', value: LFGActivity.RACING, emoji: '🏎️' },
  { label: 'Other', value: LFGActivity.OTHER, emoji: '❓' },
] as const;

// ─── Announce (colour presets) ───────────────────────────────

export const ANNOUNCE_COLOR_OPTIONS = [
  { label: 'Blue (Default)', value: '#0099FF', emoji: '🔵' },
  { label: 'Green', value: '#00CC66', emoji: '🟢' },
  { label: 'Red', value: '#FF3333', emoji: '🔴' },
  { label: 'Gold', value: '#FFD700', emoji: '🟡' },
  { label: 'Purple', value: '#9B59B6', emoji: '🟣' },
  { label: 'Orange', value: '#FF8C00', emoji: '🟠' },
  { label: 'Teal', value: '#1ABC9C', emoji: '💠' },
  { label: 'White', value: '#FFFFFF', emoji: '⬜' },
  { label: 'Dark', value: '#2C2F33', emoji: '⬛' },
  { label: 'Custom Hex...', value: '__custom__', emoji: '🎨' },
] as const;

// ─── Event ─────────────────────────────────

export const EVENT_DIFFICULTY_OPTIONS = [
  { label: 'Easy', value: 'easy', emoji: '\u{1F7E2}' },
  { label: 'Medium', value: 'medium', emoji: '\u{1F7E1}' },
  { label: 'Hard', value: 'hard', emoji: '\u{1F7E0}' },
  { label: 'Expert', value: 'expert', emoji: '\u{1F534}' },
] as const;

export const ACTIVITY_TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
  [ActivityType.EVENT]: { emoji: '\u{1F4C5}', label: 'Event' },
  [ActivityType.MISSION]: { emoji: '\u{1F3AF}', label: 'Mission' },
  [ActivityType.CONTRACT]: { emoji: '\u{1F4DC}', label: 'Contract' },
  [ActivityType.BOUNTY]: { emoji: '\u{1F4B0}', label: 'Bounty' },
  [ActivityType.OPERATION]: { emoji: '\u2694\uFE0F', label: 'Operation' },
  [ActivityType.LFG]: { emoji: '\u{1F50D}', label: 'Looking For Group' },
  [ActivityType.JOB_LISTING]: { emoji: '\u{1F4BC}', label: 'Job Listing' },
};

export const EVENT_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_LABELS).map(([value, info]) => ({
  label: info.label,
  value,
  emoji: info.emoji,
}));

// ─── Select Menu Builders ────────────────────────────────────

type SelectOption = { label: string; value: string; emoji: string; description?: string };

function buildSelectRow(
  customId: string,
  placeholder: string,
  options: readonly SelectOption[],
  selectedValue?: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        options.map(o => ({
          label: o.label,
          value: o.value,
          emoji: o.emoji,
          ...(selectedValue !== undefined ? { default: o.value === selectedValue } : {}),
        }))
      )
  );
}

export function buildBountyTypeSelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select bounty type...', BOUNTY_TYPE_OPTIONS);
}

export function buildBountyDifficultySelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select difficulty...', BOUNTY_DIFFICULTY_OPTIONS);
}

export function buildMissionTypeSelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select mission type...', MISSION_TYPE_OPTIONS);
}

export function buildMissionDifficultySelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select difficulty...', MISSION_DIFFICULTY_OPTIONS);
}

export function buildMissionPrioritySelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select priority...', MISSION_PRIORITY_OPTIONS);
}

export function buildMissionStatusSelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select new status...', MISSION_STATUS_OPTIONS);
}

export function buildLfgActivitySelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select activity type...', LFG_ACTIVITY_OPTIONS);
}

export function buildAnnounceColorSelect(
  customId: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Pick a colour...', ANNOUNCE_COLOR_OPTIONS);
}

export function buildEventDifficultySelect(
  customId: string,
  selectedValue?: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select difficulty', EVENT_DIFFICULTY_OPTIONS, selectedValue);
}

export function buildEventTypeSelect(
  customId: string,
  selectedValue?: string
): ActionRowBuilder<StringSelectMenuBuilder> {
  return buildSelectRow(customId, 'Select activity type', EVENT_TYPE_OPTIONS, selectedValue);
}

// ─── Await helpers ───────────────────────────────────────────

/**
 * Show a select menu, wait for the user to pick, then return the value.
 * Returns `null` if the user doesn't interact within the timeout.
 *
 * @param customId must match the select menu customId sent in the message
 * @param message  the message that contains the select menu
 * @param timeoutMs how long to wait (default 60 s)
 */
export async function awaitSelectValue(
  interaction: StringSelectMenuInteraction,
  _customId: string,
  timeoutMs = 60_000
): Promise<string | null> {
  try {
    const collected = await interaction.message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: timeoutMs,
      filter: i => i.user.id === interaction.user.id,
    });
    return collected.values[0] ?? null;
  } catch {
    return null;
  }
}
