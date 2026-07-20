"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoleSyncListener = registerRoleSyncListener;
const data_source_1 = require("../../data-source");
const User_1 = require("../../models/User");
const DiscordSettingsService_1 = require("../../services/discord/DiscordSettingsService");
const DomainEventBus_1 = require("../../services/shared/DomainEventBus");
const logger_1 = require("../../utils/logger");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function mappedRoleIdsForRank(roleMappings, rankName) {
    const value = roleMappings?.[rankName];
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }
    return [value];
}
async function applyRoleAddition(client, guildId, discordUserId, discordRoleId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
        return;
    }
    try {
        const member = await guild.members.fetch(discordUserId);
        if (member.roles.cache.has(discordRoleId)) {
            return;
        }
        await member.roles.add(discordRoleId, 'Platform role change synced from sc-fleet-manager (additive)');
        logger_1.logger.info('Synced platform role to Discord', {
            guildId,
            discordUserId,
            discordRoleId,
        });
    }
    catch (err) {
        logger_1.logger.warn('Failed to sync platform role to Discord', {
            guildId,
            discordUserId,
            discordRoleId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
function registerRoleSyncListener(client) {
    const settingsSvc = DiscordSettingsService_1.discordSettingsService;
    DomainEventBus_1.domainEvents.on('member:platform_role_changed', async (payload) => {
        try {
            if (!UUID_PATTERN.test(payload.userId)) {
                logger_1.logger.warn('member:platform_role_changed payload has invalid userId', {
                    userId: payload.userId,
                    organizationId: payload.organizationId,
                });
                return;
            }
            const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
            const user = await userRepo
                .createQueryBuilder('user')
                .select(['user.id', 'user.discordId'])
                .where('user.id = :userId', { userId: payload.userId })
                .getOne();
            if (!user?.discordId) {
                return;
            }
            const orgSettings = await settingsSvc.getOrganizationSettings(payload.organizationId);
            const tasks = [];
            for (const settings of orgSettings) {
                const sync = settings.roleSyncSettings;
                if (!sync?.enabled || !settings.guildId) {
                    continue;
                }
                const discordRoleIds = mappedRoleIdsForRank(sync.roleMappings, payload.newRoleName);
                if (discordRoleIds.length === 0) {
                    continue;
                }
                for (const discordRoleId of discordRoleIds) {
                    tasks.push(applyRoleAddition(client, settings.guildId, user.discordId, discordRoleId));
                }
            }
            await Promise.allSettled(tasks);
        }
        catch (err) {
            logger_1.logger.warn('member:platform_role_changed handler failed', {
                userId: payload.userId,
                organizationId: payload.organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
    logger_1.logger.info('Registered platform-role-changed → Discord role sync listener');
}
//# sourceMappingURL=roleSyncListener.js.map