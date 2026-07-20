"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_TYPE_OPTIONS = exports.ACTIVITY_TYPE_LABELS = exports.EVENT_DIFFICULTY_OPTIONS = exports.ANNOUNCE_COLOR_OPTIONS = exports.LFG_ACTIVITY_OPTIONS = exports.MISSION_STATUS_OPTIONS = exports.MISSION_PRIORITY_OPTIONS = exports.MISSION_DIFFICULTY_OPTIONS = exports.MISSION_TYPE_OPTIONS = exports.BOUNTY_DIFFICULTY_OPTIONS = exports.BOUNTY_TYPE_OPTIONS = void 0;
exports.buildBountyTypeSelect = buildBountyTypeSelect;
exports.buildBountyDifficultySelect = buildBountyDifficultySelect;
exports.buildMissionTypeSelect = buildMissionTypeSelect;
exports.buildMissionDifficultySelect = buildMissionDifficultySelect;
exports.buildMissionPrioritySelect = buildMissionPrioritySelect;
exports.buildMissionStatusSelect = buildMissionStatusSelect;
exports.buildLfgActivitySelect = buildLfgActivitySelect;
exports.buildAnnounceColorSelect = buildAnnounceColorSelect;
exports.buildEventDifficultySelect = buildEventDifficultySelect;
exports.buildEventTypeSelect = buildEventTypeSelect;
exports.awaitSelectValue = awaitSelectValue;
const discord_js_1 = require("discord.js");
const Activity_1 = require("../../models/Activity");
const Bounty_1 = require("../../models/Bounty");
const Mission_1 = require("../../models/Mission");
const types_1 = require("../../types");
exports.BOUNTY_TYPE_OPTIONS = [
    { label: 'Kill', value: Bounty_1.BountyType.KILL, emoji: '💀' },
    { label: 'Capture', value: Bounty_1.BountyType.CAPTURE, emoji: '🔗' },
    { label: 'Intel', value: Bounty_1.BountyType.INTEL, emoji: '🔍' },
    { label: 'Transport', value: Bounty_1.BountyType.TRANSPORT, emoji: '🚚' },
    { label: 'Rescue', value: Bounty_1.BountyType.RESCUE, emoji: '🛟' },
    { label: 'Custom', value: Bounty_1.BountyType.CUSTOM, emoji: '⚙️' },
];
exports.BOUNTY_DIFFICULTY_OPTIONS = [
    { label: 'Easy', value: Bounty_1.BountyDifficulty.EASY, emoji: '🟢' },
    { label: 'Medium', value: Bounty_1.BountyDifficulty.MEDIUM, emoji: '🟡' },
    { label: 'Hard', value: Bounty_1.BountyDifficulty.HARD, emoji: '🟠' },
    { label: 'Expert', value: Bounty_1.BountyDifficulty.EXPERT, emoji: '🔴' },
];
exports.MISSION_TYPE_OPTIONS = [
    { label: 'Combat', value: Mission_1.MissionType.COMBAT, emoji: '⚔️' },
    { label: 'Mining', value: Mission_1.MissionType.MINING, emoji: '⛏️' },
    { label: 'Trading', value: Mission_1.MissionType.TRADING, emoji: '💰' },
    { label: 'Exploration', value: Mission_1.MissionType.EXPLORATION, emoji: '🔭' },
    { label: 'Logistics', value: Mission_1.MissionType.LOGISTICS, emoji: '📦' },
    { label: 'Rescue', value: Mission_1.MissionType.RESCUE, emoji: '🛟' },
    { label: 'Reconnaissance', value: Mission_1.MissionType.RECONNAISSANCE, emoji: '🔍' },
    { label: 'Escort', value: Mission_1.MissionType.ESCORT, emoji: '🛡️' },
    { label: 'Salvage', value: Mission_1.MissionType.SALVAGE, emoji: '🔧' },
    { label: 'Custom', value: Mission_1.MissionType.CUSTOM, emoji: '⚙️' },
];
exports.MISSION_DIFFICULTY_OPTIONS = [
    { label: 'Trivial', value: Mission_1.MissionDifficulty.TRIVIAL, emoji: '⚪' },
    { label: 'Easy', value: Mission_1.MissionDifficulty.EASY, emoji: '🟢' },
    { label: 'Medium', value: Mission_1.MissionDifficulty.MEDIUM, emoji: '🟡' },
    { label: 'Hard', value: Mission_1.MissionDifficulty.HARD, emoji: '🟠' },
    { label: 'Extreme', value: Mission_1.MissionDifficulty.EXTREME, emoji: '🔴' },
];
exports.MISSION_PRIORITY_OPTIONS = [
    { label: 'Low', value: Mission_1.MissionPriority.LOW, emoji: '🔽' },
    { label: 'Normal', value: Mission_1.MissionPriority.NORMAL, emoji: '▶️' },
    { label: 'High', value: Mission_1.MissionPriority.HIGH, emoji: '🔺' },
    { label: 'Critical', value: Mission_1.MissionPriority.CRITICAL, emoji: '🔥' },
];
exports.MISSION_STATUS_OPTIONS = [
    { label: 'Planned', value: Mission_1.MissionStatus.PLANNED, emoji: '\u{1F4CB}' },
    { label: 'Briefed', value: Mission_1.MissionStatus.BRIEFED, emoji: '\u{1F4D1}' },
    { label: 'In Progress', value: Mission_1.MissionStatus.IN_PROGRESS, emoji: '\u{1F680}' },
    { label: 'Completed', value: Mission_1.MissionStatus.COMPLETED, emoji: '\u2705' },
    { label: 'Failed', value: Mission_1.MissionStatus.FAILED, emoji: '\u274C' },
    { label: 'Cancelled', value: Mission_1.MissionStatus.CANCELLED, emoji: '\u{1F6AB}' },
];
exports.LFG_ACTIVITY_OPTIONS = [
    { label: 'PvP', value: types_1.LFGActivity.PVP, emoji: '⚔️' },
    { label: 'PvE', value: types_1.LFGActivity.PVE, emoji: '🎯' },
    { label: 'Mining', value: types_1.LFGActivity.MINING, emoji: '⛏️' },
    { label: 'Trading', value: types_1.LFGActivity.TRADING, emoji: '💰' },
    { label: 'Exploration', value: types_1.LFGActivity.EXPLORATION, emoji: '🔭' },
    { label: 'Bounty Hunting', value: types_1.LFGActivity.BOUNTY_HUNTING, emoji: '💀' },
    { label: 'Cargo Hauling', value: types_1.LFGActivity.CARGO_HAULING, emoji: '📦' },
    { label: 'Racing', value: types_1.LFGActivity.RACING, emoji: '🏎️' },
    { label: 'Other', value: types_1.LFGActivity.OTHER, emoji: '❓' },
];
exports.ANNOUNCE_COLOR_OPTIONS = [
    { label: 'Blue (Default)', value: '#0099FF', emoji: '🔵' },
    { label: 'Green', value: '#00CC66', emoji: '🟢' },
    { label: 'Red', value: '#FF3333', emoji: '🔴' },
    { label: 'Gold', value: '#FFD700', emoji: '🟡' },
    { label: 'Purple', value: '#9B59B6', emoji: '🟣' },
    { label: 'Orange', value: '#FF8C00', emoji: '🟠' },
    { label: 'Teal', value: '#1ABC9C', emoji: '💠' },
    { label: 'White', value: '#FFFFFF', emoji: '⬜' },
    { label: 'Dark', value: '#2C2F33', emoji: '⬛' },
    { label: 'Custom Hex...', value: '__custom__', emoji: '🎨' },
];
exports.EVENT_DIFFICULTY_OPTIONS = [
    { label: 'Easy', value: 'easy', emoji: '\u{1F7E2}' },
    { label: 'Medium', value: 'medium', emoji: '\u{1F7E1}' },
    { label: 'Hard', value: 'hard', emoji: '\u{1F7E0}' },
    { label: 'Expert', value: 'expert', emoji: '\u{1F534}' },
];
exports.ACTIVITY_TYPE_LABELS = {
    [Activity_1.ActivityType.EVENT]: { emoji: '\u{1F4C5}', label: 'Event' },
    [Activity_1.ActivityType.MISSION]: { emoji: '\u{1F3AF}', label: 'Mission' },
    [Activity_1.ActivityType.CONTRACT]: { emoji: '\u{1F4DC}', label: 'Contract' },
    [Activity_1.ActivityType.BOUNTY]: { emoji: '\u{1F4B0}', label: 'Bounty' },
    [Activity_1.ActivityType.OPERATION]: { emoji: '\u2694\uFE0F', label: 'Operation' },
    [Activity_1.ActivityType.LFG]: { emoji: '\u{1F50D}', label: 'Looking For Group' },
    [Activity_1.ActivityType.JOB_LISTING]: { emoji: '\u{1F4BC}', label: 'Job Listing' },
};
exports.EVENT_TYPE_OPTIONS = Object.entries(exports.ACTIVITY_TYPE_LABELS).map(([value, info]) => ({
    label: info.label,
    value,
    emoji: info.emoji,
}));
function buildSelectRow(customId, placeholder, options, selectedValue) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder(placeholder)
        .addOptions(options.map(o => ({
        label: o.label,
        value: o.value,
        emoji: o.emoji,
        ...(selectedValue !== undefined ? { default: o.value === selectedValue } : {}),
    }))));
}
function buildBountyTypeSelect(customId) {
    return buildSelectRow(customId, 'Select bounty type...', exports.BOUNTY_TYPE_OPTIONS);
}
function buildBountyDifficultySelect(customId) {
    return buildSelectRow(customId, 'Select difficulty...', exports.BOUNTY_DIFFICULTY_OPTIONS);
}
function buildMissionTypeSelect(customId) {
    return buildSelectRow(customId, 'Select mission type...', exports.MISSION_TYPE_OPTIONS);
}
function buildMissionDifficultySelect(customId) {
    return buildSelectRow(customId, 'Select difficulty...', exports.MISSION_DIFFICULTY_OPTIONS);
}
function buildMissionPrioritySelect(customId) {
    return buildSelectRow(customId, 'Select priority...', exports.MISSION_PRIORITY_OPTIONS);
}
function buildMissionStatusSelect(customId) {
    return buildSelectRow(customId, 'Select new status...', exports.MISSION_STATUS_OPTIONS);
}
function buildLfgActivitySelect(customId) {
    return buildSelectRow(customId, 'Select activity type...', exports.LFG_ACTIVITY_OPTIONS);
}
function buildAnnounceColorSelect(customId) {
    return buildSelectRow(customId, 'Pick a colour...', exports.ANNOUNCE_COLOR_OPTIONS);
}
function buildEventDifficultySelect(customId, selectedValue) {
    return buildSelectRow(customId, 'Select difficulty', exports.EVENT_DIFFICULTY_OPTIONS, selectedValue);
}
function buildEventTypeSelect(customId, selectedValue) {
    return buildSelectRow(customId, 'Select activity type', exports.EVENT_TYPE_OPTIONS, selectedValue);
}
async function awaitSelectValue(interaction, _customId, timeoutMs = 60_000) {
    try {
        const collected = await interaction.message.awaitMessageComponent({
            componentType: discord_js_1.ComponentType.StringSelect,
            time: timeoutMs,
            filter: i => i.user.id === interaction.user.id,
        });
        return collected.values[0] ?? null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=sharedChoices.js.map