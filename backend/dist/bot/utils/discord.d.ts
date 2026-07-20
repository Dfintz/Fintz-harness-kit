import type { Guild, GuildMember, PermissionResolvable, TextBasedChannel } from 'discord.js';
export declare function escapeDiscordMarkdown(text: string): string;
export declare function checkBotGuildPermissions(guild: Guild, ...permissions: PermissionResolvable[]): boolean;
export declare function checkBotChannelPermissions(channel: TextBasedChannel, ...permissions: PermissionResolvable[]): boolean;
export declare function getMissingPermissions(member: GuildMember, ...permissions: PermissionResolvable[]): string[];
//# sourceMappingURL=discord.d.ts.map