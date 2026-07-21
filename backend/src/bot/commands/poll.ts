import { randomUUID } from 'node:crypto';

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

import { Poll, PollOption, PollStatus, PollType } from '../../models/Poll';
import { PollMirrorStatus } from '../../models/PollDiscordMirror';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { DiscordPollService } from '../../services/poll/DiscordPollService';
import { PollService } from '../../services/poll/PollService';
import { UserService } from '../../services/user/UserService';
import { getErrorMessage } from '../../utils/errorHandler';
import { buildPollEmbed, parsePollButtonId } from '../embeds/pollEmbed';
import {
  type CommandPanelConfig,
  parsePanelCustomId,
  replyWithCommandPanel,
} from '../utils/commandPanelBuilder';
import { buildConfirmationPrompt, respondConfirmationCancelled } from '../utils/confirmationPrompt';
import { SCFleetEmbed } from '../utils/embedBuilder';
import { resolveOrgIdForGuild } from '../utils/guildContext';
import { buildPaginationRow, paginate } from '../utils/paginationControls';

import { BotCommand } from './types';

// ==================== SERVICE INSTANCES ====================

let _services: {
  pollService: PollService;
  discordPollService: DiscordPollService;
  guildOrgService: GuildOrganizationService;
  userService: UserService;
} | null = null;

function getServices(): {
  pollService: PollService;
  discordPollService: DiscordPollService;
  guildOrgService: GuildOrganizationService;
  userService: UserService;
} {
  _services ??= {
    pollService: new PollService(),
    discordPollService: new DiscordPollService(),
    guildOrgService: GuildOrganizationService.getInstance(),
    userService: new UserService(),
  };
  return _services;
}

/**
 * Resolve a Discord user ID to the linked platform account ID so that a vote cast on
 * Discord shares the same identity as a vote cast on the web. This prevents the same
 * person being counted twice and lets the web UI surface Discord-cast votes. Falls back
 * to the raw Discord ID when the user has not linked a platform account.
 */
async function resolveVoterId(discordUserId: string): Promise<string> {
  try {
    const user = await getServices().userService.getUserByDiscordId(discordUserId);
    return user?.id ?? discordUserId;
  } catch {
    return discordUserId;
  }
}

// ==================== PANEL CONFIG ====================

const POLL_PANEL_PREFIX = 'poll';

/** Items shown per page in the active-poll list (CMD-03 shared pagination). */
const POLL_LIST_PAGE_SIZE = 10;
/**
 * Upper bound on active polls fetched for the in-memory paged list. Active polls
 * per organization are bounded (they get closed), so a single capped fetch covers
 * the realistic set while the shared {@link paginate} primitive pages it client-side
 * — consistent with the ticket/giveaway/bounty list adopters.
 */
const POLL_LIST_FETCH_LIMIT = 100;

/** Poll-picker actions: panel buttons that operate on an existing active poll. */
type PollPickAction = 'post' | 'results' | 'close';

/** Discord caps a string select menu at 25 options. */
const POLL_PICKER_MAX_OPTIONS = 25;

/** Verb phrase per pick action, used in picker copy. */
const POLL_PICK_VERB: Record<PollPickAction, string> = {
  post: 'post',
  results: 'view results for',
  close: 'close',
};

const POLL_PANEL_CONFIG: CommandPanelConfig = {
  prefix: POLL_PANEL_PREFIX,
  title: '📊 Polls',
  description: 'Manage and view organization polls.',
  buttons: [
    { subcommand: 'create', label: 'Create Poll', emoji: '➕', style: ButtonStyle.Success },
    { subcommand: 'list', label: 'List Polls', emoji: '📋', style: ButtonStyle.Primary },
    { subcommand: 'post', label: 'Post Poll', emoji: '📢' },
    { subcommand: 'results', label: 'View Results', emoji: '📊' },
    { subcommand: 'close', label: 'Close Poll', emoji: '🔒', style: ButtonStyle.Danger },
  ],
};

// ==================== COMMAND ====================

