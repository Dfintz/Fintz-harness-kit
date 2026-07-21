import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

import { Poll, PollOption, PollStatus, PollType } from '../../models/Poll';
import { PollResults } from '../../services/poll/PollService';
import { buildAppUrl } from '../utils/appUrls';
import {
  createProgressBar,
  EmbedColors,
  formatDiscordTimestamp,
  SCFleetEmbed,
  TimestampFormat,
} from '../utils/embedBuilder';

// ==================== CONSTANTS ====================

const POLL_TYPE_LABELS: Record<PollType, string> = {
  [PollType.SINGLE_CHOICE]: 'Single Choice',
  [PollType.MULTIPLE_CHOICE]: 'Multiple Choice',
  [PollType.RANKED]: 'Ranked',
  [PollType.APPROVAL]: 'Approval',
};

const POLL_STATUS_EMOJI: Record<PollStatus, string> = {
  [PollStatus.DRAFT]: '📝',
  [PollStatus.ACTIVE]: '🟢',
  [PollStatus.CLOSED]: '🔒',
  [PollStatus.CANCELLED]: '❌',
};

/** Maximum options to render as buttons (Discord limit: 5 per action row, max 5 rows) */
const MAX_BUTTON_OPTIONS = 20;

// ==================== HELPER ====================

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ==================== EMBED BUILDER ====================

/**
 * Build a Discord embed for a poll, optionally with live results.
 *
 * - Active poll without results: shows options as a numbered list
 * - Active/closed poll with results: shows progress bars per option
 */
export function buildPollEmbed(poll: Poll, results?: PollResults): EmbedBuilder {
  const isClosed = poll.status === PollStatus.CLOSED || poll.status === PollStatus.CANCELLED;
  const statusEmoji = POLL_STATUS_EMOJI[poll.status] ?? '📊';

  let color: number;
  if (isClosed) {
    color = EmbedColors.CLOSED as number;
  } else if (poll.status === PollStatus.DRAFT) {
    color = EmbedColors.WARNING as number;
  } else {
    color = EmbedColors.INFO as number;
  }

  const builder = SCFleetEmbed.create()
    .setColor(color)
    .setTitle(`${statusEmoji}  ${truncate(decodeHtmlEntities(poll.title), 230)}`)
    .setTimestamp(poll.createdAt);

  // Description
  const descParts: string[] = [];
  if (poll.description) {
    descParts.push(truncate(decodeHtmlEntities(poll.description), 1500));
  }
  descParts.push(
    `**Type:** ${POLL_TYPE_LABELS[poll.pollType]} · **Status:** ${poll.status.toUpperCase()}`
  );

  if (poll.isAnonymous) {
    descParts.push('🔒 *Anonymous voting*');
  }
  if (poll.maxSelections > 1) {
    descParts.push(`You may select up to **${poll.maxSelections}** options`);
  }

  builder.setDescription(descParts.join('\n'));

  // Options / Results
  if (results) {
    buildResultsFields(builder, poll.options, results);
  } else {
    buildOptionsList(builder, poll.options);
  }

  // Ends At
  if (poll.endsAt) {
    const label = isClosed ? '🏁 Ended' : '⏰ Ends';
    builder.addFields({
      name: label,
      value: `${formatDiscordTimestamp(poll.endsAt, TimestampFormat.LONG_DATETIME)}\n${formatDiscordTimestamp(poll.endsAt, TimestampFormat.RELATIVE)}`,
      inline: true,
    });
  }

  // Total voters
  if (results) {
    builder.addFields({
      name: '🗳️ Total Voters',
      value: `**${results.totalVotes}** vote(s)`,
      inline: true,
    });
  }

  // Footer
  const footerText = isClosed
    ? `Poll ID: ${poll.id}  •  This poll is closed`
    : `Poll ID: ${poll.id}  •  Click a button below to vote`;
  builder.setFooter({ text: footerText });

  if (poll.createdByName) {
    builder.setAuthor({ name: `Created by ${decodeHtmlEntities(poll.createdByName)}` });
  }

  return builder.build().setURL(buildAppUrl('/polls'));
}

