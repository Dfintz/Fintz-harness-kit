"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticket = void 0;
exports.parseTicketCancelCloseTicketNumber = parseTicketCancelCloseTicketNumber;
const axios_1 = require("axios");
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DmNotificationService_1 = require("../../services/discord/DmNotificationService");
const TicketActivityLogService_1 = require("../../services/discord/TicketActivityLogService");
const TicketTranscriptService_1 = require("../../services/discord/TicketTranscriptService");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const panelEmbed_1 = require("../embeds/panelEmbed");
const botApiClient_1 = require("../utils/botApiClient");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const customId_1 = require("../utils/customId");
const paginationControls_1 = require("../utils/paginationControls");
const ticketIssueChannel_1 = require("./ticketIssueChannel");
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
function buildTicketCancelCloseCustomId(ticketNumber) {
    return (0, customId_1.buildCustomId)('ticket', 'cancelclose', ticketNumber);
}
function parseTicketCancelCloseTicketNumber(customId) {
    const parsed = (0, customId_1.parseCustomId)(customId);
    if (parsed.prefix !== 'ticket' || parsed.action !== 'cancelclose') {
        return null;
    }
    const [ticketNumber = ''] = parsed.params;
    return ticketNumber.length > 0 ? ticketNumber : null;
}
const CATEGORY_MODAL_FIELDS = {
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
const CATEGORY_BUTTON_STYLE = {
    support: discord_js_1.ButtonStyle.Danger,
    recruitment: discord_js_1.ButtonStyle.Success,
    diplomacy: discord_js_1.ButtonStyle.Secondary,
};
const TICKET_PANEL_CONFIG = {
    title: '🎫 Support Ticket System',
    description: 'Need help? Create a support ticket by clicking one of the buttons below.\n\n' +
        'Our team will respond to your ticket as soon as possible.',
    prefix: 'ticket',
    footer: 'Click a button below to create a ticket',
    buttons: TICKET_CATEGORIES.map(cat => ({
        action: cat.value,
        label: cat.label,
        style: CATEGORY_BUTTON_STYLE[cat.value] ?? discord_js_1.ButtonStyle.Primary,
        emoji: cat.emoji,
        description: cat.description,
    })),
};
const TICKET_STATUS_COLOR = { open: 0x00ff88, closed: 0xff4444 };
function _ticketStatusColor(status) {
    return TICKET_STATUS_COLOR[status] ?? 0xffaa00;
}
const TICKET_PRIORITIES = [
    { value: 'low', label: 'Low', emoji: '🟢' },
    { value: 'medium', label: 'Medium', emoji: '🟡' },
    { value: 'high', label: 'High', emoji: '🟠' },
    { value: 'urgent', label: 'Urgent', emoji: '🔴' },
];
function toRecord(value) {
    return value !== null && typeof value === 'object' ? value : null;
}
function extractTicketPayload(data) {
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
function extractTicketList(data) {
    const payload = toRecord(data);
    if (!payload) {
        return [];
    }
    const candidates = [payload.data, payload.tickets, payload.items];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate
                .map(item => toRecord(item))
                .filter((item) => item !== null);
        }
    }
    return [];
}
function resolveTicketNumber(ticket) {
    const rawNum = ticket?.ticketNumber ?? ticket?.id;
    if (typeof rawNum !== 'string') {
        return 'unknown';
    }
    const normalized = rawNum.trim();
    return normalized.length > 0 ? normalized : 'unknown';
}
function getPriorityEmoji(priority) {
    return TICKET_PRIORITIES.find(item => item.value === priority)?.emoji || '\u26aa';
}
function getCategoryEmoji(category) {
    return TICKET_CATEGORIES.find(item => item.value === category)?.emoji || '\ud83d\udcac';
}
function normalizeTicketListDisplay(ticket) {
    const ticketNumber = typeof ticket.ticketNumber === 'string' && ticket.ticketNumber.trim().length > 0
        ? ticket.ticketNumber
        : 'UNKNOWN';
    const subject = typeof ticket.subject === 'string' && ticket.subject.trim().length > 0
        ? ticket.subject
        : 'No subject';
    const status = typeof ticket.status === 'string' && ticket.status.trim().length > 0 ? ticket.status : 'open';
    const createdAtTimestamp = typeof ticket.createdAt === 'string' ? Date.parse(ticket.createdAt) : Number.NaN;
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
function resolveKnownCategory(requestedCategory, parsedTicket, fallbackTicket) {
    if (parsedTicket?.category &&
        TICKET_CATEGORIES.some(item => item.value === parsedTicket.category)) {
        return parsedTicket.category;
    }
    if (fallbackTicket?.category &&
        TICKET_CATEGORIES.some(item => item.value === fallbackTicket.category)) {
        return fallbackTicket.category;
    }
    return requestedCategory;
}
async function findLatestTicketForDiscordUser(discordUserId, guildId, subject) {
    try {
        const response = await botApiClient_1.botApiClient.get('/v2/tickets', {
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
    }
    catch (error) {
        logger_1.logger.warn('Fallback ticket lookup failed after create response parsing', {
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
        return null;
    }
}
exports.ticket = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create and manage support tickets'),
    cooldown: 5,
    category: 'moderation',
    async execute(interaction) {
        const panelConfig = {
            prefix: 'ticket',
            title: 'Support Tickets',
            description: 'Create and manage support tickets.',
            buttons: [
                {
                    subcommand: 'create',
                    label: 'Create Ticket',
                    emoji: '\ud83c\udfab',
                    style: discord_js_1.ButtonStyle.Success,
                },
                {
                    subcommand: 'list',
                    label: 'My Tickets',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                { subcommand: 'panel', label: 'Post Ticket Panel', emoji: '\ud83d\udccc' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
    async handleButton(interaction) {
        const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'ticket');
        if (sub) {
            switch (sub) {
                case 'create': {
                    const categoryEmbed = new discord_js_1.EmbedBuilder()
                        .setColor(0x00d9ff)
                        .setTitle('\ud83c\udfab Select Ticket Category')
                        .setDescription('Choose a category for your support ticket:');
                    const categoryButtons = (0, panelEmbed_1.buildPanelButtons)(TICKET_PANEL_CONFIG);
                    await interaction.reply({
                        embeds: [categoryEmbed],
                        components: [categoryButtons],
                        flags: discord_js_1.MessageFlags.Ephemeral,
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
                    break;
            }
        }
        const parsed = (0, panelEmbed_1.parsePanelButtonId)(interaction.customId);
        if (parsed?.prefix === 'ticket') {
            const category = parsed.action;
            const categoryInfo = TICKET_CATEGORIES.find(c => c.value === category);
            if (!categoryInfo) {
                await interaction.reply({
                    content: '❌ Unknown ticket category.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            if (category === 'recruitment') {
                await _handleRecruitmentRedirect(interaction);
                return;
            }
            const fields = CATEGORY_MODAL_FIELDS[category] ?? CATEGORY_MODAL_FIELDS['general'];
            const modal = (0, panelEmbed_1.buildPanelModal)(`ticket_create_${category}`, `${categoryInfo.emoji} Create ${categoryInfo.label} Ticket`, fields);
            await interaction.showModal(modal);
            return;
        }
        const replyMatch = /^ticket_reply_(.+)$/.exec(interaction.customId);
        if (replyMatch) {
            const ticketNumber = replyMatch[1];
            const fields = [
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
            const modal = (0, panelEmbed_1.buildPanelModal)(`ticket_reply_modal_${ticketNumber}`, `Reply to ${ticketNumber}`, fields);
            await interaction.showModal(modal);
            return;
        }
        const listPageMatch = /^ticket_listpage_(\d+)$/.exec(interaction.customId);
        if (listPageMatch) {
            await _handleTicketListPageButton(interaction, Number.parseInt(listPageMatch[1], 10));
            return;
        }
        const resolveMatch = /^ticket_resolve_(.+)$/.exec(interaction.customId);
        if (resolveMatch) {
            const ticketNumber = resolveMatch[1];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const ticketResponse = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                await botApiClient_1.botApiClient.put(`/v2/tickets/${ticketResponse.data.id}/resolve`, {
                    resolution: `Resolved via Discord button by ${interaction.user.username}`,
                }, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
                await activityLog.logActivity(interaction.guildId ?? '', ticketNumber, 'closed', interaction.user.username);
                if (interaction.guildId) {
                    void _sendCloseDm(interaction.guildId, ticketResponse.data);
                }
                if (interaction.guild) {
                    void (0, ticketIssueChannel_1.closeTicketChannel)(interaction.guild, ticketResponse.data.id, ticketNumber);
                }
                await interaction.editReply({
                    content: `✅ Ticket **${ticketNumber}** has been resolved.`,
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to resolve ticket via button:', error);
                await interaction.editReply({
                    content: `❌ Failed to resolve ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
            return;
        }
        const closeMatch = /^ticket_close_(.+)$/.exec(interaction.customId);
        if (closeMatch) {
            const ticketNumber = closeMatch[1];
            const settingsService = DiscordSettingsService_1.discordSettingsService;
            const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
            const twoStepEnabled = settings?.[0]?.ticketSettings?.twoStepCloseEnabled ?? false;
            if (twoStepEnabled) {
                await interaction.reply((0, confirmationPrompt_1.buildConfirmationPrompt)({
                    confirmCustomId: `ticket_confirmclose_${ticketNumber}`,
                    cancelCustomId: buildTicketCancelCloseCustomId(ticketNumber),
                    message: `close ticket **${ticketNumber}**`,
                    confirmLabel: 'Confirm Close',
                }));
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const ticketResponse = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                await botApiClient_1.botApiClient.put(`/v2/tickets/${ticketResponse.data.id}/close`, {}, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
                await activityLog.logActivity(interaction.guildId ?? '', ticketNumber, 'closed', interaction.user.username);
                if (interaction.guildId) {
                    void _postCloseTranscript(interaction.guildId, ticketResponse.data);
                }
                if (interaction.guildId) {
                    void _sendCloseDm(interaction.guildId, ticketResponse.data);
                }
                if (interaction.guild) {
                    void (0, ticketIssueChannel_1.closeTicketChannel)(interaction.guild, ticketResponse.data.id, ticketNumber);
                }
                await interaction.editReply({ content: `✅ Ticket **${ticketNumber}** has been closed.` });
            }
            catch (error) {
                logger_1.logger.error('Failed to close ticket via button:', error);
                await interaction.editReply({
                    content: `❌ Failed to close ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
            return;
        }
        const confirmCloseMatch = /^ticket_confirmclose_(.+)$/.exec(interaction.customId);
        if (confirmCloseMatch) {
            const ticketNumber = confirmCloseMatch[1];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const ticketResponse = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                await botApiClient_1.botApiClient.put(`/v2/tickets/${ticketResponse.data.id}/close`, {}, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
                await activityLog.logActivity(interaction.guildId ?? '', ticketNumber, 'closed', interaction.user.username);
                if (interaction.guildId) {
                    void _postCloseTranscript(interaction.guildId, ticketResponse.data);
                }
                if (interaction.guildId) {
                    void _sendCloseDm(interaction.guildId, ticketResponse.data);
                }
                if (interaction.guild) {
                    void (0, ticketIssueChannel_1.closeTicketChannel)(interaction.guild, ticketResponse.data.id, ticketNumber);
                }
                await interaction.editReply({ content: `✅ Ticket **${ticketNumber}** has been closed.` });
            }
            catch (error) {
                logger_1.logger.error('Failed to close ticket via confirm:', error);
                await interaction.editReply({
                    content: `❌ Failed to close ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
            return;
        }
        if (parseTicketCancelCloseTicketNumber(interaction.customId)) {
            await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
            return;
        }
        const claimMatch = /^ticket_claim_(.+)$/.exec(interaction.customId);
        if (claimMatch) {
            const ticketNumber = claimMatch[1];
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            try {
                const ticketResponse = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                await botApiClient_1.botApiClient.put(`/v2/tickets/${ticketResponse.data.id}/assign`, { assigneeId: interaction.user.id, assigneeName: interaction.user.username }, {
                    headers: {
                        'X-Discord-User-Id': interaction.user.id,
                        'X-Discord-Guild-Id': interaction.guildId,
                    },
                });
                const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
                await activityLog.logActivity(interaction.guildId ?? '', ticketNumber, 'claimed', interaction.user.username);
                await interaction.editReply({
                    content: `✋ You have claimed ticket **${ticketNumber}**.`,
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to claim ticket via button:', error);
                await interaction.editReply({
                    content: `❌ Failed to claim ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`,
                });
            }
        }
    },
    async handleModal(interaction) {
        const createMatch = /^ticket_create_([a-z]+)$/.exec(interaction.customId);
        if (createMatch) {
            await handleTicketCreateModal(interaction, createMatch[1]);
            return;
        }
        const replyMatch = /^ticket_reply_modal_(.+)$/.exec(interaction.customId);
        if (replyMatch) {
            await handleTicketReplyModal(interaction, replyMatch[1]);
        }
    },
};
async function _handleRecruitmentRedirect(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.get(`/v2/recruitment`, {
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
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recruitments from ticket panel:', error);
        await interaction.editReply({
            content: `❌ Failed to load recruitment positions: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
function _recruitmentStatusEmoji(status) {
    if (status === 'open') {
        return '🟢';
    }
    if (status === 'paused') {
        return '🟡';
    }
    return '🔴';
}
function _buildRecruitmentListEmbed(recruitments) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle('📋 Open Recruitment Positions')
        .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
        .setTimestamp();
    for (const r of recruitments.slice(0, 10)) {
        const emoji = _recruitmentStatusEmoji(r.status);
        const rolesText = r.rolesNeeded?.slice(0, 3).join(', ') || 'Various roles';
        const desc = r.description ?? '';
        const truncDesc = desc.length > 100 ? `${desc.substring(0, 100)}...` : desc;
        const applicantCount = r.currentApplicants || 0;
        const maxPos = r.maxPositions;
        const applicants = maxPos ? `${applicantCount}/${maxPos}` : String(applicantCount);
        embed.addFields({
            name: `${emoji} ${r.title}`,
            value: [`📝 ${truncDesc}`, `🎯 Roles: ${rolesText}`, `👥 Applicants: ${applicants}`].join('\n'),
            inline: false,
        });
    }
    return embed;
}
function _buildRecruitmentApplyButtons(recruitments) {
    const rows = [];
    for (let i = 0; i < Math.min(recruitments.length, 5); i++) {
        if (i % 5 === 0 && rows.length < 5) {
            rows.push(new discord_js_1.ActionRowBuilder());
        }
        const title = recruitments[i].title.substring(0, 20);
        rows[Math.floor(i / 5)].addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_apply_${recruitments[i].id}`)
            .setLabel(`Apply: ${title}`)
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('📝'));
    }
    return rows;
}
const TICKET_LIST_PAGE_SIZE = 10;
async function _handleListTicketsButton(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const tickets = await _fetchOpenTickets(interaction);
        if (tickets.length === 0) {
            await interaction.editReply({
                content: '\ud83d\udced You have no open tickets.',
            });
            return;
        }
        await interaction.editReply(_buildTicketListView(tickets, 0));
    }
    catch (error) {
        await interaction.editReply({
            content: `\u274c Failed to fetch tickets: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function _handleTicketListPageButton(interaction, page) {
    try {
        const tickets = await _fetchOpenTickets(interaction);
        if (tickets.length === 0) {
            await interaction.update({
                content: '\ud83d\udced You have no open tickets.',
                embeds: [],
                components: [],
            });
            return;
        }
        await interaction.update(_buildTicketListView(tickets, page));
    }
    catch (error) {
        await interaction.reply({
            content: `\u274c Failed to load that page: ${(0, errorHandler_1.getErrorMessage)(error)}`,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function _fetchOpenTickets(interaction) {
    const response = await botApiClient_1.botApiClient.get(`/v2/tickets`, {
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
function _buildTicketListView(tickets, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(tickets, page, TICKET_LIST_PAGE_SIZE);
    const embed = new discord_js_1.EmbedBuilder()
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
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => `ticket_listpage_${targetPage}`,
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
async function _handleCreatePanelButton(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
            content: '\u274c You need Administrator permissions to create a ticket panel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const embed = (0, panelEmbed_1.buildPanelEmbed)(TICKET_PANEL_CONFIG);
    const row = (0, panelEmbed_1.buildPanelButtons)(TICKET_PANEL_CONFIG);
    await interaction.reply({ content: 'Ticket panel created!', flags: discord_js_1.MessageFlags.Ephemeral });
    if (interaction.channel && 'send' in interaction.channel) {
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
}
const OPTIONAL_MODAL_FIELDS = [
    'ticket_member',
    'ticket_rsi_handle',
    'ticket_org_name',
    'ticket_browser',
];
async function handleTicketCreateModal(interaction, category) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const guildId = interaction.guildId ?? '';
    if (guildId && interaction.member && 'roles' in interaction.member) {
        try {
            const settingsService = DiscordSettingsService_1.discordSettingsService;
            const allSettings = await settingsService.getSettingsByGuildId(guildId);
            const ticketConfig = allSettings?.[0]?.ticketSettings;
            if (ticketConfig) {
                const memberRoles = new Set(Array.isArray(interaction.member.roles)
                    ? interaction.member.roles
                    : [...interaction.member.roles.cache.keys()]);
                if (ticketConfig.blockedRoleIds?.length) {
                    const hasBlocked = ticketConfig.blockedRoleIds.some(r => memberRoles.has(r));
                    if (hasBlocked) {
                        await interaction.editReply({ content: '❌ You are not allowed to create tickets.' });
                        return;
                    }
                }
                if (ticketConfig.requiredRoleIds?.length) {
                    const matchMode = ticketConfig.roleMatchMode ?? 'any';
                    const hasRequired = matchMode === 'all'
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
        }
        catch {
        }
    }
    const subject = interaction.fields.getTextInputValue('ticket_subject');
    const description = interaction.fields.getTextInputValue('ticket_description');
    const metadata = {};
    for (const fieldId of OPTIONAL_MODAL_FIELDS) {
        try {
            const value = interaction.fields.getTextInputValue(fieldId);
            if (value) {
                metadata[fieldId.replace('ticket_', '')] = value;
            }
        }
        catch {
        }
    }
    const categoryToRecipientType = {
        hr: 'hr_department',
        recruitment: 'recruitment',
        diplomacy: 'diplomacy',
        general: 'org_leadership',
        support: 'platform_admin',
    };
    try {
        const response = await botApiClient_1.botApiClient.post(`/v2/tickets`, {
            subject,
            description,
            category,
            priority: 'medium',
            recipientType: categoryToRecipientType[category] ?? 'org_leadership',
            creatorDiscordId: interaction.user.id,
            discordId: interaction.user.id,
        }, {
            headers: {
                'X-Discord-User-Id': interaction.user.id,
                'X-Discord-Guild-Id': interaction.guildId,
            },
        });
        const parsedTicket = extractTicketPayload(response.data);
        let fallbackTicket = null;
        let ticketNum = resolveTicketNumber(parsedTicket);
        if (ticketNum === 'unknown') {
            fallbackTicket = await findLatestTicketForDiscordUser(interaction.user.id, interaction.guildId, subject);
            ticketNum = resolveTicketNumber(fallbackTicket);
        }
        const resolvedCategory = resolveKnownCategory(category, parsedTicket, fallbackTicket);
        const categoryInfo = TICKET_CATEGORIES.find(c => c.value === resolvedCategory);
        const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
        await activityLog.logActivity(interaction.guildId ?? '', ticketNum, 'created', interaction.user.username, `Category: ${categoryInfo?.label ?? category}`);
        const ticketId = parsedTicket?.id ?? fallbackTicket?.id;
        if (interaction.guild && ticketId && ticketNum !== 'unknown') {
            void (0, ticketIssueChannel_1.openTicketChannel)(interaction.guild, ticketId, ticketNum, interaction.user.id, resolvedCategory, {
                subject,
                description,
                category: resolvedCategory,
            });
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x00ff88)
            .setTitle(`${categoryInfo?.emoji ?? '🎫'} Ticket Created: ${ticketNum}`)
            .setDescription(`Your ${categoryInfo?.label ?? category} ticket has been created!`)
            .addFields({ name: 'Subject', value: subject, inline: false }, {
            name: 'Category',
            value: `${categoryInfo?.emoji ?? ''} ${categoryInfo?.label ?? category}`,
            inline: true,
        }, { name: 'Priority', value: '🟡 Medium', inline: true }, { name: 'Status', value: '`Open`', inline: true })
            .setFooter({ text: `Use /ticket view ${ticketNum} to check status` })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (error) {
        logger_1.logger.error('Failed to create ticket via panel:', error);
        let content = `❌ Failed to create ticket: ${(0, errorHandler_1.getErrorMessage)(error)}`;
        if ((0, axios_1.isAxiosError)(error)) {
            const status = error.response?.status;
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                content =
                    '❌ The API did not respond in time. The server may be starting up — please try again in a moment.';
            }
            else if (status === 403) {
                const apiError = error.response?.data?.error;
                if (apiError?.includes('Direct access')) {
                    content =
                        '❌ The bot could not reach the API (blocked by Front Door).\n\n' +
                            '• Ensure `BOT_API_INTERNAL_URL` is set to the internal API address.\n' +
                            '• Ensure `BOT_INTERNAL_SECRET` matches between bot and API.';
                }
                else {
                    content =
                        '❌ This Discord server is not linked to a Fringe Core organization.\n\n' +
                            '• Ask an admin to run `/org` and use **Help → Server Setup** to verify the link.\n' +
                            '• If you just linked it, wait ~30 seconds and try again.\n' +
                            '• An admin can link it via the `/org` server setup panel or in **Organization Settings → Discord Server**.';
                }
            }
            else if (status === 401) {
                const apiDetail = error.response?.data?.error ??
                    error.response?.data?.message;
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
async function _postCloseTranscript(guildId, ticketData) {
    try {
        const { ticketNumber, subject, category, creatorName, createdAt, messages } = ticketData;
        if (!ticketNumber || !subject || !category || !creatorName) {
            return;
        }
        const allSettings = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        const transcriptChannelId = allSettings?.find(s => s.ticketSettings?.transcriptChannelId)
            ?.ticketSettings?.transcriptChannelId;
        if (!transcriptChannelId) {
            return;
        }
        const transcriptService = TicketTranscriptService_1.TicketTranscriptService.getInstance();
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
        const transcript = transcriptService.generateTranscript(ticketNumber, subject, category, creatorName, parsedCreatedAt, safeMessages);
        await transcriptService.postToChannel(transcriptChannelId, transcript);
    }
    catch (error) {
        logger_1.logger.warn('ticket: failed to post close transcript', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
async function _sendCloseDm(guildId, ticketData) {
    try {
        const { creatorDiscordId, ticketNumber, resolution } = ticketData;
        if (!creatorDiscordId || !ticketNumber) {
            return;
        }
        const dmService = DmNotificationService_1.DmNotificationService.getInstance();
        const embed = dmService.buildTicketClosedEmbed(ticketNumber, resolution);
        void dmService.sendNotifications({
            eventType: DmNotificationService_1.DmEventType.TICKET_CLOSED,
            recipientDiscordIds: [creatorDiscordId],
            embed,
            guildId,
        });
    }
    catch (error) {
        logger_1.logger.warn('ticket: failed to send close DM', {
            error: error instanceof Error ? error.message : 'unknown',
        });
    }
}
async function handleTicketReplyModal(interaction, ticketNumber) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const message = interaction.fields.getTextInputValue('reply_content');
    try {
        const ticketResponse = await botApiClient_1.botApiClient.get(`/v2/tickets/by-number/${ticketNumber}`, {
            headers: {
                'X-Discord-User-Id': interaction.user.id,
                'X-Discord-Guild-Id': interaction.guildId,
            },
        });
        await botApiClient_1.botApiClient.post(`/v2/tickets/${ticketResponse.data.id}/messages`, {
            content: message,
            authorName: interaction.user.username,
            authorId: interaction.user.id,
        }, {
            headers: {
                'X-Discord-User-Id': interaction.user.id,
                'X-Discord-Guild-Id': interaction.guildId,
            },
        });
        const activityLog = TicketActivityLogService_1.TicketActivityLogService.getInstance();
        await activityLog.logActivity(interaction.guildId ?? '', ticketNumber, 'replied', interaction.user.username);
        await interaction.editReply({ content: `✅ Reply added to ticket **${ticketNumber}**.` });
    }
    catch (error) {
        logger_1.logger.error('Failed to reply to ticket via modal:', error);
        await interaction.editReply({ content: `❌ Failed to reply: ${(0, errorHandler_1.getErrorMessage)(error)}` });
    }
}
//# sourceMappingURL=ticket.js.map