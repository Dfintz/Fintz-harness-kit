import { BaseDomainAuditEntry, DomainAuditLogger } from './DomainAuditLogger';
export declare enum DiscordAuditAction {
    GUILD_LINKED = "DISCORD_GUILD_LINKED",
    GUILD_UNLINKED = "DISCORD_GUILD_UNLINKED",
    GUILD_SETTINGS_UPDATED = "DISCORD_GUILD_SETTINGS_UPDATED",
    BOT_ROLE_ASSIGNED = "DISCORD_BOT_ROLE_ASSIGNED",
    BOT_ROLE_REMOVED = "DISCORD_BOT_ROLE_REMOVED",
    FEDERATION_GUILD_LINKED = "DISCORD_FEDERATION_GUILD_LINKED",
    FEDERATION_DISCORD_CONFIGURED = "DISCORD_FEDERATION_DISCORD_CONFIGURED",
    VERIFY_BINDING_CREATED = "DISCORD_VERIFY_BINDING_CREATED",
    VERIFY_RUN_TRIGGERED = "DISCORD_VERIFY_RUN_TRIGGERED",
    APP_AUTHORIZED = "DISCORD_APP_AUTHORIZED",
    APP_DEAUTHORIZED = "DISCORD_APP_DEAUTHORIZED"
}
export interface DiscordAuditEntry extends BaseDomainAuditEntry<DiscordAuditAction> {
    guildId?: string;
    guildName?: string;
    targetUserId?: string;
    roleId?: string;
    settingsKey?: string;
}
export declare class DiscordAuditLogger extends DomainAuditLogger<DiscordAuditAction, DiscordAuditEntry> {
    private static instance;
    private constructor();
    static getInstance(): DiscordAuditLogger;
    protected buildMessage(entry: DiscordAuditEntry): string;
    protected buildResource(entry: DiscordAuditEntry): string;
    logGuildLinked(organizationId: string, guildId: string, guildName: string | undefined, performedById: string | undefined, isPrimary: boolean): void;
    logGuildUnlinked(organizationId: string, guildId: string, guildName: string | undefined, performedById: string): void;
    logAppAuthorized(organizationId: string, guildId: string | undefined, guildName: string | undefined, discordUserId: string | undefined, integrationType: number | undefined): void;
    logAppDeauthorized(discordUserId: string | undefined): void;
}
export declare const discordAuditLogger: DiscordAuditLogger;
//# sourceMappingURL=DiscordAuditLogger.d.ts.map