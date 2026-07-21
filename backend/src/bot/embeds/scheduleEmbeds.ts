import type { BestTimeWindow, GroupAvailabilityHeatmap } from '@sc-fleet-manager/shared-types';
import { EmbedBuilder } from 'discord.js';

import { buildAppUrl } from '../utils/appUrls';
import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';

/**
 * Pure builders for the `/schedule` command embeds (set guide, availability heatmap, best-time
 * windows, conflict checks, personal conflicts).
 *
 * Extracted from `commands/schedule.ts` so the embeds live in one place, render through the shared
 * `SCFleetEmbed` factory, and link to the web availability grid. Inputs are plain query parameters
 * plus narrow render shapes (the shared `BestTimeWindow`/`GroupAvailabilityHeatmap` and local
 * `ConflictSummary`/`UserConflictSummary`), keeping the builders decoupled from the services.
 */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BLOCK_CHARS = [' ', '\u2591', '\u2592', '\u2593', '\u2588'];

/** Map an availability count (relative to the max) to a shaded block character. */
function intensityChar(count: number, max: number): string {
  if (max === 0 || count === 0) {
    return BLOCK_CHARS[0];
  }
  const ratio = count / max;
  const idx = Math.min(Math.floor(ratio * (BLOCK_CHARS.length - 1)) + 1, BLOCK_CHARS.length - 1);
  return BLOCK_CHARS[idx];
}

/** Embed shown when no scheduling windows match the requested duration / attendee floor. */
export function buildNoTimeWindowsEmbed(duration: number, minAttendees: number): EmbedBuilder {
  return SCFleetEmbed.warning(
    'No Time Windows Found',
    `No ${duration}-minute windows found with at least ${minAttendees} attendees.\n` +
      'Try lowering the minimum attendees or ask more members to set their availability.'
  ).build();
}

/** Embed listing the top scheduling windows, with a clickable title deep link to the calendar. */
export function buildBestTimesEmbed(
  windows: readonly BestTimeWindow[],
  duration: number,
  minAttendees: number
): EmbedBuilder {
  const lines = windows.map(
    (w, i) => `**${i + 1}.** ${w.dayName} ${w.timeRange} \u2014 ${w.availableCount} available`
  );

  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`\u23f0 Best Times (${duration}min, \u2265${minAttendees} people)`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
    .build()
    .setURL(buildAppUrl('/calendar'));
}

/** Minimal shape needed to render one scheduling-conflict line. */
export interface ConflictSummary {
  activityTitle: string;
  conflictType: string;
}

/** Embed shown when a conflict check finds no overlaps in the requested range. */
export function buildNoConflictsEmbed(startStr: string, endStr: string): EmbedBuilder {
  return SCFleetEmbed.success(
    'No Conflicts',
    `No scheduling conflicts found between ${startStr} and ${endStr}.`
  ).build();
}

/** Embed listing scheduling conflicts, with a clickable title deep link to the calendar. */
export function buildConflictsListEmbed(
  conflicts: readonly ConflictSummary[],
  totalConflicts: number,
  startStr: string,
  endStr: string
): EmbedBuilder {
  const lines = conflicts
    .slice(0, 10)
    .map((c, i) => `**${i + 1}.** ${c.activityTitle || 'Event'} \u2014 ${c.conflictType} conflict`);

  return SCFleetEmbed.warning(`Scheduling Conflicts (${startStr} to ${endStr})`, lines.join('\n'))
    .setFooter({ text: `${totalConflicts} conflict(s) found` })
    .build()
    .setURL(buildAppUrl('/calendar'));
}

/** Embed directing members to the web availability grid (body CTA link, no title link). */
export function buildSetAvailabilityEmbed(): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F4C5} Set Your Availability')
    .setDescription(
      'Use the web app to mark your available times on the interactive weekly grid.\n\n' +
        `**[Open Availability Grid](${buildAppUrl('/calendar')})**\n\n` +
        'Navigate to the **Availability** tab and click-drag to select your available hours.'
    )
    .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
    .build();
}

/** Embed shown when no members have set their availability yet. */
export function buildNoAvailabilityEmbed(): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
    .setTitle('\u{1F4CA} Group Availability')
    .setDescription(
      'No members have set their availability yet.\nUse `/schedule set` to get started!'
    )
    .build()
    .setURL(buildAppUrl('/calendar'));
}

/** Embed rendering the group availability heatmap, with a clickable title deep link to the calendar. */
export function buildAvailabilityHeatmapEmbed(heatmap: GroupAvailabilityHeatmap): EmbedBuilder {
  // Build a compact text heatmap (show every 2 hours to fit Discord).
  const hoursToShow = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  let grid = `\`\`\`\n      ${hoursToShow.map(h => h.toString().padStart(2, '0')).join(' ')}\n`;
  for (let d = 0; d < 7; d++) {
    grid += `${DAY_LABELS[d].padEnd(4)}  `;
    for (const h of hoursToShow) {
      const cell = heatmap.cells.find(c => c.dayOfWeek === d && c.hour === h);
      grid += `${intensityChar(cell?.count ?? 0, heatmap.totalMembers)}  `;
    }
    grid += '\n';
  }
  grid += '```';
  grid += `\n\u2591 = few  \u2592 = some  \u2593 = many  \u2588 = most  (${heatmap.totalMembers} members)`;

  return SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle('\u{1F4CA} Group Availability Heatmap')
    .setDescription(grid)
    .setFooter({ text: 'SC Fleet Manager \u2014 Group Scheduling' })
    .build()
    .setURL(buildAppUrl('/calendar'));
}

/** Minimal shape needed to render one personal-conflict field. */
export interface UserConflictSummary {
  activityTitle: string;
  activityType: string;
  scheduledStartDate: Date;
  conflictReason: string;
}

/** Embed listing the caller's upcoming event conflicts, with a clickable calendar deep link. */
export function buildMyConflictsEmbed(
  conflicts: readonly UserConflictSummary[],
  totalConflicts: number
): EmbedBuilder {
  const hasConflicts = totalConflicts > 0;
  const builder = SCFleetEmbed.create()
    .setColor(hasConflicts ? EmbedColors.ERROR : EmbedColors.SUCCESS)
    .setTitle('\u{1F4CB} Your Event Conflicts')
    .setTimestamp();

  if (hasConflicts) {
    builder.setDescription(`You have ${totalConflicts} scheduling conflict(s).`);

    conflicts.slice(0, 10).forEach((conflict, index) => {
      const startStr = conflict.scheduledStartDate.toLocaleString();
      builder.addFields({
        name: `${index + 1}. ${conflict.activityTitle}`,
        value: `**Type:** ${conflict.activityType}\n**Time:** ${startStr}\n**Reason:** ${conflict.conflictReason}`,
        inline: false,
      });
    });

    if (totalConflicts > 10) {
      builder.setFooter({ text: `Showing 10 of ${totalConflicts} conflicts` });
    }
  } else {
    builder.setDescription('\u2705 You have no scheduling conflicts! Your calendar is clear.');
  }

  return builder.build().setURL(buildAppUrl('/calendar'));
}