export const poll: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create and manage organization polls on Discord'),

  cooldown: 5,
  category: 'organization',
  guildOnly: true,

  // ==================== EXECUTE (show panel) ====================

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await replyWithCommandPanel(interaction, POLL_PANEL_CONFIG);
  },

  // ==================== HANDLE BUTTON (panel + vote/results/close buttons) ====================

  async handleButton(interaction: ButtonInteraction): Promise<void> {
    // Close-confirmation follow-ups are routed first (see handleCloseConfirmation).
    if (await handleCloseConfirmation(interaction)) {
      return;
    }

    // --- Panel button routing ---
    const panelSub = parsePanelCustomId(interaction.customId, POLL_PANEL_PREFIX);
    if (panelSub) {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.reply({
          content: 'This action can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const orgId = await resolveOrgIdForGuild(guildId);
      if (!orgId) {
        await interaction.reply({
          embeds: [
            SCFleetEmbed.error(
              'Not Linked',
              'This server is not linked to an organization or federation.'
            ).build(),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      switch (panelSub) {
        case 'create':
          await showCreatePollModal(interaction);
          return;
        case 'list': {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          try {
            await handleListFromPanel(interaction, orgId);
          } catch (err) {
            await interaction.editReply({
              embeds: [SCFleetEmbed.error('Error', getErrorMessage(err)).build()],
            });
          }
          return;
        }
        case 'post':
          await showPollPicker(interaction, 'post', orgId);
          return;
        case 'results':
          await showPollPicker(interaction, 'results', orgId);
          return;
        case 'close':
          await showPollPicker(interaction, 'close', orgId);
          return;
      }
    }

    // --- Existing vote/results/close buttons on poll embeds ---
    const parsed = parsePollButtonId(interaction.customId);
    if (!parsed) {
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This action can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const orgId = await resolveOrgIdForGuild(guildId);
    if (!orgId) {
      await interaction.reply({
        embeds: [
          SCFleetEmbed.error(
            'Not Linked',
            'This server is not linked to an organization or federation.'
          ).build(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    switch (parsed.action) {
      case 'vote':
        await handleVoteButton(interaction, orgId, parsed.pollId, parsed.optionIndex);
        break;
      case 'results':
        await handleResultsButton(interaction, orgId, parsed.pollId);
        break;
      case 'close':
        await handleCloseButton(interaction, orgId, parsed.pollId);
        break;
      case 'listpage':
        await handlePollListPageButton(interaction, orgId, parsed.page);
        break;
    }
  },

  // ==================== HANDLE SELECT MENU (poll pickers) ====================

  async handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    await handlePollPick(interaction);
  },

  // ==================== HANDLE MODAL ====================

  async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: 'This action can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const orgId = await resolveOrgIdForGuild(guildId);
    if (!orgId) {
      await interaction.reply({
        embeds: [
          SCFleetEmbed.error(
            'Not Linked',
            'This server is not linked to an organization or federation.'
          ).build(),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { customId } = interaction;

    if (customId === 'poll_create_modal') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await handleCreateFromModal(interaction, orgId);
      } catch (err) {
        await interaction.editReply({
          embeds: [SCFleetEmbed.error('Error', getErrorMessage(err)).build()],
        });
      }
    }
  },
};

// ==================== MODAL BUILDERS ====================

async function showCreatePollModal(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder().setCustomId('poll_create_modal').setTitle('Create New Poll');

  const titleInput = new TextInputBuilder()
    .setCustomId('poll_title')
    .setPlaceholder('e.g. Next op night')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('poll_description')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(false);

  const optionsInput = new TextInputBuilder()
    .setCustomId('poll_options')
    .setPlaceholder('Friday\nSaturday\nSunday')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(2000)
    .setRequired(true);

  const typeInput = new TextInputBuilder()
    .setCustomId('poll_type')
    .setPlaceholder('single')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(false);

  const durationInput = new TextInputBuilder()
    .setCustomId('poll_duration_hours')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(5)
    .setRequired(false);

  const titleLabel = new LabelBuilder().setLabel('Title').setTextInputComponent(titleInput);
  const descriptionLabel = new LabelBuilder()
    .setLabel('Description (optional)')
    .setTextInputComponent(descriptionInput);
  const optionsLabel = new LabelBuilder()
    .setLabel('Options (one per line, 2-25)')
    .setTextInputComponent(optionsInput);
  const typeLabel = new LabelBuilder()
    .setLabel('Type: single or multiple')
    .setTextInputComponent(typeInput);
  const durationLabel = new LabelBuilder()
    .setLabel('Duration in hours (optional, e.g. 24)')
    .setTextInputComponent(durationInput);

  modal.addLabelComponents(titleLabel, descriptionLabel, optionsLabel, typeLabel, durationLabel);

  await interaction.showModal(modal);
}

async function showPollPicker(
  interaction: ButtonInteraction,
  action: PollPickAction,
  orgId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const polls = await fetchActivePolls(orgId);
  if (polls.length === 0) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.info(
          'No Active Polls',
          `Your organization has no active polls to ${POLL_PICK_VERB[action]}.`
        ).build(),
      ],
    });
    return;
  }

  const options = polls.slice(0, POLL_PICKER_MAX_OPTIONS).map(p => ({
    label: p.title.substring(0, 100),
    value: p.id,
    description: describePollOption(p),
  }));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`poll_pick_${action}`)
      .setPlaceholder(`Select a poll to ${POLL_PICK_VERB[action]}…`)
      .addOptions(options)
  );

  const truncatedNote =
    polls.length > POLL_PICKER_MAX_OPTIONS
      ? `\n\n_Showing the first ${POLL_PICKER_MAX_OPTIONS} of ${polls.length} active polls._`
      : '';

  await interaction.editReply({
    content: `Select a poll to ${POLL_PICK_VERB[action]}:${truncatedNote}`,
    components: [row],
  });
}

/** Plain-text select-option description for a poll (no Discord markup). */
function describePollOption(poll: Poll): string {
  const ends = poll.endsAt ? `ends ${poll.endsAt.toISOString().slice(0, 10)}` : 'no expiry';
  return `${poll.pollType} · ${ends}`.substring(0, 100);
}

/**
 * Route a poll picker selection (`poll_pick_<action>`) to the matching handler,
 * using the selected poll id from `interaction.values[0]`. Replaces the former
 * "type the Poll ID" modals (CMD-02 native picker).
 */
async function handlePollPick(interaction: StringSelectMenuInteraction): Promise<void> {
  const match = /^poll_pick_(post|results|close)$/.exec(interaction.customId);
  if (!match) {
    return;
  }
  const action = match[1] as PollPickAction;

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'This action can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const orgId = await resolveOrgIdForGuild(guildId);
  if (!orgId) {
    await interaction.reply({
      embeds: [
        SCFleetEmbed.error(
          'Not Linked',
          'This server is not linked to an organization or federation.'
        ).build(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const pollId = interaction.values[0];
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    switch (action) {
      case 'post':
        await handlePostPoll(interaction, orgId, pollId);
        break;
      case 'results':
        await handleResultsPoll(interaction, orgId, pollId);
        break;
      case 'close':
        await promptCloseConfirmation(interaction, orgId, pollId);
        break;
    }
  } catch (err) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Error', getErrorMessage(err)).build()],
    });
  }
}

// ==================== PANEL HANDLERS ====================

async function handleListFromPanel(interaction: ButtonInteraction, orgId: string): Promise<void> {
  const polls = await fetchActivePolls(orgId);

  if (polls.length === 0) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.info('No Active Polls', 'Your organization has no active polls.').build(),
      ],
    });
    return;
  }

  await interaction.editReply(_buildPollListView(polls, 0));
}

/** Page through the organization's active polls via the shared pagination row. */
async function handlePollListPageButton(
  interaction: ButtonInteraction,
  orgId: string,
  page: number
): Promise<void> {
  const polls = await fetchActivePolls(orgId);

  if (polls.length === 0) {
    // The list emptied out since it was opened — collapse the controls.
    await interaction.update({
      embeds: [
        SCFleetEmbed.info('No Active Polls', 'Your organization has no active polls.').build(),
      ],
      components: [],
    });
    return;
  }

  // Edit the existing ephemeral list message in place (no new reply).
  await interaction.update(_buildPollListView(polls, page));
}

/** Fetch the organization's active polls (full bounded set; paged client-side). */
async function fetchActivePolls(orgId: string): Promise<Poll[]> {
  const result = await getServices().pollService.listPolls(
    orgId,
    { status: PollStatus.ACTIVE },
    { page: 1, limit: POLL_LIST_FETCH_LIMIT }
  );
  return result.data;
}

/**
 * Build the embed + pagination controls for one page of active polls. Pure — the
 * caller decides `editReply` (initial) vs `update` (paging).
 */
function _buildPollListView(
  polls: Poll[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const { pageItems, page: currentPage, totalPages } = paginate(polls, page, POLL_LIST_PAGE_SIZE);

  const lines = pageItems.map((p: Poll, i: number) => {
    const position = currentPage * POLL_LIST_PAGE_SIZE + i + 1;
    const endTime = p.endsAt ? `<t:${Math.floor(p.endsAt.getTime() / 1000)}:R>` : 'No expiry';
    return `**${position}.** ${p.title}\n   Type: \`${p.pollType}\` · Ends: ${endTime}\n   ID: \`${p.id}\``;
  });

  const embed = SCFleetEmbed.info('📊 Active Polls', lines.join('\n\n'))
    .setFooter({ text: 'Use "Post Poll" to post a poll to this channel' })
    .build();

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage => `poll_listpage_${targetPage}`,
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}

async function handleCreateFromModal(
  interaction: ModalSubmitInteraction,
  orgId: string
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error('Server Required', 'This action can only be used in a server.').build(),
      ],
    });
    return;
  }
  const channelId = interaction.channelId;
  if (!channelId) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error(
          'Channel Unavailable',
          'Could not determine a target channel for this action.'
        ).build(),
      ],
    });
    return;
  }

  const title = interaction.fields.getTextInputValue('poll_title').trim();
  const description = interaction.fields.getTextInputValue('poll_description').trim();
  const optionsRaw = interaction.fields.getTextInputValue('poll_options');
  const typeRaw = interaction.fields.getTextInputValue('poll_type').trim().toLowerCase();
  const durationRaw = interaction.fields.getTextInputValue('poll_duration_hours').trim();

  const optionLabels = optionsRaw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (optionLabels.length < 2 || optionLabels.length > 25) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error(
          'Invalid Options',
          'Provide between 2 and 25 options, one per line.'
        ).build(),
      ],
    });
    return;
  }

  const isMultiple = typeRaw === 'multiple' || typeRaw === 'multi' || typeRaw === 'm';
  const pollType = isMultiple ? PollType.MULTIPLE_CHOICE : PollType.SINGLE_CHOICE;

  let endsAt: Date | undefined;
  if (durationRaw.length > 0) {
    const hours = Number(durationRaw);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
      await interaction.editReply({
        embeds: [
          SCFleetEmbed.error(
            'Invalid Duration',
            'Duration must be a positive number of hours (max 720).'
          ).build(),
        ],
      });
      return;
    }
    endsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  const options: PollOption[] = optionLabels.map((label, index) => ({
    id: randomUUID(),
    label,
    sortOrder: index,
  }));

  const created = await getServices().pollService.createPoll(
    orgId,
    interaction.user.id,
    interaction.user.username,
    {
      title,
      description: description.length > 0 ? description : undefined,
      pollType,
      options,
      maxSelections: isMultiple ? optionLabels.length : 1,
      endsAt,
      status: PollStatus.ACTIVE,
    }
  );

  // Auto-mirror to the channel the modal was submitted from so it appears in Discord immediately.
  const mirror = await getServices().discordPollService.mirrorPollToGuild(created, orgId, {
    guildId,
    channelId,
  });

  if (mirror.status === PollMirrorStatus.FAILED) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.warning(
          'Poll Created (Post Failed)',
          `**${created.title}** was created (ID: \`${created.id}\`) but could not be posted: ${mirror.errorMessage ?? 'unknown error'}.`
        ).build(),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      SCFleetEmbed.success(
        'Poll Created',
        `**${created.title}** has been created and posted to this channel.\nPoll ID: \`${created.id}\``
      ).build(),
    ],
  });
}

