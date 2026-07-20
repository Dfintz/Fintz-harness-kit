"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poll = void 0;
const node_crypto_1 = require("node:crypto");
const discord_js_1 = require("discord.js");
const Poll_1 = require("../../models/Poll");
const PollDiscordMirror_1 = require("../../models/PollDiscordMirror");
const GuildOrganizationService_1 = require("../../services/discord/GuildOrganizationService");
const DiscordPollService_1 = require("../../services/poll/DiscordPollService");
const PollService_1 = require("../../services/poll/PollService");
const UserService_1 = require("../../services/user/UserService");
const errorHandler_1 = require("../../utils/errorHandler");
const pollEmbed_1 = require("../embeds/pollEmbed");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const embedBuilder_1 = require("../utils/embedBuilder");
const guildContext_1 = require("../utils/guildContext");
const paginationControls_1 = require("../utils/paginationControls");
let _services = null;
function getServices() {
    _services ??= {
        pollService: new PollService_1.PollService(),
        discordPollService: new DiscordPollService_1.DiscordPollService(),
        guildOrgService: GuildOrganizationService_1.GuildOrganizationService.getInstance(),
        userService: new UserService_1.UserService(),
    };
    return _services;
}
async function resolveVoterId(discordUserId) {
    try {
        const user = await getServices().userService.getUserByDiscordId(discordUserId);
        return user?.id ?? discordUserId;
    }
    catch {
        return discordUserId;
    }
}
const POLL_PANEL_PREFIX = 'poll';
const POLL_LIST_PAGE_SIZE = 10;
const POLL_LIST_FETCH_LIMIT = 100;
const POLL_PICKER_MAX_OPTIONS = 25;
const POLL_PICK_VERB = {
    post: 'post',
    results: 'view results for',
    close: 'close',
};
const POLL_PANEL_CONFIG = {
    prefix: POLL_PANEL_PREFIX,
    title: '📊 Polls',
    description: 'Manage and view organization polls.',
    buttons: [
        { subcommand: 'create', label: 'Create Poll', emoji: '➕', style: discord_js_1.ButtonStyle.Success },
        { subcommand: 'list', label: 'List Polls', emoji: '📋', style: discord_js_1.ButtonStyle.Primary },
        { subcommand: 'post', label: 'Post Poll', emoji: '📢' },
        { subcommand: 'results', label: 'View Results', emoji: '📊' },
        { subcommand: 'close', label: 'Close Poll', emoji: '🔒', style: discord_js_1.ButtonStyle.Danger },
    ],
};
exports.poll = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create and manage organization polls on Discord'),
    cooldown: 5,
    category: 'organization',
    guildOnly: true,
    async execute(interaction) {
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, POLL_PANEL_CONFIG);
    },
    async handleButton(interaction) {
        if (await handleCloseConfirmation(interaction)) {
            return;
        }
        const panelSub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, POLL_PANEL_PREFIX);
        if (panelSub) {
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.reply({
                    content: 'This action can only be used in a server.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
            if (!orgId) {
                await interaction.reply({
                    embeds: [
                        embedBuilder_1.SCFleetEmbed.error('Not Linked', 'This server is not linked to an organization or federation.').build(),
                    ],
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            switch (panelSub) {
                case 'create':
                    await showCreatePollModal(interaction);
                    return;
                case 'list': {
                    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                    try {
                        await handleListFromPanel(interaction, orgId);
                    }
                    catch (err) {
                        await interaction.editReply({
                            embeds: [embedBuilder_1.SCFleetEmbed.error('Error', (0, errorHandler_1.getErrorMessage)(err)).build()],
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
        const parsed = (0, pollEmbed_1.parsePollButtonId)(interaction.customId);
        if (!parsed) {
            return;
        }
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({
                content: 'This action can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
        if (!orgId) {
            await interaction.reply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.error('Not Linked', 'This server is not linked to an organization or federation.').build(),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
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
    async handleSelectMenu(interaction) {
        await handlePollPick(interaction);
    },
    async handleModal(interaction) {
        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.reply({
                content: 'This action can only be used in a server.',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
        if (!orgId) {
            await interaction.reply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.error('Not Linked', 'This server is not linked to an organization or federation.').build(),
                ],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        const { customId } = interaction;
        if (customId === 'poll_create_modal') {
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                await handleCreateFromModal(interaction, orgId);
            }
            catch (err) {
                await interaction.editReply({
                    embeds: [embedBuilder_1.SCFleetEmbed.error('Error', (0, errorHandler_1.getErrorMessage)(err)).build()],
                });
            }
        }
    },
};
async function showCreatePollModal(interaction) {
    const modal = new discord_js_1.ModalBuilder().setCustomId('poll_create_modal').setTitle('Create New Poll');
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('poll_title')
        .setPlaceholder('e.g. Next op night')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(200)
        .setRequired(true);
    const descriptionInput = new discord_js_1.TextInputBuilder()
        .setCustomId('poll_description')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(false);
    const optionsInput = new discord_js_1.TextInputBuilder()
        .setCustomId('poll_options')
        .setPlaceholder('Friday\nSaturday\nSunday')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true);
    const typeInput = new discord_js_1.TextInputBuilder()
        .setCustomId('poll_type')
        .setPlaceholder('single')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(10)
        .setRequired(false);
    const durationInput = new discord_js_1.TextInputBuilder()
        .setCustomId('poll_duration_hours')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(5)
        .setRequired(false);
    const titleLabel = new discord_js_1.LabelBuilder().setLabel('Title').setTextInputComponent(titleInput);
    const descriptionLabel = new discord_js_1.LabelBuilder()
        .setLabel('Description (optional)')
        .setTextInputComponent(descriptionInput);
    const optionsLabel = new discord_js_1.LabelBuilder()
        .setLabel('Options (one per line, 2-25)')
        .setTextInputComponent(optionsInput);
    const typeLabel = new discord_js_1.LabelBuilder()
        .setLabel('Type: single or multiple')
        .setTextInputComponent(typeInput);
    const durationLabel = new discord_js_1.LabelBuilder()
        .setLabel('Duration in hours (optional, e.g. 24)')
        .setTextInputComponent(durationInput);
    modal.addLabelComponents(titleLabel, descriptionLabel, optionsLabel, typeLabel, durationLabel);
    await interaction.showModal(modal);
}
async function showPollPicker(interaction, action, orgId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const polls = await fetchActivePolls(orgId);
    if (polls.length === 0) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.info('No Active Polls', `Your organization has no active polls to ${POLL_PICK_VERB[action]}.`).build(),
            ],
        });
        return;
    }
    const options = polls.slice(0, POLL_PICKER_MAX_OPTIONS).map(p => ({
        label: p.title.substring(0, 100),
        value: p.id,
        description: describePollOption(p),
    }));
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`poll_pick_${action}`)
        .setPlaceholder(`Select a poll to ${POLL_PICK_VERB[action]}…`)
        .addOptions(options));
    const truncatedNote = polls.length > POLL_PICKER_MAX_OPTIONS
        ? `\n\n_Showing the first ${POLL_PICKER_MAX_OPTIONS} of ${polls.length} active polls._`
        : '';
    await interaction.editReply({
        content: `Select a poll to ${POLL_PICK_VERB[action]}:${truncatedNote}`,
        components: [row],
    });
}
function describePollOption(poll) {
    const ends = poll.endsAt ? `ends ${poll.endsAt.toISOString().slice(0, 10)}` : 'no expiry';
    return `${poll.pollType} · ${ends}`.substring(0, 100);
}
async function handlePollPick(interaction) {
    const match = /^poll_pick_(post|results|close)$/.exec(interaction.customId);
    if (!match) {
        return;
    }
    const action = match[1];
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({
            content: 'This action can only be used in a server.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
    if (!orgId) {
        await interaction.reply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Not Linked', 'This server is not linked to an organization or federation.').build(),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const pollId = interaction.values[0];
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
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
    }
    catch (err) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Error', (0, errorHandler_1.getErrorMessage)(err)).build()],
        });
    }
}
async function handleListFromPanel(interaction, orgId) {
    const polls = await fetchActivePolls(orgId);
    if (polls.length === 0) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.info('No Active Polls', 'Your organization has no active polls.').build(),
            ],
        });
        return;
    }
    await interaction.editReply(_buildPollListView(polls, 0));
}
async function handlePollListPageButton(interaction, orgId, page) {
    const polls = await fetchActivePolls(orgId);
    if (polls.length === 0) {
        await interaction.update({
            embeds: [
                embedBuilder_1.SCFleetEmbed.info('No Active Polls', 'Your organization has no active polls.').build(),
            ],
            components: [],
        });
        return;
    }
    await interaction.update(_buildPollListView(polls, page));
}
async function fetchActivePolls(orgId) {
    const result = await getServices().pollService.listPolls(orgId, { status: Poll_1.PollStatus.ACTIVE }, { page: 1, limit: POLL_LIST_FETCH_LIMIT });
    return result.data;
}
function _buildPollListView(polls, page) {
    const { pageItems, page: currentPage, totalPages } = (0, paginationControls_1.paginate)(polls, page, POLL_LIST_PAGE_SIZE);
    const lines = pageItems.map((p, i) => {
        const position = currentPage * POLL_LIST_PAGE_SIZE + i + 1;
        const endTime = p.endsAt ? `<t:${Math.floor(p.endsAt.getTime() / 1000)}:R>` : 'No expiry';
        return `**${position}.** ${p.title}\n   Type: \`${p.pollType}\` · Ends: ${endTime}\n   ID: \`${p.id}\``;
    });
    const embed = embedBuilder_1.SCFleetEmbed.info('📊 Active Polls', lines.join('\n\n'))
        .setFooter({ text: 'Use "Post Poll" to post a poll to this channel' })
        .build();
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => `poll_listpage_${targetPage}`,
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function handleCreateFromModal(interaction, orgId) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Server Required', 'This action can only be used in a server.').build(),
            ],
        });
        return;
    }
    const channelId = interaction.channelId;
    if (!channelId) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Channel Unavailable', 'Could not determine a target channel for this action.').build(),
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
                embedBuilder_1.SCFleetEmbed.error('Invalid Options', 'Provide between 2 and 25 options, one per line.').build(),
            ],
        });
        return;
    }
    const isMultiple = typeRaw === 'multiple' || typeRaw === 'multi' || typeRaw === 'm';
    const pollType = isMultiple ? Poll_1.PollType.MULTIPLE_CHOICE : Poll_1.PollType.SINGLE_CHOICE;
    let endsAt;
    if (durationRaw.length > 0) {
        const hours = Number(durationRaw);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 30) {
            await interaction.editReply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.error('Invalid Duration', 'Duration must be a positive number of hours (max 720).').build(),
                ],
            });
            return;
        }
        endsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }
    const options = optionLabels.map((label, index) => ({
        id: (0, node_crypto_1.randomUUID)(),
        label,
        sortOrder: index,
    }));
    const created = await getServices().pollService.createPoll(orgId, interaction.user.id, interaction.user.username, {
        title,
        description: description.length > 0 ? description : undefined,
        pollType,
        options,
        maxSelections: isMultiple ? optionLabels.length : 1,
        endsAt,
        status: Poll_1.PollStatus.ACTIVE,
    });
    const mirror = await getServices().discordPollService.mirrorPollToGuild(created, orgId, {
        guildId,
        channelId,
    });
    if (mirror.status === PollDiscordMirror_1.PollMirrorStatus.FAILED) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.warning('Poll Created (Post Failed)', `**${created.title}** was created (ID: \`${created.id}\`) but could not be posted: ${mirror.errorMessage ?? 'unknown error'}.`).build(),
            ],
        });
        return;
    }
    await interaction.editReply({
        embeds: [
            embedBuilder_1.SCFleetEmbed.success('Poll Created', `**${created.title}** has been created and posted to this channel.\nPoll ID: \`${created.id}\``).build(),
        ],
    });
}
async function handlePostPoll(interaction, orgId, pollId) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Server Required', 'This action can only be used in a server.').build(),
            ],
        });
        return;
    }
    const channelId = interaction.channelId;
    if (!channelId) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Channel Unavailable', 'Could not determine a target channel for this action.').build(),
            ],
        });
        return;
    }
    const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
    if (!existingPoll) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'Poll not found in your organization.').build()],
        });
        return;
    }
    if (existingPoll.status !== Poll_1.PollStatus.ACTIVE) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.warning('Not Active', 'Only active polls can be posted to Discord.').build(),
            ],
        });
        return;
    }
    const mirror = await getServices().discordPollService.mirrorPollToGuild(existingPoll, orgId, {
        guildId,
        channelId,
    });
    if (mirror.status === PollDiscordMirror_1.PollMirrorStatus.FAILED) {
        await interaction.editReply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Delivery Failed', mirror.errorMessage ?? 'Failed to post poll embed.').build(),
            ],
        });
        return;
    }
    await interaction.editReply({
        embeds: [
            embedBuilder_1.SCFleetEmbed.success('Poll Posted', `**${existingPoll.title}** has been posted to this channel.`).build(),
        ],
    });
}
async function handleResultsPoll(interaction, orgId, pollId) {
    const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
    if (!existingPoll) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'Poll not found.').build()],
        });
        return;
    }
    const results = await getServices().pollService.getResults(orgId, pollId, interaction.user.id);
    if (!results) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'Could not retrieve results.').build()],
        });
        return;
    }
    const embed = (0, pollEmbed_1.buildPollEmbed)(existingPoll, results);
    await interaction.editReply({ embeds: [embed] });
}
async function promptCloseConfirmation(interaction, orgId, pollId) {
    const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
    if (!existingPoll) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'Poll not found or already closed.').build()],
        });
        return;
    }
    if (existingPoll.status !== Poll_1.PollStatus.ACTIVE) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.warning('Already Closed', 'This poll is already closed.').build()],
        });
        return;
    }
    const prompt = (0, confirmationPrompt_1.buildConfirmationPrompt)({
        confirmCustomId: `poll_confirmclose_${pollId}`,
        cancelCustomId: `poll_canceldismiss_${pollId}`,
        message: `close the poll **${existingPoll.title}**`,
        confirmLabel: 'Close Poll',
    });
    await interaction.editReply({ content: prompt.content, components: prompt.components });
}
async function handleVoteButton(interaction, orgId, pollId, optionIndex) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
        if (!existingPoll) {
            await interaction.editReply({
                embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'This poll no longer exists.').build()],
            });
            return;
        }
        if (existingPoll.status !== Poll_1.PollStatus.ACTIVE) {
            await interaction.editReply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.warning('Poll Closed', 'This poll is no longer accepting votes.').build(),
                ],
            });
            return;
        }
        const option = existingPoll.options[optionIndex];
        if (!option) {
            await interaction.editReply({
                embeds: [embedBuilder_1.SCFleetEmbed.error('Invalid Option', 'This option no longer exists.').build()],
            });
            return;
        }
        const voterId = await resolveVoterId(interaction.user.id);
        const { selected, selectedOptionIds } = await getServices().pollService.toggleVote(orgId, pollId, voterId, option.id);
        const allowsMultiple = existingPoll.pollType === Poll_1.PollType.MULTIPLE_CHOICE ||
            existingPoll.pollType === Poll_1.PollType.APPROVAL;
        if (allowsMultiple) {
            const selectedLabels = existingPoll.options
                .filter(o => selectedOptionIds.includes(o.id))
                .map(o => `**${o.label}**`);
            const summary = selectedLabels.length > 0
                ? `Your current selections: ${selectedLabels.join(', ')}`
                : 'You have no selections. Tap an option to vote.';
            await interaction.editReply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.success(selected ? 'Selection Added' : 'Selection Removed', `${selected ? 'Added' : 'Removed'} **${option.label}**.\n${summary}`).build(),
                ],
            });
        }
        else if (selected) {
            await interaction.editReply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.success('Vote Recorded', `You voted for **${option.label}**.`).build(),
                ],
            });
        }
        else {
            await interaction.editReply({
                embeds: [
                    embedBuilder_1.SCFleetEmbed.success('Vote Cleared', `Your vote for **${option.label}** was removed.`).build(),
                ],
            });
        }
    }
    catch (err) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Vote Failed', (0, errorHandler_1.getErrorMessage)(err)).build()],
        });
    }
}
async function handleResultsButton(interaction, orgId, pollId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const existingPoll = await getServices().pollService.getPollById(orgId, pollId);
        if (!existingPoll) {
            await interaction.editReply({
                embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'This poll no longer exists.').build()],
            });
            return;
        }
        const results = await getServices().pollService.getResults(orgId, pollId, interaction.user.id);
        if (!results) {
            await interaction.editReply({
                embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'Could not retrieve results.').build()],
            });
            return;
        }
        const embed = (0, pollEmbed_1.buildPollEmbed)(existingPoll, results);
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Error', (0, errorHandler_1.getErrorMessage)(err)).build()],
        });
    }
}
async function handleCloseConfirmation(interaction) {
    const confirmPrefix = 'poll_confirmclose_';
    const cancelPrefix = 'poll_canceldismiss_';
    if (interaction.customId.startsWith(cancelPrefix)) {
        await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
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
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return true;
    }
    const orgId = await (0, guildContext_1.resolveOrgIdForGuild)(guildId);
    if (!orgId) {
        await interaction.reply({
            embeds: [
                embedBuilder_1.SCFleetEmbed.error('Not Linked', 'This server is not linked to an organization or federation.').build(),
            ],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return true;
    }
    await handleCloseButton(interaction, orgId, pollId);
    return true;
}
async function handleCloseButton(interaction, orgId, pollId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const closed = await getServices().pollService.closePoll(orgId, pollId, interaction.user.id, interaction.user.username);
        if (!closed) {
            await interaction.editReply({
                embeds: [embedBuilder_1.SCFleetEmbed.error('Not Found', 'This poll not found or already closed.').build()],
            });
            return;
        }
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.success('Poll Closed', `**${closed.title}** has been closed.`).build()],
        });
    }
    catch (err) {
        await interaction.editReply({
            embeds: [embedBuilder_1.SCFleetEmbed.error('Error', (0, errorHandler_1.getErrorMessage)(err)).build()],
        });
    }
}
//# sourceMappingURL=poll.js.map