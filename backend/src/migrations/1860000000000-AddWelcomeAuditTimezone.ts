import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWelcomeAuditTimezone1860000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add welcomeSettings JSONB column to discord_guild_settings
    const hasWelcome = await queryRunner.hasColumn('discord_guild_settings', 'welcomeSettings');
    if (!hasWelcome) {
      await queryRunner.addColumn(
        'discord_guild_settings',
        new TableColumn({ name: 'welcomeSettings', type: 'jsonb', isNullable: true })
      );
    }

    // Add auditLogSettings JSONB column to discord_guild_settings
    const hasAudit = await queryRunner.hasColumn('discord_guild_settings', 'auditLogSettings');
    if (!hasAudit) {
      await queryRunner.addColumn(
        'discord_guild_settings',
        new TableColumn({ name: 'auditLogSettings', type: 'jsonb', isNullable: true })
      );
    }

    // Add timezone column to discord_user_preferences
    const hasTimezone = await queryRunner.hasColumn('discord_user_preferences', 'timezone');
    if (!hasTimezone) {
      await queryRunner.addColumn(
        'discord_user_preferences',
        new TableColumn({ name: 'timezone', type: 'varchar', isNullable: true })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTimezone = await queryRunner.hasColumn('discord_user_preferences', 'timezone');
    if (hasTimezone) {
      await queryRunner.dropColumn('discord_user_preferences', 'timezone');
    }

    const hasAudit = await queryRunner.hasColumn('discord_guild_settings', 'auditLogSettings');
    if (hasAudit) {
      await queryRunner.dropColumn('discord_guild_settings', 'auditLogSettings');
    }

    const hasWelcome = await queryRunner.hasColumn('discord_guild_settings', 'welcomeSettings');
    if (hasWelcome) {
      await queryRunner.dropColumn('discord_guild_settings', 'welcomeSettings');
    }
  }
}
