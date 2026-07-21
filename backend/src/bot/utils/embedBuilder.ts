import { ACTIVITY_TYPE_CONFIG } from '@sc-fleet-manager/shared-types';
import { ColorResolvable, EmbedBuilder } from 'discord.js';

/**
 * Star Citizen Fleet Manager 2025 Design System
 * Unified embed colors and styling for Discord bot
 */
export const EmbedColors = {
  // Primary brand colors
  SC_BLUE: 0x00d4ff as ColorResolvable, // Primary brand - Star Citizen blue
  QUANTUM_GOLD: 0xf1c40f as ColorResolvable, // Events/achievements

  // Status colors
  SUCCESS: 0x57f287 as ColorResolvable, // Confirmations/success
  ERROR: 0xed4245 as ColorResolvable, // Errors
  WARNING: 0xfee75c as ColorResolvable, // Warnings
  INFO: 0x5865f2 as ColorResolvable, // Information (Discord blurple)

  // Organization relationship colors
  ALLIED: 0x57f287 as ColorResolvable, // Allied organizations
  NEUTRAL: 0x9b59b6 as ColorResolvable, // Neutral organizations
  HOSTILE: 0xed4245 as ColorResolvable, // Hostile organizations

  // Activity/LFG colors
  OPEN: 0x57f287 as ColorResolvable, // Open/available
  FULL: 0xffa500 as ColorResolvable, // Full/at capacity
  CLOSED: 0x808080 as ColorResolvable, // Closed/inactive
} as const;

/**
 * Activity-type accent colors matching the frontend PublicJobCard design.
 * Maps participant roles / LFG activity types to branded accent colours.
 */
export const ActivityAccentColors: Record<string, number> = {
  // Participant roles (from PublicJobCard)
  pilot: 0x3b82f6, // Blue
  gunner: 0xef4444, // Red
  engineer: 0xf59e0b, // Amber
  medic: 0x06b6d4, // Cyan
  miner: 0xd97706, // Orange
  hauler: 0x8b5cf6, // Violet
  scout: 0x6366f1, // Indigo
  security: 0x10b981, // Emerald
  leadership: 0xec4899, // Pink
  support: 0x14b8a6, // Teal
  crew: 0x8b949e, // Gray
  // LFG activities
  pvp: 0xef4444, // Red
  pve: 0x3b82f6, // Blue
  mining: 0xd97706, // Orange
  trading: 0x8b5cf6, // Violet
  exploration: 0x6366f1, // Indigo
  bounty_hunting: 0xef4444, // Red
  cargo_hauling: 0xf59e0b, // Amber
  racing: 0xec4899, // Pink
};

/**
 * Resolves an accent colour from a role, LFG activity label, or ActivityType value.
 *
 * Priority:
 *  1. ActivityAccentColors[key] — role-based (pilot, miner) and LFG activity labels (pvp, mining)
 *  2. ACTIVITY_TYPE_CONFIG[key].colorHex — ActivityType values (mission, contract, job_listing…)
 *  3. EmbedColors.SC_BLUE — fallback
 */
export function getActivityAccentColor(key?: string): ColorResolvable {
  if (!key) {
    return EmbedColors.SC_BLUE;
  }
  const normalized = key.toLowerCase().replaceAll(/[\s-]/g, '_');
  if (ActivityAccentColors[normalized] !== undefined) {
    return ActivityAccentColors[normalized];
  }
  const typeCfg = ACTIVITY_TYPE_CONFIG[normalized];
  if (typeCfg) {
    return typeCfg.colorHex;
  }
  return EmbedColors.SC_BLUE;
}

/**
 * Status dot emojis for visual indicators
 */
export const StatusDots = {
  ONLINE: '🟢',
  AWAY: '🟡',
  BUSY: '🔴',
  OFFLINE: '⚫',
  PENDING: '⚪',
} as const;

/**
 * Discord timestamp format types
 * @see https://discord.com/developers/docs/reference#message-formatting-timestamp-styles
 */
export enum TimestampFormat {
  SHORT_TIME = 't', // 16:20
  LONG_TIME = 'T', // 16:20:30
  SHORT_DATE = 'd', // 20/04/2021
  LONG_DATE = 'D', // 20 April 2021
  SHORT_DATETIME = 'f', // 20 April 2021 16:20
  LONG_DATETIME = 'F', // Tuesday, 20 April 2021 16:20
  RELATIVE = 'R', // 2 months ago
}

