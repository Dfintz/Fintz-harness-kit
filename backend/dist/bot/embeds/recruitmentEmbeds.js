"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RECRUITMENT_MY_APPS_PAGE_PREFIX = void 0;
exports.getRecruitmentStatusEmoji = getRecruitmentStatusEmoji;
exports.formatApplicantCount = formatApplicantCount;
exports.buildViewPositionsEmbed = buildViewPositionsEmbed;
exports.buildSingleQuickApplyEmbed = buildSingleQuickApplyEmbed;
exports.buildMultiQuickApplyEmbed = buildMultiQuickApplyEmbed;
exports.buildDiscordAccountLinkPromptEmbed = buildDiscordAccountLinkPromptEmbed;
exports.buildDecisionNoticeEmbed = buildDecisionNoticeEmbed;
exports.buildApplicantChannelReceivedEmbed = buildApplicantChannelReceivedEmbed;
exports.buildRecruitmentPanelEmbed = buildRecruitmentPanelEmbed;
exports.buildClosedRecruitmentPanelEmbed = buildClosedRecruitmentPanelEmbed;
exports.buildRecruitmentDetailsEmbed = buildRecruitmentDetailsEmbed;
exports.buildApplicationConfirmationEmbed = buildApplicationConfirmationEmbed;
exports.buildStaffReviewEmbed = buildStaffReviewEmbed;
exports.buildMyApplicationsView = buildMyApplicationsView;
const discord_js_1 = require("discord.js");
const embedBuilder_1 = require("../utils/embedBuilder");
const paginationControls_1 = require("../utils/paginationControls");
function getRecruitmentStatusEmoji(status) {
    if (status === 'open') {
        return '\u{1F7E2}';
    }
    if (status === 'paused') {
        return '\u{1F7E1}';
    }
    return '\u{1F534}';
}
function formatApplicantCount(currentApplicants, maxPositions, separator = '/') {
    const current = String(currentApplicants ?? 0);
    if (maxPositions === null || maxPositions === undefined) {
        return current;
    }
    return `${current}${separator}${String(maxPositions)}`;
}
function buildViewPositionsEmbed(recruitments) {
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.OPEN)
        .setTitle('\u{1F4CB} Open Recruitment Positions')
        .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
        .setTimestamp();
    for (const recruitment of recruitments.slice(0, 10)) {
        const statusEmoji = getRecruitmentStatusEmoji(recruitment.status);
        const rolesText = recruitment.rolesNeeded?.slice(0, 3).join(', ') || 'Various roles';
        const applicantCount = formatApplicantCount(recruitment.currentApplicants, recruitment.maxPositions);
        embed.addFields({
            name: `${statusEmoji} ${recruitment.title}`,
            value: [
                `\u{1F4DD} ${recruitment.description?.substring(0, 100)}${(recruitment.description?.length ?? 0) > 100 ? '...' : ''}`,
                `\u{1F3AF} Roles: ${rolesText}`,
                `\u{1F465} Applicants: ${applicantCount}`,
            ].join('\n'),
            inline: false,
        });
    }
    return embed.build();
}
function buildSingleQuickApplyEmbed(recruitment) {
    const summary = recruitment.description?.trim();
    const description = summary && summary.length > 0 ? summary.substring(0, 200) : 'No description';
    const formattedDescription = summary && summary.length > 200 ? `${description}...` : description;
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.OPEN)
        .setTitle(`\u{1F4CB} ${recruitment.title}`)
        .setDescription(formattedDescription)
        .addFields({
        name: '\u{1F3AF} Roles',
        value: recruitment.rolesNeeded?.slice(0, 5).join(', ') || 'Various roles',
        inline: true,
    }, {
        name: '\u{1F465} Applicants',
        value: String(recruitment.currentApplicants ?? 0) +
            (recruitment.maxPositions ? `/${String(recruitment.maxPositions)}` : ''),
        inline: true,
    })
        .setFooter({ text: 'Click Apply below to submit your application' })
        .setTimestamp()
        .build();
}
function buildMultiQuickApplyEmbed(recruitments) {
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.OPEN)
        .setTitle('\u{1F4CB} Quick Apply \u2014 Open Positions')
        .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
        .setTimestamp();
    for (const recruitment of recruitments.slice(0, 10)) {
        const rolesText = recruitment.rolesNeeded?.slice(0, 3).join(', ') || 'Various roles';
        const applicants = String(recruitment.currentApplicants ?? 0) +
            (recruitment.maxPositions ? `/${String(recruitment.maxPositions)}` : '');
        embed.addFields({
            name: `\u{1F7E2} ${recruitment.title}`,
            value: `\u{1F3AF} ${rolesText} \u00b7 \u{1F465} ${applicants}`,
            inline: false,
        });
    }
    return embed.build();
}
function buildDiscordAccountLinkPromptEmbed(message) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle('\u{1F517} Discord Account Not Linked')
        .setDescription(`${message}\n\n` +
        '**Next steps:**\n' +
        '1\uFE0F\u20E3 Click **Sign In with Discord** below\n' +
        '2\uFE0F\u20E3 Complete login on the web app\n' +
        '3\uFE0F\u20E3 Return here and apply again')
        .setTimestamp()
        .build();
}
function buildDecisionNoticeEmbed(color, title, applicantName, verb, actorUsername) {
    return embedBuilder_1.SCFleetEmbed.create()
        .setColor(color)
        .setTitle(title)
        .setDescription(`**${applicantName}** has been ${verb} by ${actorUsername}`)
        .setTimestamp()
        .build();
}
function buildApplicantChannelReceivedEmbed(discordUserId, staffRoleId) {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle('\u{1F4E8} Application received')
        .setDescription(`Hi <@${discordUserId}>! Your application has been received. A recruiter ` +
        `(<@&${staffRoleId}>) will reach out here shortly \u2014 feel free to add anything in the meantime.`)
        .setTimestamp();
}
function isAbsoluteHttpUrl(value) {
    if (!value) {
        return false;
    }
    return /^https?:\/\//i.test(value);
}
function buildRecruitmentPanelEmbed(recruitment, customTitle, customDescription) {
    const appUrl = process.env.APP_URL ?? 'https://fringecore.space';
    const recruitmentUrl = `${appUrl}/recruitment/${recruitment.id}`;
    const rawTitle = customTitle?.trim() ?? recruitment.title?.trim() ?? 'Join Our Organization';
    const title = `\u{1F4CB} ${rawTitle}`.slice(0, 256);
    const description = customDescription?.trim() ??
        recruitment.description?.trim() ??
        "We're recruiting \u2014 apply below!";
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.OPEN)
        .setTitle(title)
        .setDescription(description.slice(0, 4000))
        .setTimestamp()
        .build();
    embed.setURL(recruitmentUrl);
    if (recruitment.organizationName) {
        embed.setAuthor({
            name: recruitment.organizationName.slice(0, 256),
            iconURL: isAbsoluteHttpUrl(recruitment.organizationLogoUrl)
                ? recruitment.organizationLogoUrl
                : undefined,
        });
    }
    if (isAbsoluteHttpUrl(recruitment.bannerImageUrl)) {
        embed.setImage(recruitment.bannerImageUrl);
    }
    const rolesText = recruitment.rolesNeeded && recruitment.rolesNeeded.length > 0
        ? recruitment.rolesNeeded.join(', ')
        : 'All roles';
    embed.addFields({
        name: '\u{1F3AF} Roles Needed',
        value: rolesText.slice(0, 1024),
        inline: true,
    });
    const applicantsText = `${recruitment.currentApplicants ?? 0}${recruitment.maxPositions ? ` / ${recruitment.maxPositions}` : ''}`;
    embed.addFields({ name: '\u{1F465} Applicants', value: applicantsText, inline: true });
    if (recruitment.expiresAt) {
        const ts = Math.floor(new Date(recruitment.expiresAt).getTime() / 1000);
        if (Number.isFinite(ts)) {
            embed.addFields({ name: '\u23f3 Expires', value: `<t:${ts}:R>`, inline: true });
        }
    }
    if (recruitment.tags && recruitment.tags.length > 0) {
        embed.addFields({
            name: '\u{1F3F7}\uFE0F Tags',
            value: recruitment.tags.join(', ').slice(0, 1024),
            inline: false,
        });
    }
    if (recruitment.requirements?.trim()) {
        embed.addFields({
            name: '\u{1F4CB} Requirements',
            value: recruitment.requirements.trim().slice(0, 1024),
            inline: false,
        });
    }
    embed.addFields({
        name: '\u{1F517} Web',
        value: `[View full posting](${recruitmentUrl})`,
        inline: false,
    });
    embed.setFooter({ text: 'Click View Positions or Quick Apply below to get started' });
    return embed;
}
function buildClosedRecruitmentPanelEmbed(recruitment, customTitle, customDescription) {
    const appUrl = process.env.APP_URL ?? 'https://fringecore.space';
    const recruitmentUrl = `${appUrl}/recruitment/${recruitment.id}`;
    const statusLabel = recruitment.status === 'paused' ? 'Paused' : 'Closed';
    const rawTitle = customTitle?.trim() ?? recruitment.title?.trim() ?? 'Recruitment';
    const title = `\u{1F512} ${rawTitle} \u2014 ${statusLabel}`.slice(0, 256);
    const description = customDescription?.trim() ??
        `Recruitment is currently **${statusLabel.toLowerCase()}**. Check back later for new openings!`;
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.CLOSED)
        .setTitle(title)
        .setDescription(description.slice(0, 4000))
        .setTimestamp()
        .build();
    embed.setURL(recruitmentUrl);
    if (recruitment.organizationName) {
        embed.setAuthor({
            name: recruitment.organizationName.slice(0, 256),
            iconURL: isAbsoluteHttpUrl(recruitment.organizationLogoUrl)
                ? recruitment.organizationLogoUrl
                : undefined,
        });
    }
    embed.setFooter({ text: `Recruitment is ${statusLabel.toLowerCase()} \u2014 buttons disabled` });
    return embed;
}
function buildRecruitmentDetailsEmbed(recruitment) {
    const statusEmoji = getRecruitmentStatusEmoji(recruitment.status);
    const applicantCount = formatApplicantCount(recruitment.currentApplicants, recruitment.maxPositions, ' / ');
    const organizationName = recruitment.organizationName ?? 'Unknown';
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(recruitment.status === 'open' ? embedBuilder_1.EmbedColors.OPEN : embedBuilder_1.EmbedColors.ERROR)
        .setTitle(`${statusEmoji} ${recruitment.title}`)
        .setDescription(recruitment.description)
        .addFields({ name: '\u{1F4CA} Status', value: recruitment.status, inline: true }, { name: '\u{1F465} Applicants', value: applicantCount, inline: true }, { name: '\u{1F3E2} Organization', value: organizationName, inline: true })
        .setTimestamp()
        .build();
    if (recruitment.rolesNeeded && recruitment.rolesNeeded.length > 0) {
        embed.addFields({
            name: '\u{1F3AF} Roles Needed',
            value: recruitment.rolesNeeded.map(role => `\u2022 ${role}`).join('\n'),
            inline: false,
        });
    }
    if (recruitment.requirements) {
        embed.addFields({
            name: '\u{1F4CB} Requirements',
            value: recruitment.requirements.substring(0, 1000),
            inline: false,
        });
    }
    return embed;
}
const LEGACY_RECRUITMENT_QUESTION_IDS = new Set([
    'legacy_experience',
    'legacy_availability',
    'legacy_motivation',
]);
function toDisplayList(values) {
    if (!values || values.length === 0) {
        return undefined;
    }
    const items = values.map(value => value.trim()).filter(Boolean);
    if (items.length === 0) {
        return undefined;
    }
    return items.join(', ');
}
function buildApplicationConfirmationEmbed(payload) {
    const fields = [];
    if (payload.rsiHandle) {
        fields.push({
            name: '\u{1F3AE} RSI Handle',
            value: payload.rsiHandle.slice(0, 1024),
            inline: true,
        });
    }
    if (payload.timezone) {
        fields.push({
            name: '\u{1F30D} Timezone',
            value: payload.timezone.slice(0, 1024),
            inline: true,
        });
    }
    const availability = toDisplayList(payload.availablePlaytimes);
    if (availability) {
        fields.push({ name: '\u23f0 Availability', value: availability.slice(0, 1024), inline: true });
    }
    const preferredRoles = toDisplayList(payload.preferredRoles);
    if (preferredRoles) {
        fields.push({
            name: '\u{1F3AF} Preferred Roles',
            value: preferredRoles.slice(0, 1024),
            inline: true,
        });
    }
    const answerFields = (payload.answers ?? [])
        .filter(answer => answer.answer.trim().length > 0)
        .slice(0, 8)
        .map(answer => ({
        name: answer.question.slice(0, 256),
        value: answer.answer.slice(0, 1024),
        inline: false,
    }));
    if (answerFields.length > 0) {
        fields.push(...answerFields);
    }
    else if (payload.message) {
        fields.push({
            name: '\u{1F4AC} Message',
            value: payload.message.slice(0, 1024),
            inline: false,
        });
    }
    const embed = embedBuilder_1.SCFleetEmbed.success('Application Submitted!', 'Your application has been received and will be reviewed by our team.')
        .setFooter({ text: 'Use /recruitment my-applications to check your status' })
        .setTimestamp()
        .build();
    if (fields.length > 0) {
        embed.addFields(...fields);
    }
    return embed;
}
function buildStaffReviewFields(discordUserId, reviewInput) {
    const reviewFields = [
        { name: '\u{1F464} Discord', value: `<@${discordUserId}>`, inline: true },
    ];
    if (reviewInput.appliedAt) {
        const ts = Math.floor(new Date(reviewInput.appliedAt).getTime() / 1000);
        if (Number.isFinite(ts)) {
            reviewFields.push({
                name: '\u{1F4C5} Applied',
                value: `<t:${ts}:F>`,
                inline: true,
            });
        }
    }
    if (reviewInput.applicationStatus) {
        const stageLabel = reviewInput.applicationStatus === 'pending'
            ? '1\uFE0F\u20E3 Applied'
            : reviewInput.applicationStatus === 'under_review'
                ? '2\uFE0F\u20E3 Reviewing'
                : reviewInput.applicationStatus === 'interview_scheduled'
                    ? '3\uFE0F\u20E3 Interview'
                    : reviewInput.applicationStatus === 'accepted'
                        ? '4\uFE0F\u20E3 Accepted'
                        : reviewInput.applicationStatus === 'rejected'
                            ? '4\uFE0F\u20E3 Rejected'
                            : reviewInput.applicationStatus.replace(/_/g, ' ');
        reviewFields.push({
            name: '\u{1F4CA} Stage',
            value: stageLabel,
            inline: true,
        });
    }
    if (reviewInput.payload.rsiHandle) {
        reviewFields.push({
            name: '\u{1F3AE} RSI Handle',
            value: reviewInput.payload.rsiHandle.slice(0, 1024),
            inline: true,
        });
    }
    if (reviewInput.payload.timezone) {
        reviewFields.push({
            name: '\u{1F30D} Timezone',
            value: reviewInput.payload.timezone.slice(0, 1024),
            inline: true,
        });
    }
    const availability = reviewInput.legacySummary?.availability ??
        toDisplayList(reviewInput.payload.availablePlaytimes);
    if (availability) {
        reviewFields.push({
            name: '\u23f0 Availability',
            value: availability.slice(0, 1024),
            inline: false,
        });
    }
    const experience = reviewInput.legacySummary?.experience;
    if (experience) {
        reviewFields.push({
            name: '\u{1F4DD} Experience',
            value: experience.slice(0, 1024),
            inline: false,
        });
    }
    const motivation = reviewInput.legacySummary?.motivation ?? reviewInput.payload.message;
    if (motivation) {
        reviewFields.push({
            name: '\u{1F4A1} Motivation',
            value: motivation.slice(0, 1024),
            inline: false,
        });
    }
    const preferredRole = reviewInput.legacySummary?.preferredRole ?? toDisplayList(reviewInput.payload.preferredRoles);
    if (preferredRole) {
        reviewFields.push({
            name: '\u{1F3AF} Preferred Role',
            value: preferredRole.slice(0, 1024),
            inline: true,
        });
    }
    const genericAnswers = (reviewInput.payload.answers ?? [])
        .filter(answer => answer.answer.trim().length > 0)
        .filter(answer => !LEGACY_RECRUITMENT_QUESTION_IDS.has(answer.questionId))
        .slice(0, 6);
    for (const answer of genericAnswers) {
        reviewFields.push({
            name: `\u2753 ${answer.question}`.slice(0, 256),
            value: answer.answer.slice(0, 1024),
            inline: false,
        });
    }
    return reviewFields;
}
function buildStaffReviewEmbed(username, recruitmentId, discordUserId, reviewInput) {
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.WARNING)
        .setTitle(`\u{1F4CB} New Application: ${username}`)
        .setDescription(`Application for recruitment **${recruitmentId}**`)
        .setTimestamp()
        .build();
    const reviewFields = buildStaffReviewFields(discordUserId, reviewInput);
    if (reviewFields.length > 0) {
        embed.addFields(...reviewFields);
    }
    return embed;
}
exports.RECRUITMENT_MY_APPS_PAGE_PREFIX = 'recruitment_myappspage_';
const RECRUITMENT_MY_APPS_PAGE_SIZE = 10;
function getStatusEmoji(status) {
    switch (status) {
        case 'pending':
            return '\u23f3';
        case 'under_review':
            return '\u{1F50D}';
        case 'interview_scheduled':
            return '\u{1F4C5}';
        case 'accepted':
            return '\u2705';
        case 'rejected':
            return '\u274c';
        case 'withdrawn':
            return '\u21a9\uFE0F';
        case 'waitlisted':
            return '\u{1F4CB}';
        default:
            return '\u2753';
    }
}
function buildMyApplicationsView(applications, page) {
    const { pageItems, page: currentPage, totalPages, total, } = (0, paginationControls_1.paginate)(applications, page, RECRUITMENT_MY_APPS_PAGE_SIZE);
    const embed = embedBuilder_1.SCFleetEmbed.create()
        .setColor(embedBuilder_1.EmbedColors.SC_BLUE)
        .setTitle('\u{1F4CB} Your Applications')
        .setDescription(`You have submitted ${total} application(s)`)
        .setTimestamp()
        .build();
    for (const app of pageItems) {
        const statusEmoji = getStatusEmoji(app.status);
        embed.addFields({
            name: `${statusEmoji} ${app.recruitmentTitle || 'Unknown Position'}`,
            value: [
                `Status: \`${app.status}\``,
                `Applied: <t:${Math.floor(new Date(app.appliedAt).getTime() / 1000)}:R>`,
                app.interviewScheduledAt
                    ? `\u{1F4C5} Interview: <t:${Math.floor(new Date(app.interviewScheduledAt).getTime() / 1000)}:F>`
                    : '',
            ]
                .filter(Boolean)
                .join('\n'),
            inline: false,
        });
    }
    if (totalPages > 1) {
        embed.setFooter({
            text: `Page ${currentPage + 1} of ${totalPages} \u2022 ${total} applications`,
        });
    }
    const navRow = (0, paginationControls_1.buildPaginationRow)({
        page: currentPage,
        totalPages,
        makeCustomId: targetPage => `${exports.RECRUITMENT_MY_APPS_PAGE_PREFIX}${targetPage}`,
    });
    return { embeds: [embed], components: navRow ? [navRow] : [] };
}
//# sourceMappingURL=recruitmentEmbeds.js.map