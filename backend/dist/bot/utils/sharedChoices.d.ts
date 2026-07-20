import { ActionRowBuilder, StringSelectMenuBuilder, type StringSelectMenuInteraction } from 'discord.js';
import { BountyDifficulty, BountyType } from '../../models/Bounty';
import { MissionDifficulty, MissionPriority, MissionStatus, MissionType } from '../../models/Mission';
import { LFGActivity } from '../../types';
export declare const BOUNTY_TYPE_OPTIONS: readonly [{
    readonly label: "Kill";
    readonly value: BountyType.KILL;
    readonly emoji: "💀";
}, {
    readonly label: "Capture";
    readonly value: BountyType.CAPTURE;
    readonly emoji: "🔗";
}, {
    readonly label: "Intel";
    readonly value: BountyType.INTEL;
    readonly emoji: "🔍";
}, {
    readonly label: "Transport";
    readonly value: BountyType.TRANSPORT;
    readonly emoji: "🚚";
}, {
    readonly label: "Rescue";
    readonly value: BountyType.RESCUE;
    readonly emoji: "🛟";
}, {
    readonly label: "Custom";
    readonly value: BountyType.CUSTOM;
    readonly emoji: "⚙️";
}];
export declare const BOUNTY_DIFFICULTY_OPTIONS: readonly [{
    readonly label: "Easy";
    readonly value: BountyDifficulty.EASY;
    readonly emoji: "🟢";
}, {
    readonly label: "Medium";
    readonly value: BountyDifficulty.MEDIUM;
    readonly emoji: "🟡";
}, {
    readonly label: "Hard";
    readonly value: BountyDifficulty.HARD;
    readonly emoji: "🟠";
}, {
    readonly label: "Expert";
    readonly value: BountyDifficulty.EXPERT;
    readonly emoji: "🔴";
}];
export declare const MISSION_TYPE_OPTIONS: readonly [{
    readonly label: "Combat";
    readonly value: MissionType.COMBAT;
    readonly emoji: "⚔️";
}, {
    readonly label: "Mining";
    readonly value: MissionType.MINING;
    readonly emoji: "⛏️";
}, {
    readonly label: "Trading";
    readonly value: MissionType.TRADING;
    readonly emoji: "💰";
}, {
    readonly label: "Exploration";
    readonly value: MissionType.EXPLORATION;
    readonly emoji: "🔭";
}, {
    readonly label: "Logistics";
    readonly value: MissionType.LOGISTICS;
    readonly emoji: "📦";
}, {
    readonly label: "Rescue";
    readonly value: MissionType.RESCUE;
    readonly emoji: "🛟";
}, {
    readonly label: "Reconnaissance";
    readonly value: MissionType.RECONNAISSANCE;
    readonly emoji: "🔍";
}, {
    readonly label: "Escort";
    readonly value: MissionType.ESCORT;
    readonly emoji: "🛡️";
}, {
    readonly label: "Salvage";
    readonly value: MissionType.SALVAGE;
    readonly emoji: "🔧";
}, {
    readonly label: "Custom";
    readonly value: MissionType.CUSTOM;
    readonly emoji: "⚙️";
}];
export declare const MISSION_DIFFICULTY_OPTIONS: readonly [{
    readonly label: "Trivial";
    readonly value: MissionDifficulty.TRIVIAL;
    readonly emoji: "⚪";
}, {
    readonly label: "Easy";
    readonly value: MissionDifficulty.EASY;
    readonly emoji: "🟢";
}, {
    readonly label: "Medium";
    readonly value: MissionDifficulty.MEDIUM;
    readonly emoji: "🟡";
}, {
    readonly label: "Hard";
    readonly value: MissionDifficulty.HARD;
    readonly emoji: "🟠";
}, {
    readonly label: "Extreme";
    readonly value: MissionDifficulty.EXTREME;
    readonly emoji: "🔴";
}];
export declare const MISSION_PRIORITY_OPTIONS: readonly [{
    readonly label: "Low";
    readonly value: MissionPriority.LOW;
    readonly emoji: "🔽";
}, {
    readonly label: "Normal";
    readonly value: MissionPriority.NORMAL;
    readonly emoji: "▶️";
}, {
    readonly label: "High";
    readonly value: MissionPriority.HIGH;
    readonly emoji: "🔺";
}, {
    readonly label: "Critical";
    readonly value: MissionPriority.CRITICAL;
    readonly emoji: "🔥";
}];
export declare const MISSION_STATUS_OPTIONS: readonly [{
    readonly label: "Planned";
    readonly value: MissionStatus.PLANNED;
    readonly emoji: "📋";
}, {
    readonly label: "Briefed";
    readonly value: MissionStatus.BRIEFED;
    readonly emoji: "📑";
}, {
    readonly label: "In Progress";
    readonly value: MissionStatus.IN_PROGRESS;
    readonly emoji: "🚀";
}, {
    readonly label: "Completed";
    readonly value: MissionStatus.COMPLETED;
    readonly emoji: "✅";
}, {
    readonly label: "Failed";
    readonly value: MissionStatus.FAILED;
    readonly emoji: "❌";
}, {
    readonly label: "Cancelled";
    readonly value: MissionStatus.CANCELLED;
    readonly emoji: "🚫";
}];
export declare const LFG_ACTIVITY_OPTIONS: readonly [{
    readonly label: "PvP";
    readonly value: LFGActivity.PVP;
    readonly emoji: "⚔️";
}, {
    readonly label: "PvE";
    readonly value: LFGActivity.PVE;
    readonly emoji: "🎯";
}, {
    readonly label: "Mining";
    readonly value: LFGActivity.MINING;
    readonly emoji: "⛏️";
}, {
    readonly label: "Trading";
    readonly value: LFGActivity.TRADING;
    readonly emoji: "💰";
}, {
    readonly label: "Exploration";
    readonly value: LFGActivity.EXPLORATION;
    readonly emoji: "🔭";
}, {
    readonly label: "Bounty Hunting";
    readonly value: LFGActivity.BOUNTY_HUNTING;
    readonly emoji: "💀";
}, {
    readonly label: "Cargo Hauling";
    readonly value: LFGActivity.CARGO_HAULING;
    readonly emoji: "📦";
}, {
    readonly label: "Racing";
    readonly value: LFGActivity.RACING;
    readonly emoji: "🏎️";
}, {
    readonly label: "Other";
    readonly value: LFGActivity.OTHER;
    readonly emoji: "❓";
}];
export declare const ANNOUNCE_COLOR_OPTIONS: readonly [{
    readonly label: "Blue (Default)";
    readonly value: "#0099FF";
    readonly emoji: "🔵";
}, {
    readonly label: "Green";
    readonly value: "#00CC66";
    readonly emoji: "🟢";
}, {
    readonly label: "Red";
    readonly value: "#FF3333";
    readonly emoji: "🔴";
}, {
    readonly label: "Gold";
    readonly value: "#FFD700";
    readonly emoji: "🟡";
}, {
    readonly label: "Purple";
    readonly value: "#9B59B6";
    readonly emoji: "🟣";
}, {
    readonly label: "Orange";
    readonly value: "#FF8C00";
    readonly emoji: "🟠";
}, {
    readonly label: "Teal";
    readonly value: "#1ABC9C";
    readonly emoji: "💠";
}, {
    readonly label: "White";
    readonly value: "#FFFFFF";
    readonly emoji: "⬜";
}, {
    readonly label: "Dark";
    readonly value: "#2C2F33";
    readonly emoji: "⬛";
}, {
    readonly label: "Custom Hex...";
    readonly value: "__custom__";
    readonly emoji: "🎨";
}];
export declare const EVENT_DIFFICULTY_OPTIONS: readonly [{
    readonly label: "Easy";
    readonly value: "easy";
    readonly emoji: "🟢";
}, {
    readonly label: "Medium";
    readonly value: "medium";
    readonly emoji: "🟡";
}, {
    readonly label: "Hard";
    readonly value: "hard";
    readonly emoji: "🟠";
}, {
    readonly label: "Expert";
    readonly value: "expert";
    readonly emoji: "🔴";
}];
export declare const ACTIVITY_TYPE_LABELS: Record<string, {
    emoji: string;
    label: string;
}>;
export declare const EVENT_TYPE_OPTIONS: {
    label: string;
    value: string;
    emoji: string;
}[];
export declare function buildBountyTypeSelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildBountyDifficultySelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildMissionTypeSelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildMissionDifficultySelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildMissionPrioritySelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildMissionStatusSelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildLfgActivitySelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildAnnounceColorSelect(customId: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildEventDifficultySelect(customId: string, selectedValue?: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function buildEventTypeSelect(customId: string, selectedValue?: string): ActionRowBuilder<StringSelectMenuBuilder>;
export declare function awaitSelectValue(interaction: StringSelectMenuInteraction, _customId: string, timeoutMs?: number): Promise<string | null>;
//# sourceMappingURL=sharedChoices.d.ts.map