async function handlePostPoll(
  interaction: StringSelectMenuInteraction,
  orgId: string,
  pollId: string
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error('Server Required', 'This action can only be used in a server.').build(),
      ],
    });
    return;
  }
  const channelId = interaction.channelId;
  if (!channelId) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error(
          'Channel Unavailable',
          'Could not determine a target channel for this action.'
        ).build(),
      ],
    });
    return;
  }

  const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
  if (!existingPoll) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Not Found', 'Poll not found in your organization.').build()],
    });
    return;
  }

  if (existingPoll.status !== PollStatus.ACTIVE) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.warning('Not Active', 'Only active polls can be posted to Discord.').build(),
      ],
    });
    return;
  }

  const mirror = await getServices().discordPollService.mirrorPollToGuild(existingPoll, orgId, {
    guildId,
    channelId,
  });

  if (mirror.status === PollMirrorStatus.FAILED) {
    await interaction.editReply({
      embeds: [
        SCFleetEmbed.error(
          'Delivery Failed',
          mirror.errorMessage ?? 'Failed to post poll embed.'
        ).build(),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      SCFleetEmbed.success(
        'Poll Posted',
        `**${existingPoll.title}** has been posted to this channel.`
      ).build(),
    ],
  });
}

async function handleResultsPoll(
  interaction: StringSelectMenuInteraction,
  orgId: string,
  pollId: string
): Promise<void> {
  const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
  if (!existingPoll) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Not Found', 'Poll not found.').build()],
    });
    return;
  }

  const results = await getServices().pollService.getResults(orgId, pollId, interaction.user.id);
  if (!results) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Not Found', 'Could not retrieve results.').build()],
    });
    return;
  }

  const embed = buildPollEmbed(existingPoll, results);
  await interaction.editReply({ embeds: [embed] });
}

