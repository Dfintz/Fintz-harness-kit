import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistantRoleIdsToGuildSettings1862000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'assistantRoleIds'`
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "discord_guild_settings" ADD COLUMN "assistantRoleIds" text NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'assistantRoleIds'`
    );
    if (result.length > 0) {
      await queryRunner.query(
        `ALTER TABLE "discord_guild_settings" DROP COLUMN "assistantRoleIds"`
      );
    }
  }
}
