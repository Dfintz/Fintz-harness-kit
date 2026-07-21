/**
 * Event subcommand handlers — extracted from the monolithic execute() function
 * to reduce cognitive complexity and improve maintainability.
 */
import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

import { ActivityType, ParticipantRole } from '../../models/Activity';
import { ActivityService, EventMirrorService } from '../../services/activity';
import { VoiceChannelService } from '../../services/communication';
import { discordSettingsService } from '../../services/discord/DiscordSettingsService';
import { GuildOrganizationService } from '../../services/discord/GuildOrganizationService';
import { EventRole } from '../../types';
import { getErrorMessage } from '../../utils/errorHandler';
import {
  buildMirroredEventComponents,
  buildMirroredEventEmbed,
} from '../embeds/mirroredEventMessage';
import { publishMirrorSync } from '../mirrorSyncPublisher';
import { getRoleEmoji } from '../utils/emojiMaps';
import { resolveOrgIdForGuild } from '../utils/guildContext';

// Lazy-initialise services
interface EventServices {
  activityService: ActivityService;
  voiceChannelService: VoiceChannelService;
  mirrorService: EventMirrorService;
  guildOrgService: GuildOrganizationService;
}

let _services: EventServices | null = null;

function getServices(): EventServices {
  if (!_services) {
    _services = {
      activityService: new ActivityService(),
      voiceChannelService: VoiceChannelService.getInstance(),
      mirrorService: EventMirrorService.getInstance(),
      guildOrgService: GuildOrganizationService.getInstance(),
    };
  }
  return _services;
}

/** Fire-and-forget mirror sync after RSVP changes (non-critical) */
function triggerMirrorSync(
  activityId: string,
  userId: string,
  action: 'join' | 'tentative' | 'decline' | 'leave'
): void {
  getServices()
    .activityService.getActivityById(activityId)
    .then(activity => {
      if (!activity) {
        return;
      }
      publishMirrorSync({
        activityId,
        userId,
        action,
        currentParticipants: activity.currentParticipants ?? 0,
        maxParticipants: activity.maxParticipants ?? undefined,
      }).catch(() => {
        /* non-critical */
      });
    })
    .catch(() => {
      /* non-critical */
    });
}

function getRecurrenceIntervalWeeks(frequency: string): number | undefined {
  switch (frequency) {
    case 'biweekly':
      return 2;
    case 'weekly':
      return 1;
    default:
      return undefined;
  }
}

function getFrequencyLabel(frequency: string): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every 2 weeks';
    default:
      return 'Monthly';
  }
}

/**
 * Parse a time string (HH:MM) and set it on the given date.
 * Returns an error string on failure, null on success.
 */
function parseAndSetTime(date: Date, timeStr: string | undefined): string | null {
  if (!timeStr) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return null;
  }

  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const timeParts = timeRegex.exec(timeStr);
  if (!timeParts) {
    return '❌ Invalid time format. Please use HH:MM (24h format), e.g. `14:30`.';
  }

  const hours = Number.parseInt(timeParts[1], 10);
  const minutes = Number.parseInt(timeParts[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return '❌ Invalid time. Hours must be 0-23 and minutes 0-59.';
  }

  date.setHours(hours, minutes, 0, 0);
  return null;
}

/**
 * Calculate the next recurring date based on frequency and optional day of week.
 */
function advanceToNextOccurrence(
  nextDate: Date,
  now: Date,
  frequency: string,
  dayStr?: string
): void {
  if (dayStr && (frequency === 'weekly' || frequency === 'biweekly')) {
    const targetDay = Number.parseInt(dayStr, 10);
    const currentDay = nextDate.getDay();
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;
    if (daysUntilTarget === 0) {
      daysUntilTarget = frequency === 'biweekly' ? 14 : 7;
    }
    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
  } else if (nextDate <= now) {
    switch (frequency) {
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'weekly':
      default:
        nextDate.setDate(nextDate.getDate() + 7);
        break;
    }
  }
}

