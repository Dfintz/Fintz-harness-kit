import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamVoiceSettingsToDiscordGuildSettings1836000000000 implements MigrationInterface {
  name = 'AddTeamVoiceSettingsToDiscordGuildSettings1836000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discord_guild_settings" ADD COLUMN IF NOT EXISTS "teamVoiceSettings" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discord_guild_settings" DROP COLUMN IF EXISTS "teamVoiceSettings"`
    );
  }
}
