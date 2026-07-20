import { type VoiceServerStatus } from '@sc-fleet-manager/shared-types';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
export declare function buildVoiceInterfaceEmbed(channelName: string, creatorDisplayName: string): EmbedBuilder;
export declare function buildVoiceControlButtons(channelId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildVoiceModerationButtons(channelId: string): ActionRowBuilder<ButtonBuilder>;
export declare function buildVoiceExtendedButtons(channelId: string): ActionRowBuilder<ButtonBuilder>;
export interface VoiceTemplateSummary {
    id: string;
    name: string;
    description: string;
    userLimit: number;
    bitrate: number;
    autoDelete: boolean;
    autoDeleteDelay: number;
}
export declare function buildVoiceTemplatesEmbed(templates: readonly VoiceTemplateSummary[]): EmbedBuilder;
export interface VoiceChannelCreatedSummary {
    channelName: string;
    templateName: string;
    channelId: string;
    userLimit?: number;
    bitrate: number;
    expiresAt?: Date;
}
export declare function buildVoiceChannelCreatedEmbed(summary: VoiceChannelCreatedSummary): EmbedBuilder;
export interface VoiceAutoCreateConfiguredSummary {
    hubChannelId: string;
    parentCategoryId?: string;
    maxChannels: number;
}
export declare function buildVoiceAutoCreateConfiguredEmbed(summary: VoiceAutoCreateConfiguredSummary): EmbedBuilder;
interface PlatformConnectInfo {
    connectUrl?: string;
    serverType?: string;
    displayName?: string;
}
export declare function buildMumbleStatusEmbed(status: VoiceServerStatus | null, hasAccess: boolean, connectInfo: PlatformConnectInfo): EmbedBuilder;
export type VoiceInterfaceAction = 'lock' | 'unlock' | 'rename' | 'limit' | 'trust' | 'block' | 'claim' | 'unblock' | 'privacy' | 'kick' | 'delete';
export declare function parseVoiceInterfaceButtonId(customId: string): {
    action: VoiceInterfaceAction;
    channelId: string;
} | null;
export {};
//# sourceMappingURL=voiceInterfaceEmbed.d.ts.map