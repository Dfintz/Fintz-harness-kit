"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordAuditLogger = exports.DiscordAuditLogger = exports.DiscordAuditAction = void 0;
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("./DomainAuditLogger");
var DiscordAuditAction;
(function (DiscordAuditAction) {
    DiscordAuditAction["GUILD_LINKED"] = "DISCORD_GUILD_LINKED";
    DiscordAuditAction["GUILD_UNLINKED"] = "DISCORD_GUILD_UNLINKED";
    DiscordAuditAction["GUILD_SETTINGS_UPDATED"] = "DISCORD_GUILD_SETTINGS_UPDATED";
    DiscordAuditAction["BOT_ROLE_ASSIGNED"] = "DISCORD_BOT_ROLE_ASSIGNED";
    DiscordAuditAction["BOT_ROLE_REMOVED"] = "DISCORD_BOT_ROLE_REMOVED";
    DiscordAuditAction["FEDERATION_GUILD_LINKED"] = "DISCORD_FEDERATION_GUILD_LINKED";
    DiscordAuditAction["FEDERATION_DISCORD_CONFIGURED"] = "DISCORD_FEDERATION_DISCORD_CONFIGURED";
    DiscordAuditAction["VERIFY_BINDING_CREATED"] = "DISCORD_VERIFY_BINDING_CREATED";
    DiscordAuditAction["VERIFY_RUN_TRIGGERED"] = "DISCORD_VERIFY_RUN_TRIGGERED";
    DiscordAuditAction["APP_AUTHORIZED"] = "DISCORD_APP_AUTHORIZED";
    DiscordAuditAction["APP_DEAUTHORIZED"] = "DISCORD_APP_DEAUTHORIZED";
})(DiscordAuditAction || (exports.DiscordAuditAction = DiscordAuditAction = {}));
class DiscordAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.DISCORD,
            domainLabel: 'Discord',
        });
    }
    static getInstance() {
        if (!DiscordAuditLogger.instance) {
            DiscordAuditLogger.instance = new DiscordAuditLogger();
        }
        return DiscordAuditLogger.instance;
    }
    buildMessage(entry) {
        const target = entry.guildName ?? entry.guildId ?? entry.organizationId;
        return `Discord ${entry.action}: ${target}`;
    }
    buildResource(entry) {
        return entry.guildId ? `discordGuild/${entry.guildId}` : `discord/${entry.organizationId}`;
    }
    logGuildLinked(organizationId, guildId, guildName, performedById, isPrimary) {
        this.log({
            action: DiscordAuditAction.GUILD_LINKED,
            organizationId,
            guildId,
            guildName,
            performedById,
            details: { guildId, guildName, isPrimary },
        });
    }
    logGuildUnlinked(organizationId, guildId, guildName, performedById) {
        this.log({
            action: DiscordAuditAction.GUILD_UNLINKED,
            organizationId,
            guildId,
            guildName,
            performedById,
            details: { guildId, guildName },
        });
    }
    logAppAuthorized(organizationId, guildId, guildName, discordUserId, integrationType) {
        this.log({
            action: DiscordAuditAction.APP_AUTHORIZED,
            organizationId,
            guildId,
            guildName,
            targetUserId: discordUserId,
            details: { guildId, guildName, integrationType },
        });
    }
    logAppDeauthorized(discordUserId) {
        this.log({
            action: DiscordAuditAction.APP_DEAUTHORIZED,
            organizationId: 'user-deauth',
            targetUserId: discordUserId,
            details: { discordUserId },
        });
    }
}
exports.DiscordAuditLogger = DiscordAuditLogger;
exports.discordAuditLogger = DiscordAuditLogger.getInstance();
//# sourceMappingURL=DiscordAuditLogger.js.map