// ==================== SUBCOMMAND HANDLERS ====================

export async function handleEventList(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
  const listType = interaction.isChatInputCommand()
    ? (interaction.options.get('type')?.value as ActivityType | undefined)
    : undefined;
  const filter: { activityType?: ActivityType } = {};
  if (listType) {
    filter.activityType = listType;
  }
  const allEvents = await getServices().activityService.getUpcomingActivities(filter);

  const typeLabel = listType ?? 'activities';
  if (allEvents.length === 0) {
    await interaction.editReply(`📅 No upcoming ${typeLabel} at the moment.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(
      listType
        ? `📅 Upcoming Fleet ${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)}s`
        : '📅 Upcoming Fleet Activities'
    )
    .setDescription(`Total: ${allEvents.length}`)
    .setTimestamp();

  allEvents.slice(0, 10).forEach(activity => {
    const dateStr = activity.scheduledStartDate
      ? new Date(activity.scheduledStartDate).toLocaleString()
      : 'Not scheduled';
    const accepted = activity.participants?.filter(p => p.status === 'accepted').length || 0;
    const tentative = activity.participants?.filter(p => p.status === 'standby').length || 0;
    const declined = activity.participants?.filter(p => p.status === 'declined').length || 0;
    const stats = `✅ ${accepted} | ❓ ${tentative} | ❌ ${declined}`;
    embed.addFields({
      name: `${activity.title} (ID: ${activity.id})`,
      value: `📍 ${activity.location ?? 'TBD'}\n🕒 ${dateStr}\n${stats}`,
      inline: false,
    });
  });

  if (allEvents.length > 10) {
    embed.setFooter({ text: `Showing 10 of ${allEvents.length} events` });
  }

  await interaction.editReply({ embeds: [embed] });
}

export async function handleEventInfo(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const eventId = interaction.options.get('eventid')?.value as string;
  const activity = await getServices().activityService.getActivityById(eventId);

  if (!activity) {
    await interaction.editReply({ content: `❌ Activity not found with ID: ${eventId}` });
    return;
  }

  const accepted = activity.participants?.filter(p => p.status === 'accepted').length || 0;
  const tentative = activity.participants?.filter(p => p.status === 'standby').length || 0;
  const declined = activity.participants?.filter(p => p.status === 'declined').length || 0;

  const embed = new EmbedBuilder()
    .setColor(0x00ff00)
    .setTitle(`📅 Event: ${activity.title}`)
    .setDescription(activity.description ?? 'No description')
    .addFields(
      { name: 'Event ID', value: activity.id, inline: true },
      { name: 'Location', value: activity.location ?? 'TBD', inline: true },
      {
        name: 'Date',
        value: activity.scheduledStartDate
          ? new Date(activity.scheduledStartDate).toLocaleString()
          : 'Not scheduled',
        inline: true,
      }
    );

  embed.addFields({
    name: 'RSVP Status',
    value: `✅ Accepted: ${accepted}\n❓ Tentative: ${tentative}\n❌ Declined: ${declined}`,
    inline: true,
  });

  // Add role distribution
  const roleStats: Record<string, number> = {};
  activity.participants?.forEach(p => {
    if (p.status === 'accepted' && p.role) {
      roleStats[p.role] = (roleStats[p.role] || 0) + 1;
    }
  });

  if (Object.keys(roleStats).length > 0) {
    const roleText = Object.entries(roleStats)
      .map(([role, count]) => `${getRoleEmoji(role as EventRole)} ${role}: ${count}`)
      .join('\n');
    embed.addFields({ name: 'Role Distribution', value: roleText, inline: true });
  }

  // Add role requirements if set
  if (activity.roleRequirements && activity.roleRequirements.length > 0) {
    const reqText = activity.roleRequirements
      .map((req: { role: string; min?: number; count?: number }) => {
        const count = req.min ?? req.count ?? 1;
        return `${getRoleEmoji(req.role)} ${req.role}: ${count} needed`;
      })
      .join('\n');
    embed.addFields({ name: 'Role Requirements', value: reqText, inline: true });
  }

  await interaction.editReply({ embeds: [embed] });
}

export async function handleEventCreate(
  interaction: ButtonInteraction | ChatInputCommandInteraction
): Promise<void> {
  // Delegate to the interactive creation wizard (Raid-Helper style)
  const { launchEventCreationWizard } = await import('../interactions/eventCreationWizard');
  await launchEventCreationWizard(interaction);
}

export async function handleEventJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const eventId = interaction.options.get('eventid')?.value as string;
  const role = interaction.options.get('role')?.value as EventRole;
  const shipName = interaction.options.get('ship')?.value as string | undefined;
  const shipType = interaction.options.get('shiptype')?.value as string | undefined;
  const userId = interaction.user.id;

  // Check event RSVP role restrictions from guild settings
  if (interaction.guildId && interaction.member && 'roles' in interaction.member) {
    try {
      const { discordSettingsService } =
        await import('../../services/discord/DiscordSettingsService');
      const allSettings = await discordSettingsService.getSettingsByGuildId(interaction.guildId);
      const eventConfig = allSettings?.[0]?.eventSettings;

      if (eventConfig) {
        const memberRoles = new Set(
          Array.isArray(interaction.member.roles)
            ? interaction.member.roles
            : [...(interaction.member.roles as { cache: Map<string, unknown> }).cache.keys()]
        );

        if (eventConfig.bannedRoleIds?.length) {
          const hasBanned = eventConfig.bannedRoleIds.some(r => memberRoles.has(r));
          if (hasBanned) {
            await interaction.reply({
              content: '❌ You are not allowed to RSVP to events.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        if (eventConfig.allowedRoleIds?.length) {
          const hasAllowed = eventConfig.allowedRoleIds.some(r => memberRoles.has(r));
          if (!hasAllowed) {
            await interaction.reply({
              content: '❌ You do not have the required role to RSVP.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }
      }
    } catch {
      // Non-fatal — continue without role check
    }
  }

  try {
    await getServices().activityService.joinActivity(eventId, {
      userId,
      userName: interaction.user.username,
      role: role as unknown as ParticipantRole,
      shipType,
      shipName,
    });

    let message = `✅ Successfully joined tactical group ${eventId} as ${getRoleEmoji(role)} ${role}!`;
    if (shipName || shipType) {
      message += `\n🚀 Ship: ${shipName ?? 'N/A'} (${shipType ?? 'N/A'})`;
    }
    if (shipName && shipType) {
      message += `\n\n💡 *To register your ship for crew sign-ups, use the **Bring Ship** button on the event embed.*`;
    }

    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    triggerMirrorSync(eventId, userId, 'join');
  } catch (error: unknown) {
    const errorMsg = getErrorMessage(error);
    if (errorMsg.includes('already a participant')) {
      await getServices().activityService.updateRSVPStatus(
        eventId,
        userId,
        'accepted',
        role as unknown as ParticipantRole
      );
      await interaction.reply({
        content: `✅ Updated your RSVP to **accepted** as ${getRoleEmoji(role)} ${role}.`,
        flags: MessageFlags.Ephemeral,
      });
      triggerMirrorSync(eventId, userId, 'join');
    } else if (errorMsg.includes('full') || errorMsg.includes('max')) {
      await interaction.reply({
        content: `❌ Event is full. Use \`/events waitlist eventid:${eventId}\` to join the waitlist.`,
        flags: MessageFlags.Ephemeral,
      });
    } else {
      throw error;
    }
  }
}

