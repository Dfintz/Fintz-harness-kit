import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDiscordUserPreferences1859000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('discord_user_preferences');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'discord_user_preferences',
          columns: [
            { name: 'userId', type: 'varchar', isPrimary: true },
            { name: 'guildId', type: 'varchar', isPrimary: true },
            { name: 'dmEnabled', type: 'boolean', default: true },
            { name: 'lfgPingOptIn', type: 'boolean', default: true },
            { name: 'eventReminderOptIn', type: 'boolean', default: true },
            { name: 'ticketDmOptIn', type: 'boolean', default: true },
            { name: 'recruitmentDmOptIn', type: 'boolean', default: true },
            { name: 'moderationAlertOptIn', type: 'boolean', default: true },
            { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true
      );

      await queryRunner.createIndex(
        'discord_user_preferences',
        new TableIndex({
          name: 'IDX_discord_user_prefs_user_guild',
          columnNames: ['userId', 'guildId'],
          isUnique: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('discord_user_preferences');
    if (hasTable) {
      await queryRunner.dropTable('discord_user_preferences');
    }
  }
}
