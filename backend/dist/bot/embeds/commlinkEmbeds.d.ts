import { EmbedBuilder } from 'discord.js';
interface TunnelCreatedEmbedInput {
    tunnelName: string;
    tunnelId: string;
    isPublicFromPassword: boolean;
    inviteCode?: string;
}
interface TunnelInfoEmbedInput {
    tunnelName: string;
    tunnelId: string;
    isPublic: boolean;
    connectedChannelsCount: number;
    inviteCode?: string;
}
interface TunnelListEntry {
    id: string;
    name: string;
    isPublic: boolean;
    connectedChannelsCount: number;
}
interface AvailableTunnelsEmbedInput {
    guildTunnels: TunnelListEntry[];
    publicTunnels: TunnelListEntry[];
}
export declare function buildTunnelCreatedEmbed(input: Readonly<TunnelCreatedEmbedInput>): EmbedBuilder;
export declare function buildTunnelInfoEmbed(input: Readonly<TunnelInfoEmbedInput>): EmbedBuilder;
export declare function buildAvailableTunnelsEmbed(input: Readonly<AvailableTunnelsEmbedInput>): EmbedBuilder;
export {};
//# sourceMappingURL=commlinkEmbeds.d.ts.map