export async function handleEventTentative(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const eventId = interaction.options.get('eventid')?.value as string;
  const role = interaction.options.get('role')?.value as EventRole;
  const shipName = interaction.options.get('ship')?.value as string | undefined;
  const shipType = interaction.options.get('shiptype')?.value as string | undefined;
  const userId = interaction.user.id;

  try {
    await getServices().activityService.joinActivity(eventId, {
      userId,
      userName: interaction.user.username,
      role: role as unknown as ParticipantRole,
      shipType,
      shipName,
    });
  } catch (err: unknown) {
    const msg = getErrorMessage(err);
    if (!msg.toLowerCase().includes('already a participant')) {
      throw err;
    }
  }

  await getServices().activityService.updateRSVPStatus(
    eventId,
    userId,
    'standby',
    role as unknown as ParticipantRole
  );

  let message = `❓ Marked as tentative for tactical group ${eventId} as ${getRoleEmoji(role)} ${role}!`;
  if (shipName || shipType) {
    message += `\n🚀 Ship: ${shipName ?? 'N/A'} (${shipType ?? 'N/A'})`;
  }

  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  triggerMirrorSync(eventId, userId, 'tentative');
}

export async function handleEventDecline(interaction: ChatInputCommandInteraction): Promise<void> {
  const eventId = interaction.options.get('eventid')?.value as string;
  const userId = interaction.user.id;
  await getServices().activityService.updateRSVPStatus(eventId, userId, 'declined');
  await interaction.reply({
    content: `❌ Declined event ${eventId}`,
    flags: MessageFlags.Ephemeral,
  });
  triggerMirrorSync(eventId, userId, 'decline');
}

