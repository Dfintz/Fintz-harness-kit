import { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
export interface GuildContext {
    guildId: string;
    organizationId: string;
    federationId?: string;
}
type RepliableGuildInteraction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
export declare function resolveGuildContext(interaction: RepliableGuildInteraction, explicitOrgId?: string | null): Promise<GuildContext | null>;
export declare function resolveOrgIdForGuild(guildId: string): Promise<string | null>;
export {};
//# sourceMappingURL=guildContext.d.ts.map