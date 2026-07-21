import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, type ColorResolvable } from 'discord.js';

import { EmbedColors, SCFleetEmbed } from '../utils/embedBuilder';
import { buildPaginationRow, paginate } from '../utils/paginationControls';
import { type RecruitmentApplyPayload } from '../utils/recruitmentApplyPayload';

/**
 * Pure builders for the recruitment "view positions / quick apply" embeds, extracted from
 * `commands/recruitment.ts` so they render through the shared `SCFleetEmbed` factory with the
 * branded `OPEN` color instead of raw `0x00ff88`. The shared status-emoji + applicant-count helpers
 * live here too because one inline recruitment embed also consumes them.
 */

/** Narrow render shape the recruitment listing embeds read (a `RecruitmentListItem` minus `id`). */
export interface RecruitmentEmbedItem {
  title: string;
  status: string;
  description?: string;
  rolesNeeded?: string[];
  currentApplicants?: number | null;
  maxPositions?: number | null;
}

/** Maps a recruitment status to its indicator emoji. */
export function getRecruitmentStatusEmoji(status: string): string {
  if (status === 'open') {
    return '\u{1F7E2}';
  }
  if (status === 'paused') {
    return '\u{1F7E1}';
  }
  return '\u{1F534}';
}

/** Formats an applicant count as `current` or `current<sep>max`. */
export function formatApplicantCount(
  currentApplicants: number | null | undefined,
  maxPositions: number | null | undefined,
  separator: '/' | ' / ' = '/'
): string {
  const current = String(currentApplicants ?? 0);
  if (maxPositions === null || maxPositions === undefined) {
    return current;
  }
  return `${current}${separator}${String(maxPositions)}`;
}

/** Embed listing up to 10 open recruitment positions (one field per position). */
export function buildViewPositionsEmbed(
  recruitments: readonly RecruitmentEmbedItem[]
): EmbedBuilder {
  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.OPEN)
    .setTitle('\u{1F4CB} Open Recruitment Positions')
    .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
    .setTimestamp();

  for (const recruitment of recruitments.slice(0, 10)) {
    const statusEmoji = getRecruitmentStatusEmoji(recruitment.status);
    const rolesText = recruitment.rolesNeeded?.slice(0, 3).join(', ') || 'Various roles';
    const applicantCount = formatApplicantCount(
      recruitment.currentApplicants,
      recruitment.maxPositions
    );

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

/** Embed for a single open position with an inline Apply prompt. */
export function buildSingleQuickApplyEmbed(recruitment: RecruitmentEmbedItem): EmbedBuilder {
  const summary = recruitment.description?.trim();
  const description = summary && summary.length > 0 ? summary.substring(0, 200) : 'No description';
  const formattedDescription = summary && summary.length > 200 ? `${description}...` : description;
  return SCFleetEmbed.create()
    .setColor(EmbedColors.OPEN)
    .setTitle(`\u{1F4CB} ${recruitment.title}`)
    .setDescription(formattedDescription)
    .addFields(
      {
        name: '\u{1F3AF} Roles',
        value: recruitment.rolesNeeded?.slice(0, 5).join(', ') || 'Various roles',
        inline: true,
      },
      {
        name: '\u{1F465} Applicants',
        value:
          String(recruitment.currentApplicants ?? 0) +
          (recruitment.maxPositions ? `/${String(recruitment.maxPositions)}` : ''),
        inline: true,
      }
    )
    .setFooter({ text: 'Click Apply below to submit your application' })
    .setTimestamp()
    .build();
}

/** Compact embed listing up to 10 open positions for the multi quick-apply flow. */
export function buildMultiQuickApplyEmbed(
  recruitments: readonly RecruitmentEmbedItem[]
): EmbedBuilder {
  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.OPEN)
    .setTitle('\u{1F4CB} Quick Apply \u2014 Open Positions')
    .setDescription(`${recruitments.length} position(s) available. Click a button below to apply!`)
    .setTimestamp();

  for (const recruitment of recruitments.slice(0, 10)) {
    const rolesText = recruitment.rolesNeeded?.slice(0, 3).join(', ') || 'Various roles';
    const applicants =
      String(recruitment.currentApplicants ?? 0) +
      (recruitment.maxPositions ? `/${String(recruitment.maxPositions)}` : '');
    embed.addFields({
      name: `\u{1F7E2} ${recruitment.title}`,
      value: `\u{1F3AF} ${rolesText} \u00b7 \u{1F465} ${applicants}`,
      inline: false,
    });
  }

  return embed.build();
}