export async function handleEventLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  const eventId = interaction.options.get('eventid')?.value as string;
  const userId = interaction.user.id;
  await getServices().activityService.leaveActivity(eventId, userId);
  await interaction.reply({
    content: `✅ Successfully left event ${eventId}!`,
    flags: MessageFlags.Ephemeral,
  });
  triggerMirrorSync(eventId, userId, 'leave');
}

export async function handleEventRecurring(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply();

  const title = interaction.options.get('title')?.value as string;
  const description = interaction.options.get('description')?.value as string;
  const frequency = interaction.options.get('frequency')?.value as string;
  const dayStr = interaction.options.get('day')?.value as string | undefined;
  const timeStr = interaction.options.get('time')?.value as string | undefined;
  const location = interaction.options.get('location')?.value as string | undefined;

  const now = new Date();
  const nextDate = new Date(now);

  const timeError = parseAndSetTime(nextDate, timeStr);
  if (timeError) {
    await interaction.editReply(timeError);
    return;
  }

  advanceToNextOccurrence(nextDate, now, frequency, dayStr);

  const recurringOrgId = await resolveOrgIdForGuild(interaction.guildId as string);
  if (!recurringOrgId) {
    await interaction.editReply({
      content:
        '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.',
    });
    return;
  }

  const recurringType =
    (interaction.options.get('type')?.value as ActivityType | undefined) ?? ActivityType.EVENT;
  const newActivity = await getServices().activityService.createActivity(recurringOrgId, {
    title,
    description,
    activityType: recurringType,
    location: location ?? 'TBD',
    scheduledStartDate: nextDate,
    creatorId: interaction.user.id,
    creatorName: interaction.user.username,
    metadata: {
      recurrencePattern: frequency === 'biweekly' ? 'weekly' : frequency,
      recurrenceIntervalWeeks: getRecurrenceIntervalWeeks(frequency),
      isTemplate: false,
      autoRemind: true,
    },
  });

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🔁 Recurring Event Created')
    .setDescription(`**${title}**\n${description}`)
    .addFields(
      { name: '🔄 Frequency', value: getFrequencyLabel(frequency), inline: true },
      {
        name: '📅 First Occurrence',
        value: `<t:${Math.floor(nextDate.getTime() / 1000)}:F>`,
        inline: true,
      },
      { name: '📍 Location', value: location ?? 'TBD', inline: true },
      { name: '🆔 Event ID', value: newActivity.id, inline: true }
    )
    .setFooter({
      text: 'Recurrence metadata stored — use the API or scheduler to auto-generate future instances',
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export async function handleEventMirror(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventId = interaction.options.get('eventid')?.value as string;
  const mirrorKey = interaction.options.get('key')?.value as string | undefined;

  const sourceActivity = await getServices().activityService.getActivityById(eventId);
  if (!sourceActivity) {
    await interaction.editReply({ content: `❌ Activity not found with ID: \`${eventId}\`` });
    return;
  }

  const eventMirrorKeyHash = sourceActivity.metadata?.mirrorKeyHash;
  if (eventMirrorKeyHash) {
    if (!mirrorKey) {
      await interaction.editReply({
        content:
          '🔑 This event requires a mirror key. Use `/events mirror eventid:<id> key:<password>`.',
      });
      return;
    }
    const isValidKey = await getServices().mirrorService.validateMirrorKey(eventId, mirrorKey);
    if (!isValidKey) {
      await interaction.editReply({ content: '❌ Invalid mirror key.' });
      return;
    }
  }

  const sourceGuildId = sourceActivity.metadata?.discordServerId;
  if (!sourceGuildId) {
    await interaction.editReply({
      content:
        '❌ This event does not have a Discord server ID associated with it. It may have been created via the API rather than Discord.',
    });
    return;
  }

  const targetOrgId = await resolveOrgIdForGuild(interaction.guildId);
  if (!targetOrgId) {
    await interaction.editReply({
      content:
        '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.',
    });
    return;
  }

  const mirrorResult = await getServices().mirrorService.createMirror({
    sourceActivityId: eventId,
    sourceGuildId,
    sourceOrganizationId: sourceActivity.organizationId ?? '',
    mirrorGuildId: interaction.guildId,
    mirrorChannelId: interaction.channelId,
    mirrorKey,
    targetOrganizationId: targetOrgId,
  });

  if (!mirrorResult.success) {
    await interaction.editReply({ content: `❌ ${mirrorResult.message}` });
    return;
  }

  if (!mirrorResult.mirror) {
    await interaction.editReply({ content: '❌ Mirror creation returned no mirror data.' });
    return;
  }

  const mirroredEmbed = await buildMirroredEventEmbed(sourceActivity, mirrorResult.mirror.id);
  const mirrorComponents = buildMirroredEventComponents(sourceActivity.id);

  const mirrorMessage = await interaction.followUp({
    embeds: [mirroredEmbed],
    components: mirrorComponents,
    ephemeral: false,
  });

  if (!mirrorMessage?.id) {
    await interaction.editReply({
      content:
        '❌ Mirror record was created, but posting the mirrored event message failed. Check bot send/embed permissions in this channel and try again.',
    });
    return;
  }

  await getServices().mirrorService.setMirrorMessageId(mirrorResult.mirror.id, mirrorMessage.id);

  await interaction.editReply({
    content: `✅ Event **${sourceActivity.title}** mirrored successfully! RSVP changes will sync across servers.`,
  });
}

export async function handleEventMirrorkey(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventId = interaction.options.get('eventid')?.value as string;
  const key = interaction.options.get('key')?.value as string;

  const activity = await getServices().activityService.getActivityById(eventId);
  if (!activity) {
    await interaction.editReply({ content: `❌ Activity not found with ID: \`${eventId}\`` });
    return;
  }

  // Resolve Discord ID to internal UUID since creatorId stores the internal user UUID.
  const { UserService } = await import('../../services/user');
  const internalUser = await new UserService().getUserByDiscordId(interaction.user.id);
  const internalUserId = internalUser?.id ?? null;
  if (activity.creatorId !== internalUserId && activity.creatorId !== interaction.user.id) {
    await interaction.editReply({ content: '❌ Only the event creator can set a mirror key.' });
    return;
  }

  const keyResult = await getServices().mirrorService.setEventMirrorKey(eventId, key);
  if (!keyResult.success) {
    await interaction.editReply({ content: `❌ ${keyResult.message}` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🔑 Mirror Key Set')
    .setDescription(
      `Mirror key has been set for **${activity.title}**.\n\nShare this key with other server admins so they can mirror this event using:\n\`/events mirror eventid:${eventId} key:<your-key>\``
    )
    .setFooter({ text: `Event ID: ${eventId}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

export async function handleEventUnmirror(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventId = interaction.options.get('eventid')?.value as string;

  const mirrorToCancel = await getServices().mirrorService.findMirror(eventId, interaction.guildId);
  if (!mirrorToCancel) {
    await interaction.editReply({
      content: `❌ No active mirror found for event \`${eventId}\` in this server.`,
    });
    return;
  }

  const cancelResult = await getServices().mirrorService.cancelMirror(mirrorToCancel.id);
  if (!cancelResult.success) {
    await interaction.editReply({ content: `❌ ${cancelResult.message}` });
    return;
  }

  await interaction.editReply({
    content: `✅ Mirror for event \`${eventId}\` has been removed from this server. RSVP sync is now disabled.`,
  });
}

export async function handleEventMirrorlimit(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!interaction.memberPermissions?.has('ManageGuild')) {
    await interaction.reply({
      content: '❌ You need the **Manage Server** permission to change mirror settings.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const orgId = await resolveOrgIdForGuild(interaction.guildId);
  if (!orgId) {
    await interaction.editReply({
      content:
        '❌ This server is not linked to an organization or federation. Use `/guild setup` or `/federation setup` first.',
    });
    return;
  }
  const newLimit = interaction.options.get('limit')?.value as number | undefined;

  if (newLimit === null || newLimit === undefined) {
    const currentLimit = await getServices().mirrorService.resolveMaxMirrors(
      interaction.guildId,
      orgId
    );
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('🪞 Mirror Limit')
      .setDescription(
        `Current max mirrors per activity: **${currentLimit}**\n\nUse \`/events mirrorlimit limit:<1–10>\` to change.`
      )
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await discordSettingsService.updateEventSettings(
    orgId,
    interaction.guildId,
    { maxMirrorsPerActivity: newLimit },
    interaction.user.id
  );

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ Mirror Limit Updated')
    .setDescription(`Max mirrors per activity has been set to **${newLimit}** for this server.`)
    .setTimestamp();
  await interaction.editReply({ embeds: [embed] });
}

export async function handleEventUnsigned(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({
      content: '❌ This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const eventId = interaction.options.get('eventid')?.value as string;
  const targetRole = interaction.options.getRole('role', true);

  const activity = await getServices().activityService.getActivityById(eventId);
  if (!activity) {
    await interaction.editReply({ content: `❌ Activity not found: ${eventId}` });
    return;
  }

  const roleMembers = interaction.guild.roles.cache.get(targetRole.id)?.members;
  if (!roleMembers || roleMembers.size === 0) {
    await interaction.editReply({
      content: `ℹ️ No members found with the role **${targetRole.name}**.`,
    });
    return;
  }

  const signedUpIds = new Set(
    (activity.participants ?? [])
      .filter(p => p.status === 'accepted' || p.status === 'standby')
      .map(p => p.userId)
  );

  const unsignedMembers = roleMembers.filter(m => !signedUpIds.has(m.id));

  if (unsignedMembers.size === 0) {
    await interaction.editReply({
      content: `✅ All members with role **${targetRole.name}** have signed up for this event!`,
    });
    return;
  }

  const maxDisplay = 25;
  const displayList = [...unsignedMembers.values()]
    .slice(0, maxDisplay)
    .map(m => `• <@${m.id}>`)
    .join('\n');
  const remaining = unsignedMembers.size - maxDisplay;
  const total = roleMembers.size;
  const signedUp = roleMembers.size - unsignedMembers.size;

  const remainingText = remaining > 0 ? `\n\n…and ${remaining} more` : '';

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🚫 Unsigned Members — ${activity.title}`)
    .setDescription(
      `**${unsignedMembers.size}** of **${total}** members with **${targetRole.name}** have **NOT** signed up.\n\n${displayList}${remainingText}`
    )
    .addFields({
      name: 'RSVP Progress',
      value: `✅ Signed up: **${signedUp}/${total}** (${Math.round((signedUp / total) * 100)}%)`,
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
