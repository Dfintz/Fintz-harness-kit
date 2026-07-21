import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create `federation_discord_guild_settings` table.
 *
 * Stores federation-scoped Discord guild feature settings (voice, events,
 * tickets, recruitment, etc.). Mirrors org DiscordGuildSettings but scoped
 * by federationId. Primary key format: "fed_id:guild_id".
 */
export class CreateFederationDiscordGuildSettings1863200000000 implements MigrationInterface {
  name = 'CreateFederationDiscordGuildSettings1863200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('federation_discord_guild_settings');
    if (existing) {
      logger.warn('federation_discord_guild_settings table already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'federation_discord_guild_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true },
          { name: 'federationId', type: 'varchar', isNullable: false },
          { name: 'guildId', type: 'varchar', isNullable: false },
          { name: 'guildName', type: 'varchar', isNullable: true },
          { name: 'guildIconUrl', type: 'varchar', isNullable: true },

          // JSONB setting modules
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

          // Configuration
          { name: 'timezone', type: 'varchar', isNullable: true },
          { name: 'settingsEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'adminUserIds', type: 'text', isNullable: true },
          { name: 'serverManagerRoleIds', type: 'text', isNullable: true },
          { name: 'assistantRoleIds', type: 'text', isNullable: true },
          { name: 'metadata', type: 'jsonb', isNullable: true },

          // Audit
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
      }),
      true
    );

    // Unique index: one row per federation+guild pair
    await queryRunner.createIndex(
      'federation_discord_guild_settings',
      new TableIndex({
        name: 'IDX_fed_discord_guild_settings_fed_guild_unique',
        columnNames: ['federationId', 'guildId'],
        isUnique: true,
      })
    );

    // Index on federationId for listing all guild settings per federation
    await queryRunner.createIndex(
      'federation_discord_guild_settings',
      new TableIndex({
        name: 'IDX_fed_discord_guild_settings_federationId',
        columnNames: ['federationId'],
      })
    );

    // Index on guildId for bot handler lookups (resolve guild → federation settings)
    await queryRunner.createIndex(
      'federation_discord_guild_settings',
      new TableIndex({
        name: 'IDX_fed_discord_guild_settings_guildId',
        columnNames: ['guildId'],
      })
    );

    logger.info('Created federation_discord_guild_settings table with indexes');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('federation_discord_guild_settings', true);
    logger.info('Dropped federation_discord_guild_settings table');
  }
}
