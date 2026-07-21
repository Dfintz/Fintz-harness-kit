import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLfgSettingsColumn1862400000000 implements MigrationInterface {
  name = 'AddLfgSettingsColumn1862400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'lfgSettings'`
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "discord_guild_settings" ADD COLUMN "lfgSettings" jsonb`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'lfgSettings'`
    );
    if (result.length > 0) {
      await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN "lfgSettings"`);
    }
  }
}