async function promptCloseConfirmation(
  interaction: StringSelectMenuInteraction,
  orgId: string,
  pollId: string
): Promise<void> {
  // Confirm-by-default (C2): resolve the poll first so the prompt can name it,
  // and reject already-closed/missing polls before asking. The real close runs
  // on the `poll_confirmclose_<id>` button via handleCloseButton.
  const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
  if (!existingPoll) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Not Found', 'Poll not found or already closed.').build()],
    });
    return;
  }
  if (existingPoll.status !== PollStatus.ACTIVE) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.warning('Already Closed', 'This poll is already closed.').build()],
    });
    return;
  }

  const prompt = buildConfirmationPrompt({
    confirmCustomId: `poll_confirmclose_${pollId}`,
    cancelCustomId: `poll_canceldismiss_${pollId}`,
    message: `close the poll **${existingPoll.title}**`,
    confirmLabel: 'Close Poll',
  });
  await interaction.editReply({ content: prompt.content, components: prompt.components });
}

// ==================== BUTTON HANDLERS (vote/results/close on poll embeds) ====================

async function handleVoteButton(
  interaction: ButtonInteraction,
  orgId: string,
  pollId: string,
  optionIndex: number
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
    if (!existingPoll) {
      await interaction.editReply({
        embeds: [SCFleetEmbed.error('Not Found', 'This poll no longer exists.').build()],
      });
      return;
    }

    if (existingPoll.status !== PollStatus.ACTIVE) {
      await interaction.editReply({
        embeds: [
          SCFleetEmbed.warning('Poll Closed', 'This poll is no longer accepting votes.').build(),
        ],
      });
      return;
    }

    const option = existingPoll.options[optionIndex];
    if (!option) {
      await interaction.editReply({
        embeds: [SCFleetEmbed.error('Invalid Option', 'This option no longer exists.').build()],
      });
      return;
    }

    // Resolve the Discord user to their linked platform account so votes cast on
    // Discord and on the web deduplicate against a single identity.
    const voterId = await resolveVoterId(interaction.user.id);

    // Toggle semantics: each Discord button press toggles a single option. For
    // multiple-choice/approval polls this lets a user accumulate selections instead
    // of each press overwriting the previous one.
    const { selected, selectedOptionIds } = await getServices().pollService.toggleVote(
      orgId,
      pollId,
      voterId,
      option.id
    );

    const allowsMultiple =
      existingPoll.pollType === PollType.MULTIPLE_CHOICE ||
      existingPoll.pollType === PollType.APPROVAL;

    if (allowsMultiple) {
      const selectedLabels = existingPoll.options
        .filter(o => selectedOptionIds.includes(o.id))
        .map(o => `**${o.label}**`);
      const summary =
        selectedLabels.length > 0
          ? `Your current selections: ${selectedLabels.join(', ')}`
          : 'You have no selections. Tap an option to vote.';
      await interaction.editReply({
        embeds: [
          SCFleetEmbed.success(
            selected ? 'Selection Added' : 'Selection Removed',
            `${selected ? 'Added' : 'Removed'} **${option.label}**.\n${summary}`
          ).build(),
        ],
      });
    } else if (selected) {
      await interaction.editReply({
        embeds: [
          SCFleetEmbed.success('Vote Recorded', `You voted for **${option.label}**.`).build(),
        ],
      });
    } else {
      await interaction.editReply({
        embeds: [
          SCFleetEmbed.success(
            'Vote Cleared',
            `Your vote for **${option.label}** was removed.`
          ).build(),
        ],
      });
    }

    // Mirror updates are handled by getServices().pollService.castVote fire-and-forget hooks
  } catch (err) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Vote Failed', getErrorMessage(err)).build()],
    });
  }
}

