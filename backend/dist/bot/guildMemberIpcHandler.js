"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUILD_FETCH_MEMBER_ACTION = void 0;
exports.initializeGuildMemberHandler = initializeGuildMemberHandler;
const logger_1 = require("../utils/logger");
exports.GUILD_FETCH_MEMBER_ACTION = 'guild:fetchMember';
function initializeGuildMemberHandler(ipcService, client) {
    if (!ipcService.isAvailable()) {
        logger_1.logger.debug('GuildMemberIPC: IPC not available, handler not registered');
        return;
    }
    ipcService.registerHandler(exports.GUILD_FETCH_MEMBER_ACTION, async (message) => {
        const data = message.data;
        if (!data.guildId || !data.discordUserId) {
            return {
                correlationId: message.correlationId,
                success: false,
                status: 'handled',
                definitive: true,
                error: 'Invalid payload: missing guildId or discordUserId',
            };
        }
        const { guildId, discordUserId } = data;
        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                return {
                    correlationId: message.correlationId,
                    success: true,
                    status: 'not_handled',
                    definitive: false,
                    data: { found: false, reason: 'guild_not_cached', guildId },
                };
            }
            const member = await guild.members.fetch(discordUserId).catch(() => null);
            if (!member) {
                return {
                    correlationId: message.correlationId,
                    success: true,
                    status: 'handled',
                    definitive: true,
                    data: {
                        found: false,
                        isInGuild: false,
                        guildName: guild.name,
                    },
                };
            }
            return {
                correlationId: message.correlationId,
                success: true,
                status: 'handled',
                definitive: true,
                data: {
                    found: true,
                    isInGuild: true,
                    discordId: member.id,
                    displayName: member.displayName ?? member.user.username,
                    guildId: guild.id,
                    guildName: guild.name,
                    roleIds: member.roles.cache
                        .filter(r => r.id !== guild.id)
                        .map(r => r.id),
                    roleNames: member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name),
                    status: member.presence?.status === 'invisible'
                        ? 'offline'
                        : (member.presence?.status ?? null),
                    joinedAt: member.joinedAt?.toISOString() ?? null,
                },
            };
        }
        catch (error) {
            logger_1.logger.error('GuildMemberIPC: Failed to fetch member', {
                error: error instanceof Error ? error.message : String(error),
                guildId,
                discordUserId,
            });
            return {
                correlationId: message.correlationId,
                success: false,
                status: 'handled',
                definitive: true,
                error: `Failed to fetch member: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    });
    logger_1.logger.info('GuildMemberIPC: guild:fetchMember handler registered');
}
//# sourceMappingURL=guildMemberIpcHandler.js.map