/**
 * Render option list when no results are available yet.
 */
function buildOptionsList(
  builder: ReturnType<typeof SCFleetEmbed.create>,
  options: PollOption[]
): void {
  const lines = options
    .slice(0, 25) // embed field limit safety
    .map((opt, i) => {
      const desc = opt.description ? ` — ${truncate(decodeHtmlEntities(opt.description), 80)}` : '';
      return `**${i + 1}.** ${decodeHtmlEntities(opt.label)}${desc}`;
    });

  builder.addFields({
    name: '📋 Options',
    value: lines.join('\n') || 'No options',
    inline: false,
  });
}

/**
 * Render results with progress bars per option.
 */
function buildResultsFields(
  builder: ReturnType<typeof SCFleetEmbed.create>,
  options: PollOption[],
  results: PollResults
): void {
  const maxVotes = Math.max(...results.options.map(o => o.voteCount), 1);

  const lines = results.options.slice(0, 25).map(opt => {
    const bar = createProgressBar(opt.voteCount, maxVotes, {
      width: 10,
      showPercentage: false,
    });
    return `${bar}  **${decodeHtmlEntities(opt.label)}** — ${opt.voteCount} vote(s) (${opt.percentage}%)`;
  });

  builder.addFields({
    name: '📊 Results',
    value: lines.join('\n') || 'No votes yet',
    inline: false,
  });
}

// ==================== BUTTON BUILDER ====================

/**
 * Build vote buttons for a poll's options.
 * Returns one or more ActionRows (max 5 per message, 5 buttons per row).
 *
 * CustomId format: `poll_vote_{optionIndex}_{pollId}`
 */
export function buildPollButtons(
  pollId: string,
  options: PollOption[],
  isClosed = false
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const capped = options.slice(0, MAX_BUTTON_OPTIONS);

  for (let i = 0; i < capped.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const chunk = capped.slice(i, i + 5);

    for (const [j, opt] of chunk.entries()) {
      const index = i + j;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`poll_vote_${index}_${pollId}`)
          .setLabel(truncate(decodeHtmlEntities(opt.label), 80))
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isClosed)
      );
    }

    rows.push(row);
  }

  // Add a "View Results" button in a separate row
  const utilRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`poll_results_${pollId}`)
      .setLabel('View Results')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊')
  );

  // Discord allows max 5 action rows — reserve 1 for utility
  if (rows.length < 5) {
    rows.push(utilRow);
  }

  return rows;
}

/**
 * Parse a poll interactive-button customId (embed buttons + list navigation).
 *
 * Formats:
 *  - `poll_vote_{optionIndex}_{pollId}` → { action: 'vote', optionIndex, pollId }
 *  - `poll_results_{pollId}` → { action: 'results', pollId }
 *  - `poll_close_{pollId}` → { action: 'close', pollId }
 *  - `poll_listpage_{page}` → { action: 'listpage', page } (active-poll list paging)
 */
export function parsePollButtonId(
  customId: string
):
  | { action: 'vote'; optionIndex: number; pollId: string }
  | { action: 'results' | 'close'; pollId: string }
  | { action: 'listpage'; page: number }
  | null {
  const voteRegex = /^poll_vote_(\d+)_(.+)$/;
  const voteMatch = voteRegex.exec(customId);
  if (voteMatch) {
    return {
      action: 'vote',
      optionIndex: Number.parseInt(voteMatch[1], 10),
      pollId: voteMatch[2],
    };
  }

  const listPageRegex = /^poll_listpage_(\d+)$/;
  const listPageMatch = listPageRegex.exec(customId);
  if (listPageMatch) {
    return {
      action: 'listpage',
      page: Number.parseInt(listPageMatch[1], 10),
    };
  }

  const simpleRegex = /^poll_(results|close)_(.+)$/;
  const simpleMatch = simpleRegex.exec(customId);
  if (simpleMatch) {
    return {
      action: simpleMatch[1] as 'results' | 'close',
      pollId: simpleMatch[2],
    };
  }

  return null;
}