/** Prompt shown when the caller's Discord account is not linked (recruitment apply flow). */
export function buildDiscordAccountLinkPromptEmbed(message: string): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
    .setTitle('\u{1F517} Discord Account Not Linked')
    .setDescription(
      `${message}\n\n` +
        '**Next steps:**\n' +
        '1\uFE0F\u20E3 Click **Sign In with Discord** below\n' +
        '2\uFE0F\u20E3 Complete login on the web app\n' +
        '3\uFE0F\u20E3 Return here and apply again'
    )
    .setTimestamp()
    .build();
}

/** Notice posted to a staff channel when an application is accepted/denied. */
export function buildDecisionNoticeEmbed(
  color: ColorResolvable,
  title: string,
  applicantName: string,
  verb: string,
  actorUsername: string
): EmbedBuilder {
  return SCFleetEmbed.create()
    .setColor(color)
    .setTitle(title)
    .setDescription(`**${applicantName}** has been ${verb} by ${actorUsername}`)
    .setTimestamp()
    .build();
}

/** Welcome message posted in the applicant channel after successful channel creation. */
export function buildApplicantChannelReceivedEmbed(
  discordUserId: string,
  staffRoleId: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x00aaff)
    .setTitle('\u{1F4E8} Application received')
    .setDescription(
      `Hi <@${discordUserId}>! Your application has been received. A recruiter ` +
        `(<@&${staffRoleId}>) will reach out here shortly \u2014 feel free to add anything in the meantime.`
    )
    .setTimestamp();
}

/**
 * Recruitment summary shape rendered by the panel embeds (mirrors
 * `RecruitmentController.transformToRecruitment`). Owned here as the recruitment render contract and
 * re-exported from `commands/recruitment.ts` for the command-flow consumers.
 */
export interface RecruitmentSummary {
  id: string;
  title?: string;
  description?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  bannerImageUrl?: string;
  rolesNeeded?: string[];
  tags?: string[];
  requirements?: string;
  currentApplicants?: number;
  maxPositions?: number;
  expiresAt?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Required-field render shape for the recruitment-details (view) embed (details-by-id endpoint). */
export interface RecruitmentDetailsInput {
  id: string;
  status: string;
  title: string;
  description: string;
  currentApplicants?: number | null;
  maxPositions?: number | null;
  organizationName?: string;
  rolesNeeded?: string[];
  requirements?: string;
}

function isAbsoluteHttpUrl(value: string | undefined | null): value is string {
  if (!value) {
    return false;
  }
  return /^https?:\/\//i.test(value);
}

/** Panel embed for an OPEN recruitment posting (mirrors the web posting view). */
export function buildRecruitmentPanelEmbed(
  recruitment: RecruitmentSummary,
  customTitle?: string,
  customDescription?: string
): EmbedBuilder {
  const appUrl = process.env.APP_URL ?? 'https://fringecore.space';
  const recruitmentUrl = `${appUrl}/recruitment/${recruitment.id}`;
  const rawTitle = customTitle?.trim() ?? recruitment.title?.trim() ?? 'Join Our Organization';
  const title = `\u{1F4CB} ${rawTitle}`.slice(0, 256);
  const description =
    customDescription?.trim() ??
    recruitment.description?.trim() ??
    "We're recruiting \u2014 apply below!";

  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.OPEN)
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

  const rolesText =
    recruitment.rolesNeeded && recruitment.rolesNeeded.length > 0
      ? recruitment.rolesNeeded.join(', ')
      : 'All roles';
  embed.addFields({
    name: '\u{1F3AF} Roles Needed',
    value: rolesText.slice(0, 1024),
    inline: true,
  });

