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
export declare function buildDmNotificationStatusEmbed(dm: DmNotificationSettingsInput | undefined, formatBool: BoolFormatter): EmbedBuilder;
export declare function buildLfgPingStatusEmbed(ping: SmartLfgPingSettingsInput | undefined): EmbedBuilder;
export declare function buildMyNotificationPreferencesEmbed(pref: Readonly<UserNotificationPreferenceInput>, formatBool: BoolFormatter): EmbedBuilder;
export {};
//# sourceMappingURL=notifyEmbeds.d.ts.map