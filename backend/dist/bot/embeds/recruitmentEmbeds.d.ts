import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, type ColorResolvable } from 'discord.js';
import { type RecruitmentApplyPayload } from '../utils/recruitmentApplyPayload';
export interface RecruitmentEmbedItem {
    title: string;
    status: string;
    description?: string;
    rolesNeeded?: string[];
    currentApplicants?: number | null;
    maxPositions?: number | null;
}
export declare function getRecruitmentStatusEmoji(status: string): string;
export declare function formatApplicantCount(currentApplicants: number | null | undefined, maxPositions: number | null | undefined, separator?: '/' | ' / '): string;
export declare function buildViewPositionsEmbed(recruitments: readonly RecruitmentEmbedItem[]): EmbedBuilder;
export declare function buildSingleQuickApplyEmbed(recruitment: RecruitmentEmbedItem): EmbedBuilder;
export declare function buildMultiQuickApplyEmbed(recruitments: readonly RecruitmentEmbedItem[]): EmbedBuilder;
export declare function buildDiscordAccountLinkPromptEmbed(message: string): EmbedBuilder;
export declare function buildDecisionNoticeEmbed(color: ColorResolvable, title: string, applicantName: string, verb: string, actorUsername: string): EmbedBuilder;
export declare function buildApplicantChannelReceivedEmbed(discordUserId: string, staffRoleId: string): EmbedBuilder;
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
export declare function buildRecruitmentPanelEmbed(recruitment: RecruitmentSummary, customTitle?: string, customDescription?: string): EmbedBuilder;
export declare function buildClosedRecruitmentPanelEmbed(recruitment: RecruitmentSummary, customTitle?: string, customDescription?: string): EmbedBuilder;
export declare function buildRecruitmentDetailsEmbed(recruitment: RecruitmentDetailsInput): EmbedBuilder;
export interface StaffReviewThreadInput {
    payload: RecruitmentApplyPayload;
    legacySummary?: {
        availability?: string;
        experience?: string;
        motivation?: string;
        preferredRole?: string;
    };
    appliedAt?: string;
    applicationStatus?: string;
}
export declare function buildApplicationConfirmationEmbed(payload: RecruitmentApplyPayload): EmbedBuilder;
export declare function buildStaffReviewEmbed(username: string, recruitmentId: string, discordUserId: string, reviewInput: StaffReviewThreadInput): EmbedBuilder;
export interface MyApplicationView {
    status: string;
    recruitmentTitle?: string;
    appliedAt: string;
    interviewScheduledAt?: string;
}
export declare const RECRUITMENT_MY_APPS_PAGE_PREFIX = "recruitment_myappspage_";
export declare function buildMyApplicationsView(applications: MyApplicationView[], page: number): {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
};
//# sourceMappingURL=recruitmentEmbeds.d.ts.map