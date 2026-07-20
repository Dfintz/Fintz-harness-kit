import { ButtonInteraction, ChannelSelectMenuInteraction } from 'discord.js';
import { type RsiStatusSnapshot } from '../../services/external/RsiStatusService';
export type StatusRole = 'application' | 'server';
export interface TrackedStatusChannel {
    channelId: string;
    managed: boolean;
    baseName: string;
}
export interface GuildStatusChannels {
    application?: TrackedStatusChannel;
    server?: TrackedStatusChannel;
}
export declare const ROLE_COMPONENT: Record<StatusRole, string>;
export declare function getStatusChannelsForGuild(guildId: string): Promise<GuildStatusChannels | null>;
export declare function getComponentStatusEmoji(status: string): string;
export declare function stripStatusEmoji(name: string): string;
export declare function computeChannelName(emoji: string, baseName: string): string;
export declare function getRoleEmoji(status: RsiStatusSnapshot, role: StatusRole): string;
export declare function restoreStatusChannels(): Promise<number>;
export declare function hasActiveStatusChannels(): boolean;
export declare function updateStatusChannels(status: RsiStatusSnapshot): Promise<void>;
export declare function renderStatusChannelMenu(interaction: ButtonInteraction): Promise<void>;
export declare function createManagedStatusChannelsForGuild(guildId: string): Promise<GuildStatusChannels>;
export declare function createManagedStatusChannels(interaction: ButtonInteraction): Promise<void>;
export declare function assignStatusChannelForGuild(guildId: string, role: StatusRole, channelId: string): Promise<GuildStatusChannels>;
export declare function assignExistingStatusChannel(interaction: ChannelSelectMenuInteraction, role: StatusRole): Promise<void>;
export declare function removeStatusChannelsForGuild(guildId: string): Promise<boolean>;
export declare function removeStatusChannels(interaction: ButtonInteraction): Promise<void>;
export declare function __resetStatusChannelsForTest(): void;
//# sourceMappingURL=rsiStatusChannels.d.ts.map