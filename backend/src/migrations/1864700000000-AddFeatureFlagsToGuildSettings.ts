import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ARCH-11: add the per-guild bot feature-flag overrides column.
 *
 * Stores a `{ <featureFlagId>: boolean }` JSONB map forming the per-guild layer
 * of the `guildFeatureFlags` resolver (read/written via `DiscordSettingsService`).
 * Idempotent — mirrors the `AddLfgSettingsColumn` precedent.
 */
export class AddFeatureFlagsToGuildSettings1864700000000 implements MigrationInterface {
  name = 'AddFeatureFlagsToGuildSettings1864700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'featureFlags'`
    );
    if (result.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "discord_guild_settings" ADD COLUMN "featureFlags" jsonb`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'featureFlags'`
    );
    if (result.length > 0) {
      await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN "featureFlags"`);
    }
  }
}
