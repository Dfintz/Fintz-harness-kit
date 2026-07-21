import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddServerTimezone1861000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasColumn('discord_guild_settings', 'timezone');
    if (!has) {
      await queryRunner.addColumn(
        'discord_guild_settings',
        new TableColumn({ name: 'timezone', type: 'varchar', isNullable: true })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasColumn('discord_guild_settings', 'timezone');
    if (has) {
      await queryRunner.dropColumn('discord_guild_settings', 'timezone');
    }
  }
}
