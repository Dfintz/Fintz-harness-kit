"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guildSettingsResolver = exports.GuildSettingsResolver = void 0;
const FederationDiscordSettingsService_1 = require("../federation/FederationDiscordSettingsService");
const DiscordSettingsService_1 = require("./DiscordSettingsService");
class GuildSettingsResolver {
    static instance;
    static getInstance() {
        if (!GuildSettingsResolver.instance) {
            GuildSettingsResolver.instance = new GuildSettingsResolver();
        }
        return GuildSettingsResolver.instance;
    }
    async resolve(guildId, section) {
        const orgRows = await DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId);
        const orgMatch = orgRows.find(s => s[section] !== null && s[section] !== undefined);
        if (orgMatch?.[section] !== null && orgMatch?.[section] !== undefined) {
            return { settings: orgMatch[section], source: 'org' };
        }
        const fedRows = await FederationDiscordSettingsService_1.federationDiscordSettingsService.getSettingsByGuildId(guildId);
        const fedMatch = fedRows.find(s => s[section] !== null && s[section] !== undefined);
        if (fedMatch?.[section] !== null && fedMatch?.[section] !== undefined) {
            return {
                settings: fedMatch[section],
                source: 'federation',
            };
        }
        return { settings: undefined, source: null };
    }
    async resolveAll(guildId) {
        const [orgSettings, fedSettings] = await Promise.all([
            DiscordSettingsService_1.discordSettingsService.getSettingsByGuildId(guildId),
            FederationDiscordSettingsService_1.federationDiscordSettingsService.getSettingsByGuildId(guildId),
        ]);
        return { orgSettings, fedSettings };
    }
}
exports.GuildSettingsResolver = GuildSettingsResolver;
exports.guildSettingsResolver = GuildSettingsResolver.getInstance();
//# sourceMappingURL=GuildSettingsResolver.js.map