  const applicantsText = `${recruitment.currentApplicants ?? 0}${
    recruitment.maxPositions ? ` / ${recruitment.maxPositions}` : ''
  }`;
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

/** Panel embed for a CLOSED/paused recruitment posting (buttons disabled). */
export function buildClosedRecruitmentPanelEmbed(
  recruitment: RecruitmentSummary,
  customTitle?: string,
  customDescription?: string
): EmbedBuilder {
  const appUrl = process.env.APP_URL ?? 'https://fringecore.space';
  const recruitmentUrl = `${appUrl}/recruitment/${recruitment.id}`;
  const statusLabel = recruitment.status === 'paused' ? 'Paused' : 'Closed';
  const rawTitle = customTitle?.trim() ?? recruitment.title?.trim() ?? 'Recruitment';
  const title = `\u{1F512} ${rawTitle} \u2014 ${statusLabel}`.slice(0, 256);
  const description =
    customDescription?.trim() ??
    `Recruitment is currently **${statusLabel.toLowerCase()}**. Check back later for new openings!`;

  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.CLOSED)
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

/** Detailed view embed for a single recruitment (the "View" button flow). */
export function buildRecruitmentDetailsEmbed(recruitment: RecruitmentDetailsInput): EmbedBuilder {
  const statusEmoji = getRecruitmentStatusEmoji(recruitment.status);
  const applicantCount = formatApplicantCount(
    recruitment.currentApplicants,
    recruitment.maxPositions,
    ' / '
  );
  const organizationName = recruitment.organizationName ?? 'Unknown';

  const embed = SCFleetEmbed.create()
    .setColor(recruitment.status === 'open' ? EmbedColors.OPEN : EmbedColors.ERROR)
    .setTitle(`${statusEmoji} ${recruitment.title}`)
    .setDescription(recruitment.description)
    .addFields(
      { name: '\u{1F4CA} Status', value: recruitment.status, inline: true },
      { name: '\u{1F465} Applicants', value: applicantCount, inline: true },
      { name: '\u{1F3E2} Organization', value: organizationName, inline: true }
    )
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

/** Staff-review thread render input (the application payload + an optional legacy summary). */
export interface StaffReviewThreadInput {
  payload: RecruitmentApplyPayload;
  legacySummary?: {
    availability?: string;
    experience?: string;
    motivation?: string;
    preferredRole?: string;
  };
  /** ISO 8601 string for when the application was submitted. */
  appliedAt?: string;
  /** Current application status (e.g. 'pending', 'under_review'). */
  applicationStatus?: string;
}

/** Joins a trimmed, non-empty string list with `, ` (or undefined when empty). */
function toDisplayList(values: string[] | undefined): string | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  const items = values.map(value => value.trim()).filter(Boolean);
  if (items.length === 0) {
    return undefined;
  }
  return items.join(', ');
}

/** Embed confirming a submitted recruitment application (echoes the applicant's answers). */
export function buildApplicationConfirmationEmbed(payload: RecruitmentApplyPayload): EmbedBuilder {
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

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
  } else if (payload.message) {
    fields.push({
      name: '\u{1F4AC} Message',
      value: payload.message.slice(0, 1024),
      inline: false,
    });
  }

  const embed = SCFleetEmbed.success(
    'Application Submitted!',
    'Your application has been received and will be reviewed by our team.'
  )
    .setFooter({ text: 'Use /recruitment my-applications to check your status' })
    .setTimestamp()
    .build();

  if (fields.length > 0) {
    embed.addFields(...fields);
  }

  return embed;
}

/** Builds the staff-review embed fields from the application payload + optional legacy summary. */
function buildStaffReviewFields(
  discordUserId: string,
  reviewInput: StaffReviewThreadInput
): Array<{ name: string; value: string; inline: boolean }> {
  const reviewFields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: '\u{1F464} Discord', value: `<@${discordUserId}>`, inline: true },
  ];

  // Timestamp of submission
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

  // Current flow state
  if (reviewInput.applicationStatus) {
    const stageLabel =
      reviewInput.applicationStatus === 'pending'
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

  const availability =
    reviewInput.legacySummary?.availability ??
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

  const preferredRole =
    reviewInput.legacySummary?.preferredRole ?? toDisplayList(reviewInput.payload.preferredRoles);
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

/** Staff-review thread embed (posted to the staff channel for a new application). */
export function buildStaffReviewEmbed(
  username: string,
  recruitmentId: string,
  discordUserId: string,
  reviewInput: StaffReviewThreadInput
): EmbedBuilder {
  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.WARNING)
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

/**
 * Wire shape of a my-applications entry. Dates arrive as ISO strings over JSON,
 * not `Date`. Only the fields the bot view renders are typed — the API returns
 * `UserApplicationWithContext` (recruitmentController), a much wider shape.
 */
export interface MyApplicationView {
  status: string;
  recruitmentTitle?: string;
  appliedAt: string;
  interviewScheduledAt?: string;
}

/** customId prefix for the "Your Applications" pagination buttons (handler parses it). */
export const RECRUITMENT_MY_APPS_PAGE_PREFIX = 'recruitment_myappspage_';
const RECRUITMENT_MY_APPS_PAGE_SIZE = 10;

/** Application-status emoji for the my-applications list (distinct from getRecruitmentStatusEmoji). */
function getStatusEmoji(status: string): string {
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

/**
 * Build one page of the "Your Applications" list embed + pagination controls.
 * Pure — the caller decides whether to `editReply` (initial) or `editReply`
 * after `deferUpdate` (paging). Exported for unit testing.
 */
export function buildMyApplicationsView(
  applications: MyApplicationView[],
  page: number
): { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] } {
  const {
    pageItems,
    page: currentPage,
    totalPages,
    total,
  } = paginate(applications, page, RECRUITMENT_MY_APPS_PAGE_SIZE);

  const embed = SCFleetEmbed.create()
    .setColor(EmbedColors.SC_BLUE)
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

  const navRow = buildPaginationRow({
    page: currentPage,
    totalPages,
    makeCustomId: targetPage => `${RECRUITMENT_MY_APPS_PAGE_PREFIX}${targetPage}`,
  });

  return { embeds: [embed], components: navRow ? [navRow] : [] };
}
