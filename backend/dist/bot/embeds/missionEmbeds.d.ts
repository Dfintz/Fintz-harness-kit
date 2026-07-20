import { EmbedBuilder } from 'discord.js';
import { Mission, MissionDifficulty, MissionPriority, MissionStatus, MissionType } from '../../models/Mission';
export declare function getMissionTypeEmoji(type: MissionType): string;
export declare function getStatusEmoji(status: MissionStatus): string;
export declare function getStatusColor(status: MissionStatus): number;
export declare function getDifficultyEmoji(difficulty: MissionDifficulty): string;
export declare function getPriorityEmoji(priority: MissionPriority): string;
export declare function capitalise(s: string): string;
export declare function buildMissionDetailEmbed(mission: Readonly<Mission>): EmbedBuilder;
export declare function buildMissionListEmbed(missions: Readonly<Mission[]>, title: string): EmbedBuilder;
interface MissionStatusUpdatedInput {
    missionId: string;
    missionTitle: string;
    status: MissionStatus;
}
export declare function buildMissionStatusUpdatedEmbed(input: Readonly<MissionStatusUpdatedInput>): EmbedBuilder;
interface MissionCreatedInput {
    missionId: string;
    missionTitle: string;
    missionType: MissionType;
    difficulty: MissionDifficulty;
    priority: MissionPriority;
    location?: string;
    reward?: string;
}
export declare function buildMissionCreatedEmbed(input: Readonly<MissionCreatedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=missionEmbeds.d.ts.map