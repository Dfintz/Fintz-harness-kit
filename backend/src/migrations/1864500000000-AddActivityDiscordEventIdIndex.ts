import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddActivityDiscordEventIdIndex
 *
 * Adds an index to optimize activity lookups by linked Discord scheduled event ID.
 */
export class AddActivityDiscordEventIdIndex1864500000000 implements MigrationInterface {
  name = 'AddActivityDiscordEventIdIndex1864500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_activity_discord_event_id"
      ON "activities" ("discordEventId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_activity_discord_event_id"
    `);
  }
}