async function handleResultsButton(
  interaction: ButtonInteraction,
  orgId: string,
  pollId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
    if (!existingPoll) {
      await interaction.editReply({
        embeds: [SCFleetEmbed.error('Not Found', 'This poll no longer exists.').build()],
      });
      return;
    }

    const results = await getServices().pollService.getResults(orgId, pollId, interaction.user.id);
    if (!results) {
      await interaction.editReply({
        embeds: [SCFleetEmbed.error('Not Found', 'Could not retrieve results.').build()],
      });
      return;
    }

    const embed = buildPollEmbed(existingPoll, results);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Error', getErrorMessage(err)).build()],
    });
  }
}

/**
 * Route the two close-confirmation follow-up buttons (`poll_confirmclose_<id>` /
 * `poll_canceldismiss_<id>`). These carry no `_panel_` segment and use action
 * words `parsePollButtonId` does not recognize, so `handleButton` dispatches them
 * here first. Returns `true` when the interaction was handled.
 */
async function handleCloseConfirmation(interaction: ButtonInteraction): Promise<boolean> {
  const confirmPrefix = 'poll_confirmclose_';
  const cancelPrefix = 'poll_canceldismiss_';

  if (interaction.customId.startsWith(cancelPrefix)) {
    await respondConfirmationCancelled(interaction);
    return true;
  }

  if (!interaction.customId.startsWith(confirmPrefix)) {
    return false;
  }

  const pollId = interaction.customId.slice(confirmPrefix.length);
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({
      content: 'This action can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  const orgId = await resolveOrgIdForGuild(guildId);
  if (!orgId) {
    await interaction.reply({
      embeds: [
        SCFleetEmbed.error(
          'Not Linked',
          'This server is not linked to an organization or federation.'
        ).build(),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  await handleCloseButton(interaction, orgId, pollId);
  return true;
}

async function handleCloseButton(
  interaction: ButtonInteraction,
  orgId: string,
  pollId: string
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const closed = await getServices().pollService.closePoll(
      orgId,
      pollId,
      interaction.user.id,
      interaction.user.username
    );
    if (!closed) {
      await interaction.editReply({
        embeds: [SCFleetEmbed.error('Not Found', 'This poll not found or already closed.').build()],
      });
      return;
    }

    // Mirror closures are handled by getServices().pollService.closePoll fire-and-forget hooks

    await interaction.editReply({
      embeds: [SCFleetEmbed.success('Poll Closed', `**${closed.title}** has been closed.`).build()],
    });
  } catch (err) {
    await interaction.editReply({
      embeds: [SCFleetEmbed.error('Error', getErrorMessage(err)).build()],
    });
  }
}
