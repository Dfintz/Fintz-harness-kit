"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFederationDiscordGuildSettings1863200000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateFederationDiscordGuildSettings1863200000000 {
    name = 'CreateFederationDiscordGuildSettings1863200000000';
    async up(queryRunner) {
        const existing = await queryRunner.getTable('federation_discord_guild_settings');
        if (existing) {
            logger_1.logger.warn('federation_discord_guild_settings table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'federation_discord_guild_settings',
            columns: [
                { name: 'id', type: 'varchar', isPrimary: true },
                { name: 'federationId', type: 'varchar', isNullable: false },
                { name: 'guildId', type: 'varchar', isNullable: false },
                { name: 'guildName', type: 'varchar', isNullable: true },
                { name: 'guildIconUrl', type: 'varchar', isNullable: true },
                { name: 'eventSettings', type: 'jsonb', isNullable: true },
                { name: 'voiceChannelSettings', type: 'jsonb', isNullable: true },
                { name: 'tunnelSettings', type: 'jsonb', isNullable: true },
                { name: 'notificationPreferences', type: 'jsonb', isNullable: true },
                { name: 'roleSyncSettings', type: 'jsonb', isNullable: true },
                { name: 'crossModerationSettings', type: 'jsonb', isNullable: true },
                { name: 'ticketSettings', type: 'jsonb', isNullable: true },
                { name: 'statSettings', type: 'jsonb', isNullable: true },
                { name: 'dmNotificationSettings', type: 'jsonb', isNullable: true },
                { name: 'smartLfgPingSettings', type: 'jsonb', isNullable: true },
                { name: 'recruitmentSettings', type: 'jsonb', isNullable: true },
                { name: 'giveawaySettings', type: 'jsonb', isNullable: true },
                { name: 'advancedEventSettings', type: 'jsonb', isNullable: true },
                { name: 'teamVoiceSettings', type: 'jsonb', isNullable: true },
                { name: 'roleGatingSettings', type: 'jsonb', isNullable: true },
                { name: 'lfgNetworkSettings', type: 'jsonb', isNullable: true },
                { name: 'lfgSettings', type: 'jsonb', isNullable: true },
                { name: 'welcomeSettings', type: 'jsonb', isNullable: true },
                { name: 'auditLogSettings', type: 'jsonb', isNullable: true },
                { name: 'timezone', type: 'varchar', isNullable: true },
                { name: 'settingsEnabled', type: 'boolean', default: true, isNullable: false },
                { name: 'adminUserIds', type: 'text', isNullable: true },
                { name: 'serverManagerRoleIds', type: 'text', isNullable: true },
                { name: 'assistantRoleIds', type: 'text', isNullable: true },
                { name: 'metadata', type: 'jsonb', isNullable: true },
                { name: 'lastModifiedBy', type: 'varchar', isNullable: true },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
                { name: 'lastSyncedAt', type: 'timestamp', isNullable: true },
                { name: 'syncErrorCount', type: 'int', default: 0, isNullable: false },
                { name: 'lastSyncError', type: 'varchar', isNullable: true },
            ],
        }), true);
        await queryRunner.createIndex('federation_discord_guild_settings', new typeorm_1.TableIndex({
            name: 'IDX_fed_discord_guild_settings_fed_guild_unique',
            columnNames: ['federationId', 'guildId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('federation_discord_guild_settings', new typeorm_1.TableIndex({
            name: 'IDX_fed_discord_guild_settings_federationId',
            columnNames: ['federationId'],
        }));
        await queryRunner.createIndex('federation_discord_guild_settings', new typeorm_1.TableIndex({
            name: 'IDX_fed_discord_guild_settings_guildId',
            columnNames: ['guildId'],
        }));
        logger_1.logger.info('Created federation_discord_guild_settings table with indexes');
    }
    async down(queryRunner) {
        await queryRunner.dropTable('federation_discord_guild_settings', true);
        logger_1.logger.info('Dropped federation_discord_guild_settings table');
    }
}
exports.CreateFederationDiscordGuildSettings1863200000000 = CreateFederationDiscordGuildSettings1863200000000;
//# sourceMappingURL=1863200000000-CreateFederationDiscordGuildSettings.js.map