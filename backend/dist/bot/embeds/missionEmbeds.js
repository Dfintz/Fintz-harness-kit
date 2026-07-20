"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMissionTypeEmoji = getMissionTypeEmoji;
exports.getStatusEmoji = getStatusEmoji;
exports.getStatusColor = getStatusColor;
exports.getDifficultyEmoji = getDifficultyEmoji;
exports.getPriorityEmoji = getPriorityEmoji;
exports.capitalise = capitalise;
exports.buildMissionDetailEmbed = buildMissionDetailEmbed;
exports.buildMissionListEmbed = buildMissionListEmbed;
exports.buildMissionStatusUpdatedEmbed = buildMissionStatusUpdatedEmbed;
exports.buildMissionCreatedEmbed = buildMissionCreatedEmbed;
const discord_js_1 = require("discord.js");
const Mission_1 = require("../../models/Mission");
const appUrls_1 = require("../utils/appUrls");
const embedBuilder_1 = require("../utils/embedBuilder");
function getMissionTypeEmoji(type) {
    switch (type) {
        case Mission_1.MissionType.COMBAT:
            return '⚔️';
        case Mission_1.MissionType.MINING:
            return '⛏️';
        case Mission_1.MissionType.TRADING:
            return '💰';
        case Mission_1.MissionType.EXPLORATION:
            return '🔭';
        case Mission_1.MissionType.LOGISTICS:
            return '📦';
        case Mission_1.MissionType.RESCUE:
            return '🆘';
        case Mission_1.MissionType.RECONNAISSANCE:
            return '🔍';
        case Mission_1.MissionType.ESCORT:
            return '🛡️';
        case Mission_1.MissionType.SALVAGE:
            return '🔧';
        case Mission_1.MissionType.CUSTOM:
            return '⭐';
        default:
            return '🎯';
    }
}
function getStatusEmoji(status) {
    switch (status) {
        case Mission_1.MissionStatus.DRAFT:
            return '📝';
        case Mission_1.MissionStatus.PLANNED:
            return '📋';
        case Mission_1.MissionStatus.BRIEFED:
            return '📑';
        case Mission_1.MissionStatus.IN_PROGRESS:
            return '🚀';
        case Mission_1.MissionStatus.COMPLETED:
            return '✅';
        case Mission_1.MissionStatus.FAILED:
            return '❌';
        case Mission_1.MissionStatus.CANCELLED:
            return '🚫';
        default:
            return '❓';
    }
}
function getStatusColor(status) {
    switch (status) {
        case Mission_1.MissionStatus.DRAFT:
            return 0x808080;
        case Mission_1.MissionStatus.PLANNED:
            return 0x3498db;
        case Mission_1.MissionStatus.BRIEFED:
            return 0x9b59b6;
        case Mission_1.MissionStatus.IN_PROGRESS:
            return 0xf1c40f;
        case Mission_1.MissionStatus.COMPLETED:
            return 0x57f287;
        case Mission_1.MissionStatus.FAILED:
            return 0xed4245;
        case Mission_1.MissionStatus.CANCELLED:
            return 0x95a5a6;
        default:
            return 0x00d4ff;
    }
}
function getDifficultyEmoji(difficulty) {
    switch (difficulty) {
        case Mission_1.MissionDifficulty.TRIVIAL:
            return '⚪';
        case Mission_1.MissionDifficulty.EASY:
            return '🟢';
        case Mission_1.MissionDifficulty.MEDIUM:
            return '🟡';
        case Mission_1.MissionDifficulty.HARD:
            return '🟠';
        case Mission_1.MissionDifficulty.EXTREME:
            return '🔴';
        default:
            return '⚪';
    }
}
function getPriorityEmoji(priority) {
    switch (priority) {
        case Mission_1.MissionPriority.LOW:
            return '🔽';
        case Mission_1.MissionPriority.NORMAL:
            return '▶️';
        case Mission_1.MissionPriority.HIGH:
            return '🔺';
        case Mission_1.MissionPriority.CRITICAL:
            return '🔥';
        default:
            return '▶️';
    }
}
function capitalise(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ');
}
function buildMissionDetailEmbed(mission) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(getStatusColor(mission.status))
        .setTitle(`${getMissionTypeEmoji(mission.missionType)} ${mission.title}`)
        .setURL((0, appUrls_1.buildAppUrl)(`/missions/${encodeURIComponent(mission.id)}`))
        .setDescription(mission.description || '*No description provided*')
        .addFields({
        name: 'Status',
        value: `${getStatusEmoji(mission.status)} ${capitalise(mission.status)}`,
        inline: true,
    }, {
        name: 'Type',
        value: `${getMissionTypeEmoji(mission.missionType)} ${capitalise(mission.missionType)}`,
        inline: true,
    }, {
        name: 'Difficulty',
        value: `${getDifficultyEmoji(mission.difficulty)} ${capitalise(mission.difficulty)}`,
        inline: true,
    }, {
        name: 'Priority',
        value: `${getPriorityEmoji(mission.priority)} ${capitalise(mission.priority)}`,
        inline: true,
    });
    if (mission.location) {
        embed.addFields({ name: '📍 Location', value: mission.location, inline: true });
    }
    if (mission.reward) {
        embed.addFields({ name: '🏆 Reward', value: mission.reward, inline: true });
    }
    const participantCount = mission.participants?.length ?? 0;
    if (participantCount > 0) {
        const leaders = mission.participants.filter(p => p.role === 'leader');
        const members = mission.participants.filter(p => p.role === 'member');
        const support = mission.participants.filter(p => p.role === 'support');
        const parts = [];
        if (leaders.length) {
            parts.push(`👑 ${leaders.length} leader(s)`);
        }
        if (members.length) {
            parts.push(`👤 ${members.length} member(s)`);
        }
        if (support.length) {
            parts.push(`🔧 ${support.length} support`);
        }
        embed.addFields({
            name: `Participants (${participantCount})`,
            value: parts.length > 0 ? parts.join('\n') : 'None',
        });
    }
    const objectiveCount = mission.objectives?.length ?? 0;
    if (objectiveCount > 0) {
        const completed = mission.objectives.filter(o => o.completed).length;
        const objectiveLines = mission.objectives
            .slice(0, 5)
            .map(o => `${o.completed ? '✅' : '⬜'} ${o.title}`)
            .join('\n');
        const more = objectiveCount > 5 ? `\n_...and ${objectiveCount - 5} more_` : '';
        embed.addFields({
            name: `Objectives (${completed}/${objectiveCount})`,
            value: objectiveLines + more,
        });
    }
    if (mission.startDate) {
        const ts = Math.floor(new Date(mission.startDate).getTime() / 1000);
        embed.addFields({ name: '📅 Start', value: `<t:${ts}:F>`, inline: true });
    }
    if (mission.endDate) {
        const ts = Math.floor(new Date(mission.endDate).getTime() / 1000);
        embed.addFields({ name: '📅 End', value: `<t:${ts}:F>`, inline: true });
    }
    embed.setFooter({ text: `Mission ID: ${mission.id}` });
    embed.setTimestamp(mission.updatedAt ?? mission.createdAt);
    return embed;
}
function buildMissionListEmbed(missions, title) {
    const embed = new discord_js_1.EmbedBuilder().setColor(embedBuilder_1.EmbedColors.SC_BLUE).setTitle(title).setTimestamp();
    if (missions.length === 0) {
        embed.setDescription('*No missions found.*');
        return embed;
    }
    const lines = missions.slice(0, 10).map((m, idx) => {
        const typeEmoji = getMissionTypeEmoji(m.missionType);
        const statusEmoji = getStatusEmoji(m.status);
        const priorityEmoji = getPriorityEmoji(m.priority);
        return `**${idx + 1}.** ${typeEmoji} ${m.title}\n   ${statusEmoji} ${capitalise(m.status)} · ${priorityEmoji} ${capitalise(m.priority)} · ${getDifficultyEmoji(m.difficulty)} ${capitalise(m.difficulty)}`;
    });
    embed.setDescription(lines.join('\n\n'));
    if (missions.length > 10) {
        embed.setFooter({ text: `Showing 10 of ${missions.length} missions` });
    }
    else {
        embed.setFooter({ text: `${missions.length} mission(s)` });
    }
    return embed;
}
function buildMissionStatusUpdatedEmbed(input) {
    return new discord_js_1.EmbedBuilder()
        .setColor(getStatusColor(input.status))
        .setTitle(`${getStatusEmoji(input.status)} Mission Status Updated`)
        .setDescription(`**${input.missionTitle}** is now **${capitalise(input.status)}**.`)
        .setFooter({ text: `Mission ID: ${input.missionId}` })
        .setTimestamp();
}
function buildMissionCreatedEmbed(input) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(embedBuilder_1.EmbedColors.SUCCESS)
        .setTitle('✅ Mission Created')
        .setDescription(`**${input.missionTitle}** has been created as a draft mission.`)
        .addFields({
        name: 'Type',
        value: `${getMissionTypeEmoji(input.missionType)} ${capitalise(input.missionType)}`,
        inline: true,
    }, {
        name: 'Difficulty',
        value: `${getDifficultyEmoji(input.difficulty)} ${capitalise(input.difficulty)}`,
        inline: true,
    }, {
        name: 'Priority',
        value: `${getPriorityEmoji(input.priority)} ${capitalise(input.priority)}`,
        inline: true,
    })
        .setFooter({ text: `Mission ID: ${input.missionId}` })
        .setTimestamp();
    if (input.location) {
        embed.addFields({ name: '📍 Location', value: input.location, inline: true });
    }
    if (input.reward) {
        embed.addFields({ name: '🏆 Reward', value: input.reward, inline: true });
    }
    return embed;
}
//# sourceMappingURL=missionEmbeds.js.map