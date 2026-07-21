import { EmbedBuilder } from 'discord.js';

import {
  Mission,
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { buildAppUrl } from '../utils/appUrls';
import { EmbedColors } from '../utils/embedBuilder';

export function getMissionTypeEmoji(type: MissionType): string {
  switch (type) {
    case MissionType.COMBAT:
      return '⚔️';
    case MissionType.MINING:
      return '⛏️';
    case MissionType.TRADING:
      return '💰';
    case MissionType.EXPLORATION:
      return '🔭';
    case MissionType.LOGISTICS:
      return '📦';
    case MissionType.RESCUE:
      return '🆘';
    case MissionType.RECONNAISSANCE:
      return '🔍';
    case MissionType.ESCORT:
      return '🛡️';
    case MissionType.SALVAGE:
      return '🔧';
    case MissionType.CUSTOM:
      return '⭐';
    default:
      return '🎯';
  }
}

export function getStatusEmoji(status: MissionStatus): string {
  switch (status) {
    case MissionStatus.DRAFT:
      return '📝';
    case MissionStatus.PLANNED:
      return '📋';
    case MissionStatus.BRIEFED:
      return '📑';
    case MissionStatus.IN_PROGRESS:
      return '🚀';
    case MissionStatus.COMPLETED:
      return '✅';
    case MissionStatus.FAILED:
      return '❌';
    case MissionStatus.CANCELLED:
      return '🚫';
    default:
      return '❓';
  }
}

export function getStatusColor(status: MissionStatus): number {
  switch (status) {
    case MissionStatus.DRAFT:
      return 0x808080;
    case MissionStatus.PLANNED:
      return 0x3498db;
    case MissionStatus.BRIEFED:
      return 0x9b59b6;
    case MissionStatus.IN_PROGRESS:
      return 0xf1c40f;
    case MissionStatus.COMPLETED:
      return 0x57f287;
    case MissionStatus.FAILED:
      return 0xed4245;
    case MissionStatus.CANCELLED:
      return 0x95a5a6;
    default:
      return 0x00d4ff;
  }
}

export function getDifficultyEmoji(difficulty: MissionDifficulty): string {
  switch (difficulty) {
    case MissionDifficulty.TRIVIAL:
      return '⚪';
    case MissionDifficulty.EASY:
      return '🟢';
    case MissionDifficulty.MEDIUM:
      return '🟡';
    case MissionDifficulty.HARD:
      return '🟠';
    case MissionDifficulty.EXTREME:
      return '🔴';
    default:
      return '⚪';
  }
}

export function getPriorityEmoji(priority: MissionPriority): string {
  switch (priority) {
    case MissionPriority.LOW:
      return '🔽';
    case MissionPriority.NORMAL:
      return '▶️';
    case MissionPriority.HIGH:
      return '🔺';
    case MissionPriority.CRITICAL:
      return '🔥';
    default:
      return '▶️';
  }
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ');
}

export function buildMissionDetailEmbed(mission: Readonly<Mission>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(getStatusColor(mission.status))
    .setTitle(`${getMissionTypeEmoji(mission.missionType)} ${mission.title}`)
    .setURL(buildAppUrl(`/missions/${encodeURIComponent(mission.id)}`))
    .setDescription(mission.description || '*No description provided*')
    .addFields(
      {
        name: 'Status',
        value: `${getStatusEmoji(mission.status)} ${capitalise(mission.status)}`,
        inline: true,
      },
      {
        name: 'Type',
        value: `${getMissionTypeEmoji(mission.missionType)} ${capitalise(mission.missionType)}`,
        inline: true,
      },
      {
        name: 'Difficulty',
        value: `${getDifficultyEmoji(mission.difficulty)} ${capitalise(mission.difficulty)}`,
        inline: true,
      },
      {
        name: 'Priority',
        value: `${getPriorityEmoji(mission.priority)} ${capitalise(mission.priority)}`,
        inline: true,
      }
    );

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

    const parts: string[] = [];
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

export function buildMissionListEmbed(missions: Readonly<Mission[]>, title: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(EmbedColors.SC_BLUE).setTitle(title).setTimestamp();

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
  } else {
    embed.setFooter({ text: `${missions.length} mission(s)` });
  }

  return embed;
}

interface MissionStatusUpdatedInput {
  missionId: string;
  missionTitle: string;
  status: MissionStatus;
}

export function buildMissionStatusUpdatedEmbed(
  input: Readonly<MissionStatusUpdatedInput>
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(getStatusColor(input.status))
    .setTitle(`${getStatusEmoji(input.status)} Mission Status Updated`)
    .setDescription(`**${input.missionTitle}** is now **${capitalise(input.status)}**.`)
    .setFooter({ text: `Mission ID: ${input.missionId}` })
    .setTimestamp();
}

interface MissionCreatedInput {
  missionId: string;
  missionTitle: string;
  missionType: MissionType;
  difficulty: MissionDifficulty;
  priority: MissionPriority;
  location?: string;
  reward?: string;
}

export function buildMissionCreatedEmbed(input: Readonly<MissionCreatedInput>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EmbedColors.SUCCESS)
    .setTitle('✅ Mission Created')
    .setDescription(`**${input.missionTitle}** has been created as a draft mission.`)
    .addFields(
      {
        name: 'Type',
        value: `${getMissionTypeEmoji(input.missionType)} ${capitalise(input.missionType)}`,
        inline: true,
      },
      {
        name: 'Difficulty',
        value: `${getDifficultyEmoji(input.difficulty)} ${capitalise(input.difficulty)}`,
        inline: true,
      },
      {
        name: 'Priority',
        value: `${getPriorityEmoji(input.priority)} ${capitalise(input.priority)}`,
        inline: true,
      }
    )
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
