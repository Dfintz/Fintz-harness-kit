import { GuildMember, PartialGuildMember } from 'discord.js';
export declare function handleGuildMemberAdd(member: GuildMember): Promise<void>;
export declare function handleGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember): Promise<void>;
export declare function handleGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void>;
//# sourceMappingURL=WelcomeService.d.ts.map