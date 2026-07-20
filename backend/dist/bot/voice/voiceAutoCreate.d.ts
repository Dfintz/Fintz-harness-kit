import { Client, type Guild, type GuildMember, VoiceState } from 'discord.js';
import { VoiceChannelSettings } from '../../models/DiscordGuildSettings';
interface CreateEventTempVoiceChannelInput {
    guild: Guild;
    creator: GuildMember;
    channelName: string;
    parentCategoryId?: string;
    userLimit?: number;
    expiresAt?: Date;
    eventId?: string;
}
interface CreateEventTempVoiceChannelResult {
    channelId: string;
    channelName: string;
}
export declare function createEventTempVoiceChannel(input: CreateEventTempVoiceChannelInput): Promise<CreateEventTempVoiceChannelResult | null>;
export declare function handleEventVoiceEmpty(client: Client, oldState: VoiceState, newState: VoiceState): Promise<void>;
export declare function handleVoiceAutoCreate(client: Client, oldState: VoiceState, newState: VoiceState): Promise<void>;
export declare function getDynamicChannels(): Map<string, number>;
export declare function getChannelOwners(): Map<string, string>;
export declare function getChannelOwner(channelId: string): string | undefined;
export declare function setChannelOwner(channelId: string, userId: string): void;
export declare function reconcileDynamicChannels(guildIds: string[]): number;
export declare function clearDeletionTimers(): void;
export declare function bootstrapHubMembers(guild: Guild, voiceSettings: VoiceChannelSettings): Promise<number>;
export {};
//# sourceMappingURL=voiceAutoCreate.d.ts.map