/**
 * Creates a Discord timestamp string from a Date object
 * Discord will render this as a localized, dynamic timestamp
 *
 * @param date - The date to format
 * @param format - The timestamp format style (default: RELATIVE)
 * @returns Discord timestamp string (e.g., <t:1234567890:R>)
 *
 * @example
 * // Returns something like "<t:1234567890:R>" which Discord renders as "in 2 hours"
 * formatDiscordTimestamp(new Date(Date.now() + 7200000), TimestampFormat.RELATIVE);
 *
 * @example
 * // Returns "<t:1234567890:F>" which Discord renders as "Tuesday, 20 April 2021 16:20"
 * formatDiscordTimestamp(new Date(), TimestampFormat.LONG_DATETIME);
 */
export function formatDiscordTimestamp(
  date: Date,
  format: TimestampFormat = TimestampFormat.RELATIVE
): string {
  const unixTimestamp = Math.floor(date.getTime() / 1000);
  return `<t:${unixTimestamp}:${format}>`;
}

/**
 * Creates a relative Discord timestamp (e.g., "in 2 hours", "3 days ago")
 * Shorthand for formatDiscordTimestamp with RELATIVE format
 *
 * @param date - The date to format
 * @returns Discord relative timestamp string
 */
export function formatRelativeTime(date: Date): string {
  return formatDiscordTimestamp(date, TimestampFormat.RELATIVE);
}

/**
 * Visual style for {@link createProgressBar}.
 *
 * - `'gradient'` — coloured square emojis that warm up from red → orange →
 *   yellow → green along the length of the bar (a "thermometer" that heats up as
 *   it fills). This is the default and the most visually rich option for embeds.
 * - `'blocks'` — monochrome block characters (`█`/`░`); a compact fallback.
 */
export type ProgressBarStyle = 'gradient' | 'blocks';

/**
 * Ordered gradient colour stops, from "just started" to "full".
 * Standard Unicode square emojis — no custom server emojis required.
 */
const PROGRESS_GRADIENT_STOPS = ['🟥', '🟧', '🟨', '🟩'] as const;

/**
 * Progress bar configuration options
 */
export interface ProgressBarOptions {
  /** Number of cells in the bar (default: 10) */
  width?: number;
  /** Visual style of the bar (default: 'gradient') */
  style?: ProgressBarStyle;
  /** Character for filled cells in 'blocks' style (default: '█') */
  filledChar?: string;
  /** Character for empty cells (default: '⬛' for gradient, '░' for blocks) */
  emptyChar?: string;
  /** Show percentage after the bar (default: true) */
  showPercentage?: boolean;
}

/**
 * Picks the gradient colour for a filled cell from its position along the bar,
 * so the bar transitions red → orange → yellow → green as it fills up.
 */
function pickGradientCell(cellIndex: number, width: number): string {
  const ratio = width > 0 ? (cellIndex + 0.5) / width : 0;
  const stopIndex = Math.min(
    PROGRESS_GRADIENT_STOPS.length - 1,
    Math.floor(ratio * PROGRESS_GRADIENT_STOPS.length)
  );
  return PROGRESS_GRADIENT_STOPS[stopIndex];
}

/**
 * Creates a text-based progress bar for Discord embeds.
 *
 * By default the bar renders as a colour gradient of square emojis that flow
 * red → orange → yellow → green as it fills up. Pass `style: 'blocks'` for the
 * compact monochrome `█`/`░` rendering.
 *
 * @param current - Current value
 * @param max - Maximum value
 * @param options - Progress bar configuration
 * @returns Formatted progress bar string
 *
 * @example
 * // Gradient style (default): "🟥🟥🟧🟧🟧🟨🟨🟩⬛⬛ 80%"
 * createProgressBar(8, 10);
 *
 * @example
 * // Legacy block style: "█████░░░░░"
 * createProgressBar(5, 10, { style: 'blocks', showPercentage: false });
 */
export function createProgressBar(
  current: number,
  max: number,
  options: ProgressBarOptions = {}
): string {
  const { width = 10, style = 'gradient', showPercentage = true } = options;
  const filledChar = options.filledChar ?? '█';
  const emptyChar = options.emptyChar ?? (style === 'gradient' ? '⬛' : '░');

  // Ensure values are valid
  const clampedCurrent = Math.max(0, Math.min(current, max));
  const percentage = max > 0 ? (clampedCurrent / max) * 100 : 0;
  const filledCount = Math.round((percentage / 100) * width);

  let bar = '';
  if (style === 'gradient') {
    for (let cell = 0; cell < width; cell++) {
      bar += cell < filledCount ? pickGradientCell(cell, width) : emptyChar;
    }
  } else {
    bar = filledChar.repeat(filledCount) + emptyChar.repeat(width - filledCount);
  }

  return showPercentage ? `${bar} ${Math.round(percentage)}%` : bar;
}

/**
 * Creates a capacity indicator with visual feedback
 *
 * @param current - Current count
 * @param max - Maximum capacity
 * @returns Formatted capacity string with visual indicator
 *
 * @example
 * // Returns "🟢 5/10"
 * createCapacityIndicator(5, 10);
 *
 * @example
 * // Returns "🟡 10/10"
 * createCapacityIndicator(10, 10);
 */
