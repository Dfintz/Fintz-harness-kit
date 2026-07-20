import { type Guild, type OverwriteResolvable, type TextChannel } from 'discord.js';
export interface CreateIssueChannelOptions {
    initiatorId: string;
    roleId: string;
    categoryId: string;
    name: string;
    topic?: string;
    reason?: string;
}
export declare function sanitizeChannelName(raw: string): string;
export declare function buildIssueChannelOverwrites(guild: Guild, initiatorId: string, roleId: string): OverwriteResolvable[];
export declare function createIssueChannel(guild: Guild, options: CreateIssueChannelOptions): Promise<TextChannel | null>;
export declare function deleteIssueChannel(guild: Guild, channelId: string, reason: string): Promise<void>;
//# sourceMappingURL=issueChannel.d.ts.map