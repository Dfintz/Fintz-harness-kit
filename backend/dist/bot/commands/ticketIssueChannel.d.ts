import { type Guild } from 'discord.js';
import type { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
interface TicketChannelConfig {
    categoryId: string;
    roleId: string;
    transcriptChannelId?: string;
    channelNameTemplate?: string;
}
interface TicketOpenHint {
    subject?: string;
    description?: string;
    category?: string;
}
export declare function resolveTicketChannelConfig(settingsRows: DiscordGuildSettings[] | null | undefined): TicketChannelConfig | null;
export declare function openTicketChannel(guild: Guild, ticketId: string, ticketNumber: string, initiatorId: string, category: string, hint?: TicketOpenHint): Promise<void>;
export declare function closeTicketChannel(guild: Guild, ticketId: string, ticketNumber: string): Promise<void>;
export {};
//# sourceMappingURL=ticketIssueChannel.d.ts.map