export function createCapacityIndicator(current: number, max: number): string {
  const percentage = max > 0 ? (current / max) * 100 : 0;

  let indicator: string;
  if (percentage >= 100) {
    indicator = StatusDots.BUSY; // Full
  } else if (percentage >= 75) {
    indicator = StatusDots.AWAY; // Almost full
  } else {
    indicator = StatusDots.ONLINE; // Available
  }

  return `${indicator} ${current}/${max}`;
}

/**
 * Star Citizen Fleet Manager branded embed factory
 * Creates consistent, themed embeds for the Discord bot
 */
export class SCFleetEmbed {
  private embed: EmbedBuilder;

  private constructor() {
    this.embed = new EmbedBuilder();
  }

  /**
   * Creates a new branded embed with SC theme
   */
  static create(): SCFleetEmbed {
    return new SCFleetEmbed();
  }

  /**
   * Creates an info embed (blue theme)
   */
  static info(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.INFO).setTitle(title);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Creates a success embed (green theme)
   */
  static success(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.SUCCESS).setTitle(`✅ ${title}`);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Creates an error embed (red theme)
   */
  static error(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.ERROR).setTitle(`❌ ${title}`);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Creates a warning embed (yellow theme)
   */
  static warning(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.WARNING).setTitle(`⚠️ ${title}`);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Creates an event/achievement embed (gold theme)
   */
  static event(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.QUANTUM_GOLD).setTitle(`📅 ${title}`);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Creates a fleet/organization embed (SC blue theme)
   */
  static fleet(title: string, description?: string): SCFleetEmbed {
    const instance = new SCFleetEmbed();
    instance.embed.setColor(EmbedColors.SC_BLUE).setTitle(`🚀 ${title}`);
    if (description) {
      instance.embed.setDescription(description);
    }
    return instance;
  }

  /**
   * Sets the embed title
   */
  setTitle(title: string): SCFleetEmbed {
    this.embed.setTitle(title);
    return this;
  }

  /**
   * Sets the embed description
   */
  setDescription(description: string): SCFleetEmbed {
    this.embed.setDescription(description);
    return this;
  }

  /**
   * Sets the embed color
   */
  setColor(color: ColorResolvable): SCFleetEmbed {
    this.embed.setColor(color);
    return this;
  }

  /**
   * Adds fields to the embed
   */
  addFields(...fields: { name: string; value: string; inline?: boolean }[]): SCFleetEmbed {
    this.embed.addFields(...fields);
    return this;
  }

  /**
   * Sets the embed footer
   */
  setFooter(options: { text: string; iconURL?: string }): SCFleetEmbed {
    this.embed.setFooter(options);
    return this;
  }

  /**
   * Sets the embed thumbnail
   */
  setThumbnail(url: string): SCFleetEmbed {
    this.embed.setThumbnail(url);
    return this;
  }

  /**
   * Sets the embed image
   */
  setImage(url: string): SCFleetEmbed {
    this.embed.setImage(url);
    return this;
  }

  /**
   * Adds a timestamp to the embed
   */
  setTimestamp(date?: Date | number): SCFleetEmbed {
    this.embed.setTimestamp(date);
    return this;
  }

  /**
   * Adds author information
   */
  setAuthor(options: { name: string; iconURL?: string; url?: string }): SCFleetEmbed {
    this.embed.setAuthor(options);
    return this;
  }

  /**
   * Adds a progress bar field
   */
  addProgressField(
    name: string,
    current: number,
    max: number,
    options?: ProgressBarOptions & { inline?: boolean }
  ): SCFleetEmbed {
    const progressBar = createProgressBar(current, max, options);
    this.embed.addFields({
      name,
      value: progressBar,
      inline: options?.inline ?? false,
    });
    return this;
  }

  /**
   * Adds a timestamp field using Discord's native timestamp formatting
   */
  addTimestampField(
    name: string,
    date: Date,
    format: TimestampFormat = TimestampFormat.RELATIVE,
    inline?: boolean
  ): SCFleetEmbed {
    this.embed.addFields({
      name,
      value: formatDiscordTimestamp(date, format),
      inline: inline ?? true,
    });
    return this;
  }

  /**
   * Returns the built EmbedBuilder
   */
  build(): EmbedBuilder {
    return this.embed;
  }

  /**
   * Returns the embed data for Discord API
   */
  toJSON(): ReturnType<EmbedBuilder['toJSON']> {
    return this.embed.toJSON();
  }
}

// Note: Individual named exports above are preferred for tree-shaking and IDE support.
// Use: import { EmbedColors, SCFleetEmbed } from './embedBuilder';
