import type { BestTimeWindow, GroupAvailabilityHeatmap } from '@sc-fleet-manager/shared-types';
import { EmbedBuilder } from 'discord.js';
export declare function buildNoTimeWindowsEmbed(duration: number, minAttendees: number): EmbedBuilder;
export declare function buildBestTimesEmbed(windows: readonly BestTimeWindow[], duration: number, minAttendees: number): EmbedBuilder;
export interface ConflictSummary {
    activityTitle: string;
    conflictType: string;
}
export declare function buildNoConflictsEmbed(startStr: string, endStr: string): EmbedBuilder;
export declare function buildConflictsListEmbed(conflicts: readonly ConflictSummary[], totalConflicts: number, startStr: string, endStr: string): EmbedBuilder;
export declare function buildSetAvailabilityEmbed(): EmbedBuilder;
export declare function buildNoAvailabilityEmbed(): EmbedBuilder;
export declare function buildAvailabilityHeatmapEmbed(heatmap: GroupAvailabilityHeatmap): EmbedBuilder;
export interface UserConflictSummary {
    activityTitle: string;
    activityType: string;
    scheduledStartDate: Date;
    conflictReason: string;
}
export declare function buildMyConflictsEmbed(conflicts: readonly UserConflictSummary[], totalConflicts: number): EmbedBuilder;
//# sourceMappingURL=scheduleEmbeds.d.ts.map