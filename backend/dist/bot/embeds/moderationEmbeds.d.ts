import { EmbedBuilder, type ColorResolvable } from 'discord.js';
import { type BlacklistSharingConfig } from '../../models/BlacklistSharingConfig';
import { MirrorActionStatus, type MirrorAction } from '../../models/MirrorAction';
import { IncidentSeverity, IncidentStatus, IncidentType, type ModerationIncident } from '../../models/ModerationIncident';
import { type ModerationAnalytics } from '../../services/discord/BlacklistAnalyticsService';
import { type CrossAllianceCheckResult, type SharedIncident } from '../../services/discord/BlacklistSharingService';
import { type BulkMirrorSummary, type MirrorResult } from '../../services/discord/MirrorActionService';
import { type UserIncidentSummary } from '../../services/discord/ModerationIncidentService';
export declare function getTypeEmoji(type: IncidentType): string;
export declare function getSeverityEmoji(severity: IncidentSeverity): string;
export declare function getSeverityColor(severity: IncidentSeverity): number;
export declare function getStatusEmoji(status: IncidentStatus): string;
export declare function getSeverityLabel(severity: IncidentSeverity): string;
export declare function getResultColor(success: boolean, requiresConfirmation?: boolean): ColorResolvable;
export declare function getMirrorStatusEmoji(status: MirrorActionStatus): string;
export declare function formatIncident(incident: ModerationIncident): string;
export declare function createSummaryEmbed(summary: UserIncidentSummary): EmbedBuilder;
export declare function buildMirrorActionResultEmbed(result: MirrorResult, incident: ModerationIncident, moderatorUsername: string): EmbedBuilder;
export declare function buildMirrorActionConfirmedEmbed(action: MirrorAction, moderatorUsername: string): EmbedBuilder;
export declare function buildMirrorActionCancelledEmbed(action: MirrorAction, moderatorUsername: string): EmbedBuilder;
export declare function buildIncidentRevokedEmbed(incident: ModerationIncident, reason: string | undefined, moderatorUsername: string): EmbedBuilder;
export declare function buildSharingSettingsUpdatedEmbed(changesList: string[], moderatorUsername: string): EmbedBuilder;
export declare function buildIncidentSharedEmbed(incident: ModerationIncident, moderatorUsername: string): EmbedBuilder;
export declare function buildIncidentListEmbed(result: {
    incidents: ModerationIncident[];
    total: number;
    page: number;
    totalPages: number;
}, page: number): EmbedBuilder;
export declare function buildAlliedAlertsEmbed(feed: {
    incidents: SharedIncident[];
    total: number;
    page: number;
    totalPages: number;
}, page: number): EmbedBuilder;
export declare function buildMirrorHistoryEmbed(history: {
    actions: MirrorAction[];
    total: number;
    page: number;
    totalPages: number;
}, targetUserId: string | null, page: number): EmbedBuilder;
export declare function buildBulkMirrorSummaryEmbed(summary: BulkMirrorSummary, targetAvatarUrl: string, moderatorUsername: string): EmbedBuilder;
export declare function buildSharingSettingsDisplayEmbed(config: BlacklistSharingConfig): EmbedBuilder;
export declare function buildModerationAnalyticsEmbed(analytics: ModerationAnalytics): EmbedBuilder;
export declare function buildIncidentReportedEmbed(incident: ModerationIncident, reason: string, duration: number | undefined, share: boolean, moderatorUsername: string): EmbedBuilder;
export declare function buildCrossAllianceCheckEmbed(result: CrossAllianceCheckResult, targetUsername: string, targetUserId: string, targetAvatarUrl: string): EmbedBuilder;
//# sourceMappingURL=moderationEmbeds.d.ts.map