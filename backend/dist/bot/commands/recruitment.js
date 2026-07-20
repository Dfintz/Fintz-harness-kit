"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recruitment = void 0;
exports.selectLatestRecruitment = selectLatestRecruitment;
const discord_js_1 = require("discord.js");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const discordAccountLink_1 = require("../../utils/discordAccountLink");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const api_1 = require("../constants/api");
const panelEmbed_1 = require("../embeds/panelEmbed");
const recruitmentEmbeds_1 = require("../embeds/recruitmentEmbeds");
const botApiClient_1 = require("../utils/botApiClient");
const botErrorFormat_1 = require("../utils/botErrorFormat");
const commandPanelBuilder_1 = require("../utils/commandPanelBuilder");
const confirmationPrompt_1 = require("../utils/confirmationPrompt");
const embedBuilder_1 = require("../utils/embedBuilder");
const recruitmentApplyPayload_1 = require("../utils/recruitmentApplyPayload");
const recruitmentApplicantChannel_1 = require("./recruitmentApplicantChannel");
function getSettingsService() {
    return DiscordSettingsService_1.discordSettingsService;
}
const pendingSelectAnswers = new Map();
const stalePendingAnswersCleanupTimer = setInterval(() => {
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
}, 10 * 60 * 1000);
stalePendingAnswersCleanupTimer.unref();
const DISCORD_MODAL_MAX_FIELDS = 5;
const pendingDynamicApplications = new Map();
async function submitRecruitmentApplicationAndNotify(interaction, recruitmentId, payload, staffReviewInput) {
    const appResponse = await botApiClient_1.botApiClient.post(`${api_1.API_BASE_URL}/v2/recruitment/${recruitmentId}/apply`, payload, {
        headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
        },
    });
    const application = appResponse.data;
    const enrichedReviewInput = {
        ...staffReviewInput,
        appliedAt: typeof application.appliedAt === 'string' ? application.appliedAt : new Date().toISOString(),
        applicationStatus: typeof application.status === 'string' ? application.status : 'pending',
    };
    await interaction.editReply({ embeds: [(0, recruitmentEmbeds_1.buildApplicationConfirmationEmbed)(payload)] });
    await createStaffReviewThread(interaction, recruitmentId, application, enrichedReviewInput);
    await (0, recruitmentApplicantChannel_1.openApplicantChannel)(interaction, recruitmentId, application);
}
async function replyRecruitmentApplyError(interaction, error) {
    const accountLinkPrompt = getDiscordAccountLinkPrompt(error);
    if (accountLinkPrompt) {
        await replyWithDiscordAccountLinkPrompt(interaction, accountLinkPrompt);
        return;
    }
    const apiMsg = (0, botErrorFormat_1.formatBotApiError)(error, 'Failed to submit application', 'recruitment-apply');
    const content = (0, errorHandler_1.isAxiosError)(error) && error.response?.status === 404
        ? '❌ This recruitment posting is no longer available — it may have been closed or removed. Refresh the recruitment panel and try again.'
        : `❌ Failed to submit application: ${apiMsg}`;
    await interaction.editReply({ content });
}
function getDiscordAccountLinkPrompt(error) {
    return (0, discordAccountLink_1.parseDiscordAccountLinkPrompt)(error, {
        allowedStatusCodes: [401, 403, 404, 409],
        fallbackMessage: 'Sign in with Discord SSO on the web app before applying through the recruitment panel.',
        fallbackLoginUrl: (0, discordAccountLink_1.getDiscordWebLoginUrl)(),
    });
}
async function replyWithDiscordAccountLinkPrompt(interaction, prompt) {
    const embed = (0, recruitmentEmbeds_1.buildDiscordAccountLinkPromptEmbed)(prompt.message);
    const loginButton = new discord_js_1.ButtonBuilder()
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(prompt.loginUrl)
        .setLabel('Sign In with Discord')
        .setEmoji('🔐');
    await interaction.editReply({
        embeds: [embed],
        components: [new discord_js_1.ActionRowBuilder().addComponents(loginButton)],
    });
}
function questionToModalField(q) {
    const baseStyle = q.type === 'short' ? 'short' : 'paragraph';
    let placeholder = q.placeholder ?? '';
    if ((q.type === 'select' || q.type === 'checkbox') && q.options?.length) {
        const opts = q.options.join(', ');
        placeholder = placeholder ? `${placeholder} (Options: ${opts})` : `Options: ${opts}`;
    }
    else if (q.type === 'rules') {
        placeholder = placeholder || 'Type "I agree" to accept the rules';
    }
    return {
        customId: q.id.slice(0, 100),
        label: q.label.slice(0, 45),
        placeholder: placeholder.slice(0, 100) || undefined,
        style: baseStyle,
        required: q.required,
        maxLength: q.maxLength ?? (baseStyle === 'paragraph' ? 1000 : 200),
    };
}
async function fetchRecruitmentQuestions(recruitmentId, discordUserId, guildId) {
    try {
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment/${recruitmentId}`, {
            headers: {
                'X-Discord-User-Id': discordUserId,
                ...(guildId ? { 'X-Discord-Guild-Id': guildId } : {}),
            },
        });
        const questions = response.data?.applicationQuestions;
        if (!Array.isArray(questions)) {
            return [];
        }
        return questions.filter((q) => !!q && typeof q.id === 'string' && typeof q.label === 'string');
    }
    catch (err) {
        logger_1.logger.warn('Failed to fetch recruitment questions for dynamic modal', {
            recruitmentId,
            error: (0, errorHandler_1.getErrorMessage)(err),
        });
        return [];
    }
}
function buildDynamicApplicationModal(recruitmentId, questions, page) {
    const totalPages = Math.ceil(questions.length / DISCORD_MODAL_MAX_FIELDS);
    const start = page * DISCORD_MODAL_MAX_FIELDS;
    const slice = questions.slice(start, start + DISCORD_MODAL_MAX_FIELDS);
    const fields = slice.map(questionToModalField);
    const titleSuffix = totalPages > 1 ? ` (${page + 1}/${totalPages})` : '';
    return (0, panelEmbed_1.buildPanelModal)(`recruitment_apply_dyn_${recruitmentId}_${page}`, `📋 Application${titleSuffix}`, fields);
}
async function showApplicationModal(interaction, recruitmentId, legacyModalTitle) {
    const questions = await fetchRecruitmentQuestions(recruitmentId, interaction.user.id, interaction.guildId);
    if (questions.length === 0) {
        const modal = (0, panelEmbed_1.buildPanelModal)(`recruitment_apply_modal_${recruitmentId}`, legacyModalTitle, APPLICATION_MODAL_FIELDS);
        await interaction.showModal(modal);
        return;
    }
    const selectQuestions = questions.filter(q => q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25);
    const textQuestions = questions.filter(q => !(q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25));
    pendingDynamicApplications.set(interaction.user.id, {
        recruitmentId,
        questions,
        modalQuestions: textQuestions,
        answers: {},
        timestamp: Date.now(),
    });
    if (selectQuestions.length > 0) {
        await showNextSelectQuestion(interaction, recruitmentId, selectQuestions, 0);
    }
    else {
        const modal = buildDynamicApplicationModal(recruitmentId, textQuestions, 0);
        await interaction.showModal(modal);
    }
}
async function showNextSelectQuestion(interaction, recruitmentId, selectQuestions, index) {
    const q = selectQuestions[index];
    const totalSelects = selectQuestions.length;
    const stepLabel = totalSelects > 1 ? ` (${index + 1}/${totalSelects})` : '';
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`recruitment_dynselect_${recruitmentId}_${index}`)
        .setPlaceholder(q.placeholder?.slice(0, 100) || `Select ${q.label}...`.slice(0, 100))
        .addOptions(q.options.slice(0, 25).map(opt => ({
        label: opt.slice(0, 100),
        value: opt.slice(0, 100),
    }))));
    const content = `📋 **${q.label}**${stepLabel}\n${q.required ? '*(required)*' : '*(optional)*'}`;
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content,
            components: [row],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
    else {
        await interaction.reply({
            content,
            components: [row],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
    }
}
async function submitDynamicApplication(interaction, pendingApp) {
    const pendingSelect = pendingSelectAnswers.get(interaction.user.id);
    const selectAnswers = pendingSelect?.recruitmentId === pendingApp.recruitmentId ? pendingSelect.answers : {};
    pendingSelectAnswers.delete(interaction.user.id);
    pendingDynamicApplications.delete(interaction.user.id);
    const payload = (0, recruitmentApplyPayload_1.buildDynamicRecruitmentApplyPayload)({
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
    }
    catch (error) {
        await replyRecruitmentApplyError(interaction, error);
    }
}
const RECRUITMENT_PANEL_CONFIG = {
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
            style: discord_js_1.ButtonStyle.Primary,
            emoji: '📋',
            description: 'Browse all open recruitment positions',
        },
        {
            action: 'quick_apply',
            label: 'Quick Apply',
            style: discord_js_1.ButtonStyle.Success,
            emoji: '📝',
            description: 'Apply to the most recent open position',
        },
    ],
};
const RECRUITMENT_STATUS_PRIORITY = {
    open: 0,
    closed: 1,
    paused: 2,
};
function selectLatestRecruitment(recruitments) {
    let best = null;
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
async function fetchLatestRecruitment(guildId) {
    if (!guildId) {
        return null;
    }
    try {
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment`, {
            params: { limit: 50 },
            headers: { 'X-Discord-Guild-Id': guildId },
        });
        const list = (response.data?.data ?? []);
        return selectLatestRecruitment(list);
    }
    catch (err) {
        logger_1.logger.warn('Failed to fetch recruitments for panel (any status)', {
            guildId,
            error: (0, errorHandler_1.getErrorMessage)(err),
        });
        return null;
    }
}
const APPLICATION_MODAL_FIELDS = [
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
const LEGACY_REVIEW_BUTTON_MESSAGE = '⚠️ This button uses an outdated format. Please re-post the recruitment listing to get updated Accept/Deny buttons.';
const APPLY_BUTTON_REGEX = /^recruitment_apply_(.+)$/;
const CONTINUE_BUTTON_REGEX = /^recruitment_apply_continue_(.+)_(\d+)$/;
const VIEW_BUTTON_REGEX = /^recruitment_view_(.+)$/;
const ACCEPT_BUTTON_REGEX = /^recruitment_accept_([0-9a-f-]+)_([0-9a-f-]+)$/;
const LEGACY_ACCEPT_BUTTON_REGEX = /^recruitment_accept_([0-9a-f-]+)$/;
const DENY_BUTTON_REGEX = /^recruitment_deny_([0-9a-f-]+)_([0-9a-f-]+)$/;
const LEGACY_DENY_BUTTON_REGEX = /^recruitment_deny_([0-9a-f-]+)$/;
const CONFIRM_DENY_BUTTON_REGEX = /^recruitment_confirmdeny_([0-9a-f-]+)_([0-9a-f-]+)$/;
const DENY_DISMISS_BUTTON_REGEX = /^recruitment_denydismiss_([0-9a-f-]+)_([0-9a-f-]+)$/;
async function tryHandleCommandPanelButton(interaction) {
    const sub = (0, commandPanelBuilder_1.parsePanelCustomId)(interaction.customId, 'recruitment');
    if (!sub) {
        return false;
    }
    const handlers = {
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
async function tryHandlePersistentPanelButton(interaction) {
    const parsed = (0, panelEmbed_1.parsePanelButtonId)(interaction.customId);
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
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
    return true;
}
async function tryHandleApplyButton(interaction) {
    const match = APPLY_BUTTON_REGEX.exec(interaction.customId);
    if (!match) {
        return false;
    }
    await showApplicationModal(interaction, match[1], '📋 Recruitment Application');
    return true;
}
async function tryHandleContinueButton(interaction) {
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
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return true;
    }
    const modal = buildDynamicApplicationModal(recruitmentId, pending.modalQuestions, nextPage);
    await interaction.showModal(modal);
    return true;
}
async function tryHandleViewButton(interaction) {
    const match = VIEW_BUTTON_REGEX.exec(interaction.customId);
    if (!match) {
        return false;
    }
    await handleButtonViewRecruitment(interaction, match[1]);
    return true;
}
async function tryHandleReviewButtons(interaction) {
    const acceptMatch = ACCEPT_BUTTON_REGEX.exec(interaction.customId);
    if (acceptMatch) {
        await handleAcceptApplication(interaction, acceptMatch[1], acceptMatch[2]);
        return true;
    }
    const legacyAcceptMatch = LEGACY_ACCEPT_BUTTON_REGEX.exec(interaction.customId);
    if (legacyAcceptMatch) {
        await interaction.reply({
            content: LEGACY_REVIEW_BUTTON_MESSAGE,
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return true;
    }
    const denyMatch = DENY_BUTTON_REGEX.exec(interaction.customId);
    if (denyMatch) {
        await interaction.reply((0, confirmationPrompt_1.buildConfirmationPrompt)({
            confirmCustomId: `recruitment_confirmdeny_${denyMatch[1]}_${denyMatch[2]}`,
            cancelCustomId: `recruitment_denydismiss_${denyMatch[1]}_${denyMatch[2]}`,
            message: 'deny this application',
            confirmLabel: 'Deny Application',
            cancelLabel: 'Keep Pending',
            confirmEmoji: '❌',
            cancelEmoji: '↩️',
        }));
        return true;
    }
    const confirmDenyMatch = CONFIRM_DENY_BUTTON_REGEX.exec(interaction.customId);
    if (confirmDenyMatch) {
        await handleDenyApplication(interaction, confirmDenyMatch[1], confirmDenyMatch[2]);
        return true;
    }
    if (DENY_DISMISS_BUTTON_REGEX.test(interaction.customId)) {
        await (0, confirmationPrompt_1.respondConfirmationCancelled)(interaction);
        return true;
    }
    const legacyDenyMatch = LEGACY_DENY_BUTTON_REGEX.exec(interaction.customId);
    if (!legacyDenyMatch) {
        return false;
    }
    await interaction.reply({
        content: LEGACY_REVIEW_BUTTON_MESSAGE,
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
    return true;
}
exports.recruitment = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('recruitment')
        .setDescription('Recruitment and application management'),
    cooldown: 5,
    category: 'organization',
    async execute(interaction) {
        const panelConfig = {
            prefix: 'recruitment',
            title: 'Recruitment',
            description: 'Browse open positions and manage applications.',
            buttons: [
                {
                    subcommand: 'list',
                    label: 'View Positions',
                    emoji: '\ud83d\udccb',
                    style: discord_js_1.ButtonStyle.Primary,
                },
                {
                    subcommand: 'apply',
                    label: 'Quick Apply',
                    emoji: '\ud83d\udcdd',
                    style: discord_js_1.ButtonStyle.Success,
                },
                { subcommand: 'my_apps', label: 'My Applications', emoji: '\ud83d\udcc4' },
                { subcommand: 'panel', label: 'Post Recruitment Panel', emoji: '\ud83d\udccc' },
            ],
        };
        await (0, commandPanelBuilder_1.replyWithCommandPanel)(interaction, panelConfig);
    },
    async handleButton(interaction) {
        if (interaction.customId.startsWith(recruitmentEmbeds_1.RECRUITMENT_MY_APPS_PAGE_PREFIX)) {
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
    async handleSelectMenu(interaction) {
        const dynSelectMatch = /^recruitment_dynselect_(.+)_(\d+)$/.exec(interaction.customId);
        if (dynSelectMatch) {
            const recruitmentId = dynSelectMatch[1];
            const selectIndex = Number(dynSelectMatch[2]);
            const pendingApp = pendingDynamicApplications.get(interaction.user.id);
            if (pendingApp?.recruitmentId !== recruitmentId) {
                await interaction.reply({
                    content: '❌ Application session expired. Please start over.',
                    flags: discord_js_1.MessageFlags.Ephemeral,
                });
                return;
            }
            const allQuestions = pendingApp.questions;
            const selectQuestions = allQuestions.filter(q => q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25);
            const textQuestions = allQuestions.filter(q => !(q.type === 'select' && q.options && q.options.length > 0 && q.options.length <= 25));
            const answeredQ = selectQuestions[selectIndex];
            if (answeredQ) {
                pendingApp.answers[answeredQ.id] = interaction.values[0];
                pendingApp.timestamp = Date.now();
            }
            const nextIndex = selectIndex + 1;
            if (nextIndex < selectQuestions.length) {
                await showNextSelectQuestion(interaction, recruitmentId, selectQuestions, nextIndex);
            }
            else if (textQuestions.length > 0) {
                const modal = buildDynamicApplicationModal(recruitmentId, textQuestions, 0);
                await interaction.showModal(modal);
            }
            else {
                await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
                await submitDynamicApplication(interaction, pendingApp);
            }
            return;
        }
        const selectMatch = /^recruitment_premodal_(.+)$/.exec(interaction.customId);
        if (selectMatch) {
            const recruitmentId = selectMatch[1];
            const selectedValue = interaction.values[0];
            const existing = pendingSelectAnswers.get(interaction.user.id);
            pendingSelectAnswers.set(interaction.user.id, {
                recruitmentId,
                answers: {
                    ...(existing?.recruitmentId === recruitmentId ? existing.answers : {}),
                    preferred_role: selectedValue,
                },
                timestamp: Date.now(),
            });
            await showApplicationModal(interaction, recruitmentId, '📋 Recruitment Application');
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'recruitment_panel_customize') {
            await handlePanelCustomizeSubmit(interaction);
            return;
        }
        const dynamicMatch = /^recruitment_apply_dyn_(.+)_(\d+)$/.exec(interaction.customId);
        if (dynamicMatch) {
            await handleDynamicApplicationPageSubmit(interaction, dynamicMatch[1], Number(dynamicMatch[2]));
            return;
        }
        const applyMatch = /^recruitment_apply_modal_(.+)$/.exec(interaction.customId);
        if (applyMatch) {
            await handleApplicationSubmit(interaction, applyMatch[1]);
        }
    },
};
async function handlePanelCustomizeSubmit(interaction) {
    const customTitle = interaction.fields.getTextInputValue('panel_title').trim() || undefined;
    const customDescription = interaction.fields.getTextInputValue('panel_description').trim() || undefined;
    const recruitment = await fetchLatestRecruitment(interaction.guildId);
    const isOpen = recruitment?.status === 'open';
    let embed;
    let buttons;
    if (recruitment && isOpen) {
        embed = (0, recruitmentEmbeds_1.buildRecruitmentPanelEmbed)(recruitment, customTitle, customDescription);
        buttons = (0, panelEmbed_1.buildPanelButtons)(RECRUITMENT_PANEL_CONFIG);
    }
    else if (recruitment) {
        embed = (0, recruitmentEmbeds_1.buildClosedRecruitmentPanelEmbed)(recruitment, customTitle, customDescription);
        buttons = buildDisabledPanelButtons(RECRUITMENT_PANEL_CONFIG);
    }
    else {
        const fallbackConfig = {
            ...RECRUITMENT_PANEL_CONFIG,
            title: customTitle ? `📋 ${customTitle}` : RECRUITMENT_PANEL_CONFIG.title,
            description: customDescription ??
                'No recruitment postings found. Create a recruitment on the web dashboard first.',
        };
        embed = (0, panelEmbed_1.buildPanelEmbed)(fallbackConfig);
        buttons = buildDisabledPanelButtons(RECRUITMENT_PANEL_CONFIG);
    }
    await interaction.reply({
        content: '✅ Recruitment panel created!',
        flags: discord_js_1.MessageFlags.Ephemeral,
    });
    await interaction.channel?.send({ embeds: [embed], components: [buttons] });
}
function buildDisabledPanelButtons(config) {
    const row = new discord_js_1.ActionRowBuilder();
    for (const btn of config.buttons) {
        const builder = new discord_js_1.ButtonBuilder()
            .setCustomId(`${config.prefix}_panel_${btn.action}`)
            .setLabel(btn.label)
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(true);
        if (btn.emoji) {
            builder.setEmoji(btn.emoji);
        }
        row.addComponents(builder);
    }
    return row;
}
async function _handleMyApplicationsButton(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const applications = await fetchMyApplications(interaction);
        if (applications.length === 0) {
            await interaction.editReply({
                content: "\ud83d\udced You haven't submitted any applications yet.",
            });
            return;
        }
        await interaction.editReply((0, recruitmentEmbeds_1.buildMyApplicationsView)(applications, 0));
    }
    catch (error) {
        await interaction.editReply({
            content: `\u274c Failed to fetch applications: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function fetchMyApplications(interaction) {
    const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment/my-applications`, {
        headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
        },
    });
    return response.data?.data ?? [];
}
async function handleMyApplicationsPageButton(interaction) {
    const page = Number.parseInt(interaction.customId.slice(recruitmentEmbeds_1.RECRUITMENT_MY_APPS_PAGE_PREFIX.length), 10);
    if (Number.isNaN(page) || page < 0) {
        return;
    }
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
        await interaction.editReply((0, recruitmentEmbeds_1.buildMyApplicationsView)(applications, page));
    }
    catch (error) {
        await interaction.editReply({
            content: `\u274c Failed to fetch applications: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function _handleCreatePanelButton(interaction) {
    if (!interaction.memberPermissions?.has('Administrator')) {
        await interaction.reply({
            content: '\u274c You need Administrator permissions to create a recruitment panel.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const modal = new discord_js_1.ModalBuilder()
        .setCustomId('recruitment_panel_customize')
        .setTitle('Customize Recruitment Panel');
    const titleInput = new discord_js_1.TextInputBuilder()
        .setCustomId('panel_title')
        .setPlaceholder('e.g., Join Our Organization')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(200);
    const descInput = new discord_js_1.TextInputBuilder()
        .setCustomId('panel_description')
        .setPlaceholder('Custom description for the embed...')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(2000);
    const titleLabel = new discord_js_1.LabelBuilder()
        .setLabel('Panel Title (leave blank for default)')
        .setTextInputComponent(titleInput);
    const descLabel = new discord_js_1.LabelBuilder()
        .setLabel('Panel Description (leave blank for default)')
        .setTextInputComponent(descInput);
    modal.addLabelComponents(titleLabel, descLabel);
    await interaction.showModal(modal);
}
async function fetchOpenRecruitments(interaction) {
    const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment`, {
        params: { status: 'open' },
        headers: { 'X-Discord-Guild-Id': interaction.guildId },
    });
    return (response.data.data ?? []);
}
function buildRecruitmentLoadErrorMessage(error) {
    const status = (0, errorHandler_1.isAxiosError)(error) ? error.response?.status : undefined;
    const respData = (0, errorHandler_1.isAxiosError)(error)
        ? error.response?.data
        : undefined;
    const apiError = respData?.error;
    const apiDetail = apiError ?? respData?.message;
    if ((0, errorHandler_1.isAxiosError)(error) &&
        (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))) {
        return '❌ The API did not respond in time. The server may be starting up — please try again in a moment.';
    }
    if (status === 403) {
        if (apiError?.includes('Direct access')) {
            return ('❌ The bot could not reach the API (blocked by Front Door).\n\n' +
                '• Ensure `BOT_API_INTERNAL_URL` is set to the internal API address.\n' +
                '• Ensure `BOT_INTERNAL_SECRET` matches between bot and API.');
        }
        let content = '❌ This Discord server is not linked to a Fringe Core organization, ' +
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
        let content = '❌ The bot could not authenticate to the API.\n\n' +
            '• Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both the API and bot environments.\n' +
            '• Restart the bot after changing environment variables.';
        if (apiDetail) {
            content += `\n\n🔍 API detail: ${apiDetail}`;
        }
        return content;
    }
    return `❌ Failed to load positions: ${(0, errorHandler_1.getErrorMessage)(error)}`;
}
function buildRecruitmentApplyRows(recruitments, style) {
    const rows = [];
    for (let i = 0; i < Math.min(recruitments.length, 25); i++) {
        if (i % 5 === 0 && rows.length < 5) {
            rows.push(new discord_js_1.ActionRowBuilder());
        }
        rows[Math.floor(i / 5)].addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_apply_${recruitments[i].id}`)
            .setLabel(`Apply: ${recruitments[i].title.substring(0, 20)}`)
            .setStyle(style)
            .setEmoji('📝'));
    }
    return rows;
}
async function handlePanelViewPositions(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const recruitments = await fetchOpenRecruitments(interaction);
        if (recruitments.length === 0) {
            await interaction.editReply({
                content: '📭 No open positions at this time. Check back later!',
            });
            return;
        }
        await interaction.editReply({
            embeds: [(0, recruitmentEmbeds_1.buildViewPositionsEmbed)(recruitments)],
            components: buildRecruitmentApplyRows(recruitments, discord_js_1.ButtonStyle.Primary),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recruitments via panel:', error);
        await interaction.editReply({ content: buildRecruitmentLoadErrorMessage(error) });
    }
}
async function handlePanelQuickApply(interaction) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
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
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`recruitment_apply_${recruitment.id}`)
                .setLabel(`Apply: ${recruitment.title.substring(0, 30)}`)
                .setStyle(discord_js_1.ButtonStyle.Success)
                .setEmoji('📝'));
            await interaction.editReply({
                embeds: [(0, recruitmentEmbeds_1.buildSingleQuickApplyEmbed)(recruitment)],
                components: [row],
            });
            return;
        }
        await interaction.editReply({
            embeds: [(0, recruitmentEmbeds_1.buildMultiQuickApplyEmbed)(recruitments)],
            components: buildRecruitmentApplyRows(recruitments, discord_js_1.ButtonStyle.Success),
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recruitments for quick apply:', error);
        await interaction.editReply({ content: buildRecruitmentLoadErrorMessage(error) });
    }
}
async function handleButtonViewRecruitment(interaction, recruitmentId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment/${recruitmentId}`, {
            headers: { 'X-Discord-Guild-Id': interaction.guildId },
        });
        const recruitment = response.data;
        const embed = (0, recruitmentEmbeds_1.buildRecruitmentDetailsEmbed)(recruitment);
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_apply_${recruitment.id}`)
            .setLabel('Apply Now')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('📝')
            .setDisabled(recruitment.status !== 'open'));
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
    catch (error) {
        logger_1.logger.error('Failed to fetch recruitment details via button:', error);
        await interaction.editReply({
            content: `❌ Failed to load recruitment: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function handleApplicationSubmit(interaction, recruitmentId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const rsiHandle = interaction.fields.getTextInputValue('rsi_handle');
    const timezone = interaction.fields.getTextInputValue('timezone');
    const experience = interaction.fields.getTextInputValue('experience');
    const availability = interaction.fields.getTextInputValue('availability');
    const motivation = interaction.fields.getTextInputValue('motivation');
    const pending = pendingSelectAnswers.get(interaction.user.id);
    const selectAnswers = pending?.recruitmentId === recruitmentId ? pending.answers : {};
    pendingSelectAnswers.delete(interaction.user.id);
    try {
        const payload = (0, recruitmentApplyPayload_1.buildLegacyRecruitmentApplyPayload)({
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
    }
    catch (error) {
        await replyRecruitmentApplyError(interaction, error);
    }
}
async function handleDynamicApplicationPageSubmit(interaction, recruitmentId, page) {
    const pendingApp = pendingDynamicApplications.get(interaction.user.id);
    if (pendingApp?.recruitmentId !== recruitmentId) {
        await interaction.reply({
            content: '❌ Your application session expired. Please start the application again.',
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    const modalQs = pendingApp.modalQuestions;
    const totalPages = Math.ceil(modalQs.length / DISCORD_MODAL_MAX_FIELDS);
    const start = page * DISCORD_MODAL_MAX_FIELDS;
    const pageQuestions = modalQs.slice(start, start + DISCORD_MODAL_MAX_FIELDS);
    for (const q of pageQuestions) {
        try {
            pendingApp.answers[q.id] = interaction.fields.getTextInputValue(q.id.slice(0, 100));
        }
        catch {
            pendingApp.answers[q.id] = '';
        }
    }
    pendingApp.timestamp = Date.now();
    if (page + 1 < totalPages) {
        const continueBtn = new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_apply_continue_${recruitmentId}_${page + 1}`)
            .setLabel(`Continue Application → Page ${page + 2}/${totalPages}`)
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('➡️');
        await interaction.reply({
            content: `✅ Page ${page + 1}/${totalPages} saved. Click below to continue.`,
            components: [new discord_js_1.ActionRowBuilder().addComponents(continueBtn)],
            flags: discord_js_1.MessageFlags.Ephemeral,
        });
        return;
    }
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    const pendingSelect = pendingSelectAnswers.get(interaction.user.id);
    const selectAnswers = pendingSelect?.recruitmentId === recruitmentId ? pendingSelect.answers : {};
    pendingSelectAnswers.delete(interaction.user.id);
    const payload = (0, recruitmentApplyPayload_1.buildDynamicRecruitmentApplyPayload)({
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
    }
    catch (error) {
        await replyRecruitmentApplyError(interaction, error);
    }
    finally {
        pendingDynamicApplications.delete(interaction.user.id);
    }
}
function getApplicationDiscordUserId(application) {
    const value = application.discordUserId;
    return typeof value === 'string' ? value : undefined;
}
function getApplicationDiscordUsername(application, fallback) {
    const value = application.discordUsername;
    if (typeof value === 'string' && value.trim().length > 0) {
        return value;
    }
    return fallback;
}
async function getRecruitmentConfig(guildId) {
    const settingsService = getSettingsService();
    const settings = await settingsService.getSettingsByGuildId(guildId ?? '');
    const recruitConfig = settings?.[0]?.recruitmentSettings;
    return recruitConfig ?? {};
}
async function updateApplicationStatus(interaction, recruitmentId, applicationId, action) {
    const response = await botApiClient_1.botApiClient.put(`${api_1.API_BASE_URL}/v2/recruitment/${recruitmentId}/applications/${applicationId}`, { action }, {
        headers: {
            'X-Discord-User-Id': interaction.user.id,
            'X-Discord-Guild-Id': interaction.guildId,
        },
    });
    return (response.data ?? {});
}
async function applyDecisionRoleIfConfigured(interaction, options) {
    const discordUserId = getApplicationDiscordUserId(options.application);
    if (!options.roleId || !discordUserId || !interaction.guild) {
        return false;
    }
    const canManageRoles = interaction.guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles) === true;
    if (!canManageRoles) {
        logger_1.logger.warn(options.missingPermissionMessage);
        return false;
    }
    try {
        const member = await interaction.guild.members.fetch(discordUserId);
        await member.roles.add(options.roleId, options.addReason);
        for (const removeRoleId of options.removalRoleIds ?? []) {
            await member.roles.remove(removeRoleId, options.removeReason).catch(() => { });
        }
        logger_1.logger.info(options.successLogMessage);
        return true;
    }
    catch (roleError) {
        logger_1.logger.warn('Failed to apply recruitment decision role:', roleError);
        return false;
    }
}
async function sendDecisionDmIfConfigured(interaction, application, template, applicationId) {
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
    }
    catch {
    }
}
async function postDecisionNoticeIfConfigured(interaction, application, applicationId, channelId, color, title, verb) {
    if (!channelId || !interaction.guild) {
        return;
    }
    try {
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel?.isTextBased()) {
            return;
        }
        const applicantName = getApplicationDiscordUsername(application, applicationId);
        const embed = (0, recruitmentEmbeds_1.buildDecisionNoticeEmbed)(color, title, applicantName, verb, interaction.user.username);
        await channel.send({ embeds: [embed] });
    }
    catch {
    }
}
async function tryArchiveApplicationThread(interaction, reason) {
    try {
        if (interaction.channel?.isThread()) {
            await interaction.channel.setArchived(true, reason);
        }
    }
    catch {
    }
}
async function handleAcceptApplication(interaction, recruitmentId, applicationId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const application = await updateApplicationStatus(interaction, recruitmentId, applicationId, 'accept');
        const recruitConfig = await getRecruitmentConfig(interaction.guildId);
        const roleAssigned = await applyDecisionRoleIfConfigured(interaction, {
            application,
            roleId: recruitConfig.acceptRoleId,
            removalRoleIds: recruitConfig.acceptedRemovalRoleIds,
            addReason: 'Recruitment application accepted',
            removeReason: 'Accepted — role removed',
            missingPermissionMessage: 'Recruitment: bot lacks ManageRoles, skipping accept role assignment',
            successLogMessage: `Added accept role ${recruitConfig.acceptRoleId ?? 'unknown'} to user ${getApplicationDiscordUserId(application) ?? 'unknown'}`,
        });
        await sendDecisionDmIfConfigured(interaction, application, recruitConfig.welcomeMessage, applicationId);
        await postDecisionNoticeIfConfigured(interaction, application, applicationId, recruitConfig.acceptedChannelId, embedBuilder_1.EmbedColors.SUCCESS, 'Application Accepted', 'accepted');
        const applicantName = getApplicationDiscordUsername(application, applicationId);
        await interaction.editReply({
            content: `✅ Application from **${applicantName}** has been **accepted**.${roleAssigned ? ' Role has been assigned.' : ''}`,
        });
        await tryArchiveApplicationThread(interaction, 'Application accepted');
        await (0, recruitmentApplicantChannel_1.closeApplicantChannel)(interaction.guild, applicationId, 'Application accepted');
    }
    catch (error) {
        logger_1.logger.error('Failed to accept application:', error);
        await interaction.editReply({
            content: `❌ Failed to accept application: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function handleDenyApplication(interaction, recruitmentId, applicationId) {
    await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
    try {
        const application = await updateApplicationStatus(interaction, recruitmentId, applicationId, 'reject');
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
        await sendDecisionDmIfConfigured(interaction, application, recruitConfig.deniedMessage, applicationId);
        await postDecisionNoticeIfConfigured(interaction, application, applicationId, recruitConfig.deniedChannelId, embedBuilder_1.EmbedColors.ERROR, 'Application Denied', 'denied');
        const applicantName = getApplicationDiscordUsername(application, applicationId);
        await interaction.editReply({
            content: `❌ Application from **${applicantName}** has been **denied**.`,
        });
        await tryArchiveApplicationThread(interaction, 'Application denied');
        await (0, recruitmentApplicantChannel_1.closeApplicantChannel)(interaction.guild, applicationId, 'Application denied');
    }
    catch (error) {
        logger_1.logger.error('Failed to deny application:', error);
        await interaction.editReply({
            content: `❌ Failed to deny application: ${(0, errorHandler_1.getErrorMessage)(error)}`,
        });
    }
}
async function createStaffReviewThread(interaction, recruitmentId, application, reviewInput) {
    try {
        const settingsService = getSettingsService();
        const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
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
        const botMember = interaction.guild.members.me;
        if (botMember) {
            const channelPerms = staffChannel.permissionsFor(botMember);
            if (channelPerms && !channelPerms.has(discord_js_1.PermissionFlagsBits.CreatePrivateThreads)) {
                logger_1.logger.warn(`Recruitment: bot lacks CreatePrivateThreads in channel ${staffChannelId}, skipping staff thread`);
                return;
            }
        }
        const thread = await staffChannel.threads.create({
            name: `📋 ${interaction.user.username} - Application`,
            type: discord_js_1.ChannelType.PrivateThread,
            reason: `Recruitment application from ${interaction.user.username}`,
        });
        const appRecord = application;
        const applicationId = appRecord.id || appRecord.applicationId || 'unknown';
        const reviewEmbed = (0, recruitmentEmbeds_1.buildStaffReviewEmbed)(interaction.user.username, recruitmentId, interaction.user.id, reviewInput);
        const actionRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_accept_${recruitmentId}_${applicationId}`)
            .setLabel('Accept')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId(`recruitment_deny_${recruitmentId}_${applicationId}`)
            .setLabel('Deny')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('❌'));
        const pingContent = staffPingRoleId ? `<@&${staffPingRoleId}> New application!` : '';
        await thread.send({
            content: pingContent || undefined,
            embeds: [reviewEmbed],
            components: [actionRow],
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to create staff review thread:', error);
    }
}
async function _checkReapplyCooldown(guildId, userId) {
    try {
        const settingsService = getSettingsService();
        const settings = await settingsService.getSettingsByGuildId(guildId);
        const cooldownDays = settings?.[0]?.recruitmentSettings?.reapplyCooldownDays;
        if (!cooldownDays || cooldownDays <= 0) {
            return true;
        }
        const response = await botApiClient_1.botApiClient.get(`${api_1.API_BASE_URL}/v2/recruitment/my-applications`, {
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
    }
    catch {
        return true;
    }
}
async function _shouldShowPreModalSelect(guildId, _recruitmentId) {
    try {
        const settingsService = getSettingsService();
        const settings = await settingsService.getSettingsByGuildId(guildId);
        const roles = settings?.[0]?.recruitmentSettings;
        return !!(roles &&
            Array.isArray(roles.preferredRoles) &&
            (roles.preferredRoles?.length ?? 0) > 0);
    }
    catch {
        return false;
    }
}
async function _showPreModalSelectMenu(interaction, recruitmentId) {
    try {
        const settingsService = getSettingsService();
        const settings = await settingsService.getSettingsByGuildId(interaction.guildId ?? '');
        const roles = settings?.[0]?.recruitmentSettings?.preferredRoles || [];
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`recruitment_premodal_${recruitmentId}`)
            .setPlaceholder('Select your preferred role')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(roles.slice(0, 25).map((role) => ({
            label: role,
            value: role.toLowerCase().replace(/\s+/g, '_'),
            description: `Apply as ${role}`,
        })));
        const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: '🎯 **Step 1 of 2:** Select your preferred role, then fill out the application form.',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
        else {
            await interaction.reply({
                content: '🎯 **Step 1 of 2:** Select your preferred role, then fill out the application form.',
                components: [row],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to show pre-modal select:', error);
        const modal = (0, panelEmbed_1.buildPanelModal)(`recruitment_apply_modal_${recruitmentId}`, '📋 Recruitment Application', APPLICATION_MODAL_FIELDS);
        if ('showModal' in interaction) {
            await interaction.showModal(modal);
        }
    }
}
//# sourceMappingURL=recruitment.js.map