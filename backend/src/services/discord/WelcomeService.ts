import { decodeHtmlEntities } from '@sc-fleet-manager/shared-types';
import {
  EmbedBuilder,
  GuildMember,
  PartialGuildMember,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';

import { checkBotGuildPermissions } from '../../bot/utils/discord';
import { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import { logger } from '../../utils/logger';

import { DiscordSettingsService } from './DiscordSettingsService';

function isOnboardingPending(member: GuildMember | PartialGuildMember): boolean {
  return member.pending === true;
}

async function assignWelcomeAutoRoles(
  member: GuildMember,
  autoRoleIds: string[],
  reason: string
): Promise<void> {
  if (autoRoleIds.length === 0) {
    return;
  }

  if (!checkBotGuildPermissions(member.guild, PermissionFlagsBits.ManageRoles)) {
    logger.warn(
      `WelcomeService: bot lacks ManageRoles in guild ${member.guild.name}, skipping auto-roles`
    );
    return;
  }

  let assignedCount = 0;
  for (const roleId of autoRoleIds) {
    if (member.roles.cache.has(roleId)) {
      continue;
    }

    try {
      await member.roles.add(roleId, reason);
      assignedCount += 1;
    } catch (err: unknown) {
      logger.warn(`Failed to assign auto-role ${roleId} to ${member.user.tag}: ${err}`);
    }
  }

  if (assignedCount > 0) {
    logger.info(
      `Assigned ${assignedCount} auto-role(s) to ${member.user.tag} in ${member.guild.name}`
    );
  }
}

/**
 * Resolves template variables in welcome/goodbye messages.
 *
 * Supported variables:
 * - {user} — mention the user
 * - {username} — plain username
 * - {server} — server name
 * - {memberCount} — total member count
 */
function resolveTemplate(template: string, member: GuildMember | PartialGuildMember): string {
  return decodeHtmlEntities(template)
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user?.username ?? member.displayName ?? 'Member')
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{memberCount}', member.guild.memberCount.toString());
}

/**
 * Handle a new member joining a guild.
 * Sends welcome messages and assigns auto-roles.
 */
export async function handleGuildMemberAdd(member: GuildMember): Promise<void> {
  try {
    const settings = await getGuildWelcomeSettings(member.guild.id);
    if (!settings) {
      return;
    }

    // Skip bot accounts if excludeBotJoins is enabled in notification preferences
    if (member.user.bot && settings.notificationPreferences?.excludeBotJoins !== false) {
      logger.debug(`Skipping welcome for bot ${member.user.tag} in ${member.guild.name}`);
      return;
    }

    const welcome = settings.welcomeSettings;
    if (!welcome) {
      return;
    }

    // Auto-role assignment
    const autoRoleIds = welcome.autoRoleIds ?? [];
    if (isOnboardingPending(member)) {
      logger.info(
        `Delaying auto-role assignment for pending member ${member.user.tag} in ${member.guild.name}`
      );
    } else {
      await assignWelcomeAutoRoles(member, autoRoleIds, 'Welcome auto-role');
    }

    // Welcome channel message
    if (welcome.welcomeEnabled && welcome.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(welcome.welcomeChannelId);
      if (channel?.isTextBased()) {
        const message =
          welcome.welcomeMessage ??
          'Welcome to **{server}**, {user}! You are member #{memberCount}.';
        const resolved = resolveTemplate(message, member);

        const embed = new EmbedBuilder()
          .setColor(0x00c853)
          .setTitle('Welcome!')
          .setDescription(resolved)
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .setTimestamp();

        await (channel as TextChannel).send({ embeds: [embed] });
      }
    }

    // Welcome DM
    if (welcome.welcomeDmEnabled) {
      try {
        const dmMessage =
          welcome.welcomeDmMessage ?? 'Welcome to **{server}**! We are glad to have you.';
        const resolved = resolveTemplate(dmMessage, member);
        await member.user.send(resolved);
      } catch {
        // DMs may be disabled — non-fatal
      }
    }
  } catch (error: unknown) {
    logger.error(`Welcome handler error for ${member.user?.tag}:`, error);
  }
}

/**
 * Handle a member update event.
 * Assigns welcome auto-roles when onboarding transitions from pending to accepted.
 */
export async function handleGuildMemberUpdate(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember
): Promise<void> {
  try {
    if (newMember.user.bot) {
      return;
    }

    const transitionedToAccepted = !isOnboardingPending(newMember) && oldMember.pending !== false;
    if (!transitionedToAccepted) {
      return;
    }

    const settings = await getGuildWelcomeSettings(newMember.guild.id);
    const autoRoleIds = settings?.welcomeSettings?.autoRoleIds ?? [];
    await assignWelcomeAutoRoles(newMember, autoRoleIds, 'Welcome auto-role after onboarding');
  } catch (error: unknown) {
    logger.error(`Welcome update handler error for ${newMember.user?.tag}:`, error);
  }
}

/**
 * Handle a member leaving a guild.
 * Sends goodbye message if configured.
 */
export async function handleGuildMemberRemove(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  try {
    const settings = await getGuildWelcomeSettings(member.guild.id);
    if (!settings) {
      return;
    }

    const welcome = settings.welcomeSettings;
    if (!welcome?.goodbyeEnabled || !welcome.goodbyeChannelId) {
      return;
    }

    const channel = member.guild.channels.cache.get(welcome.goodbyeChannelId);
    if (!channel?.isTextBased()) {
      return;
    }

    const message =
      welcome.goodbyeMessage ??
      '{username} has left **{server}**. We now have {memberCount} members.';
    const resolved = resolveTemplate(message, member);

    const embed = new EmbedBuilder()
      .setColor(0xff5252)
      .setTitle('Goodbye')
      .setDescription(resolved)
      .setTimestamp();

    await (channel as TextChannel).send({ embeds: [embed] });

    // Handle action on applicant leave (recruitment settings)
    const recruitConfig = settings.recruitmentSettings;
    const leaveAction = recruitConfig?.actionOnApplicantLeave;
    if (leaveAction && leaveAction !== 'nothing' && member.id) {
      try {
        const axios = (await import('axios')).default;
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v2';

        if (leaveAction === 'withdraw') {
          // Auto-withdraw pending applications
          await axios
            .post(`${API_BASE_URL}/recruitments/applications/withdraw-by-user`, {
              discordUserId: member.id,
              guildId: member.guild.id,
            })
            .catch(() => {});
          logger.info(`Auto-withdrew applications for leaving member ${member.user?.tag}`);
        } else if (leaveAction === 'notify') {
          // Notify staff that an applicant left
          const staffChannel = recruitConfig?.applicationChannelId
            ? member.guild.channels.cache.get(recruitConfig.applicationChannelId)
            : null;
          if (staffChannel?.isTextBased()) {
            const notifyEmbed = new EmbedBuilder()
              .setColor(0xffab00)
              .setTitle('Applicant Left Server')
              .setDescription(
                `**${decodeHtmlEntities(member.user?.tag ?? member.displayName)}** left the server while having a pending application.`
              )
              .setTimestamp();
            await (staffChannel as TextChannel).send({ embeds: [notifyEmbed] });
          }
        }
      } catch {
        // Non-fatal
      }
    }
  } catch (error: unknown) {
    logger.error(`Goodbye handler error for ${member.user?.tag}:`, error);
  }
}

/** Helper: fetch guild settings that include welcome config */
async function getGuildWelcomeSettings(guildId: string): Promise<DiscordGuildSettings | null> {
  try {
    const service = new DiscordSettingsService();
    const allSettings = await service.getSettingsByGuildId(guildId);
    return allSettings?.[0] ?? null;
  } catch {
    return null;
  }
}
