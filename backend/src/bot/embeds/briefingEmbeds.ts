import { EmbedBuilder } from 'discord.js';

import { EmbedColors } from '../utils/embedBuilder';

interface BriefingUsageStatsInput {
  requestCount: number;
  dailyLimit: number;
  remaining: number;
  totalTokens: number;
}

interface GeneratedMissionBriefingEmbedInput {
  missionTitle: string;
  briefingText: string;
  modelUsed: string;
  tokensUsed: number;
  missionId: string;
}

interface QuickMissionBriefingEmbedInput {
  missionTypeLabel: string;
  briefingText: string;
  modelUsed: string;
  tokensUsed: number;
}

export function buildBriefingUsageEmbed(stats: Readonly<BriefingUsageStatsInput>): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.INFO)
    .setTitle('\u{1F4CA} Briefing Usage')
    .addFields(
      { name: 'Used Today', value: `${stats.requestCount}`, inline: true },
      { name: 'Daily Limit', value: `${stats.dailyLimit}`, inline: true },
      { name: 'Remaining', value: `${stats.remaining}`, inline: true },
      { name: 'Total Tokens', value: stats.totalTokens.toLocaleString(), inline: true }
    )
    .setFooter({ text: 'Limits reset daily at midnight UTC' })
    .setTimestamp();
}

export function buildGeneratedMissionBriefingEmbed(
  input: Readonly<GeneratedMissionBriefingEmbedInput>
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.SC_BLUE)
    .setTitle(`Briefing: ${input.missionTitle}`)
    .setDescription(input.briefingText || '*No briefing content generated.*')
    .addFields(
      { name: 'Model', value: input.modelUsed, inline: true },
      { name: 'Tokens', value: `${input.tokensUsed.toLocaleString()}`, inline: true }
    )
    .setFooter({ text: `Mission ID: ${input.missionId}` })
    .setTimestamp();
}

export function buildQuickMissionBriefingEmbed(
  input: Readonly<QuickMissionBriefingEmbedInput>
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EmbedColors.QUANTUM_GOLD)
    .setTitle(`Quick Briefing: ${input.missionTypeLabel} Mission`)
    .setDescription(input.briefingText || '*No briefing content generated.*')
    .addFields(
      { name: 'Difficulty', value: 'Medium', inline: true },
      { name: 'Model', value: input.modelUsed, inline: true },
      { name: 'Tokens', value: `${input.tokensUsed.toLocaleString()}`, inline: true }
    )
    .setFooter({ text: 'Quick briefing \u2014 not attached to a saved mission' })
    .setTimestamp();
}
