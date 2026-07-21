import { EmbedBuilder } from 'discord.js';

type BoolFormatter = (value?: boolean) => string;

interface DmNotificationSettingsInput {
  enabled?: boolean;
  ticketCreated?: boolean;
  ticketAssigned?: boolean;
  ticketReplied?: boolean;
  ticketClosed?: boolean;
  ticketEscalated?: boolean;
  recruitmentReceived?: boolean;
  recruitmentAccepted?: boolean;
  recruitmentDenied?: boolean;
  eventReminder?: boolean;
  eventCancelled?: boolean;
  lfgPlayerJoined?: boolean;
}

interface SmartLfgPingSettingsInput {
  enabled?: boolean;
  cooldownHours?: number;
  maxPingsPerPost?: number;
  optInRoleId?: string;
  activityFilter?: string[];
}

interface UserNotificationPreferenceInput {
  dmEnabled: boolean;
  lfgPingOptIn: boolean;
  eventReminderOptIn: boolean;
  ticketDmOptIn: boolean;
  recruitmentDmOptIn: boolean;
  moderationAlertOptIn: boolean;
  botResponseViaDm: boolean;
  timezone?: string;
}

/**
 * Build guild DM notification status embed.
 */
export function buildDmNotificationStatusEmbed(
  dm: DmNotificationSettingsInput | undefined,
  formatBool: BoolFormatter
): EmbedBuilder {
  const enabled = dm?.enabled ?? false;

  return new EmbedBuilder()
    .setColor(enabled ? 0x00c853 : 0x9e9e9e)
    .setTitle('\u{1F514} DM Notification Settings')
    .setDescription(
      enabled ? '✅ DM notifications are **enabled**' : '❌ DM notifications are **disabled**'
    )
    .addFields(
      { name: '\u{1F3AB} Ticket Created', value: formatBool(dm?.ticketCreated), inline: true },
      { name: '\u{1F3AB} Ticket Assigned', value: formatBool(dm?.ticketAssigned), inline: true },
      { name: '\u{1F3AB} Ticket Replied', value: formatBool(dm?.ticketReplied), inline: true },
      { name: '\u{1F3AB} Ticket Closed', value: formatBool(dm?.ticketClosed), inline: true },
      { name: '\u{1F3AB} Ticket Escalated', value: formatBool(dm?.ticketEscalated), inline: true },
      {
        name: '\u{1F4CB} Recruitment Received',
        value: formatBool(dm?.recruitmentReceived),
        inline: true,
      },
      {
        name: '\u{1F4CB} Recruitment Accepted',
        value: formatBool(dm?.recruitmentAccepted),
        inline: true,
      },
      {
        name: '\u{1F4CB} Recruitment Denied',
        value: formatBool(dm?.recruitmentDenied),
        inline: true,
      },
      { name: '\u{1F4C5} Event Reminder', value: formatBool(dm?.eventReminder), inline: true },
      { name: '\u{1F4C5} Event Cancelled', value: formatBool(dm?.eventCancelled), inline: true },
      { name: '\u{1F3AE} LFG Player Joined', value: formatBool(dm?.lfgPlayerJoined), inline: true }
    )
    .setTimestamp();
}

/**
 * Build guild smart-LFG ping status embed.
 */
export function buildLfgPingStatusEmbed(ping: SmartLfgPingSettingsInput | undefined): EmbedBuilder {
  const enabled = ping?.enabled ?? false;

  return new EmbedBuilder()
    .setColor(enabled ? 0x00bcd4 : 0x9e9e9e)
    .setTitle('\u{1F3AE} Smart LFG Ping Settings')
    .setDescription(enabled ? '✅ Smart pings are **enabled**' : '❌ Smart pings are **disabled**')
    .addFields(
      { name: 'Cooldown', value: `${ping?.cooldownHours ?? 8}h`, inline: true },
      { name: 'Max Pings/Post', value: `${ping?.maxPingsPerPost ?? 5}`, inline: true },
      {
        name: 'Opt-In Role',
        value: ping?.optInRoleId ? `<@&${ping.optInRoleId}>` : 'None (all members)',
        inline: true,
      },
      {
        name: 'Activity Filter',
        value: ping?.activityFilter?.length ? ping.activityFilter.join(', ') : 'All activities',
        inline: false,
      }
    )
    .setTimestamp();
}

/**
 * Build personal /notify preference status embed.
 */
export function buildMyNotificationPreferencesEmbed(
  pref: Readonly<UserNotificationPreferenceInput>,
  formatBool: BoolFormatter
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(pref.dmEnabled ? 0x00c853 : 0x9e9e9e)
    .setTitle('Your DM Notification Preferences')
    .setDescription(
      pref.dmEnabled
        ? '✅ Your DMs from this server are **enabled**'
        : '❌ Your DMs from this server are **disabled**'
    )
    .addFields(
      { name: 'All DMs', value: formatBool(pref.dmEnabled), inline: true },
      { name: 'LFG Pings', value: formatBool(pref.lfgPingOptIn), inline: true },
      { name: 'Event Reminders', value: formatBool(pref.eventReminderOptIn), inline: true },
      { name: 'Ticket DMs', value: formatBool(pref.ticketDmOptIn), inline: true },
      { name: 'Recruitment DMs', value: formatBool(pref.recruitmentDmOptIn), inline: true },
      { name: 'Moderation Alerts', value: formatBool(pref.moderationAlertOptIn), inline: true },
      {
        name: '\u{1F4EC} Bot Responses via DM',
        value: formatBool(pref.botResponseViaDm),
        inline: true,
      },
      // preserve legacy behavior: empty timezone string should display as "Not set"
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      { name: 'Timezone', value: pref.timezone ? pref.timezone : 'Not set', inline: true }
    )
    .setFooter({ text: 'These are your personal preferences — they override server defaults' })
    .setTimestamp();
}
