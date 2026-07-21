import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create team_discord_channels table.
 *
 * Maps teams to their Discord channel resources (category, text, voice, role)
 * to support the Team Voice feature. Scoped by organizationId + guildId
 * for multi-tenant isolation.
 */
export class AddTeamDiscordChannels1834000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "team_discord_channels" (
        "id"               uuid DEFAULT uuid_generate_v4() NOT NULL,
        "organizationId"   character varying NOT NULL,
        "teamId"           character varying NOT NULL,
        "guildId"          character varying NOT NULL,
        "categoryId"       character varying NOT NULL,
        "textChannelId"    character varying NOT NULL,
        "voiceChannelId"   character varying NOT NULL,
        "teamRoleId"       character varying NOT NULL,
        "createdBy"        character varying NOT NULL,
        "syncStatus"       character varying(20) NOT NULL DEFAULT 'synced',
        "lastSyncError"    text,
        "lastSyncedAt"     TIMESTAMP,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_discord_channels" PRIMARY KEY ("id")
      )
    `);

    // Unique: one channel set per team per org per guild
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_team_discord_channels_org_team_guild" ON "team_discord_channels" ("organizationId", "teamId", "guildId")`
    );

    // Lookup by org + guild
    await queryRunner.query(
      `CREATE INDEX "IDX_team_discord_channels_org_guild" ON "team_discord_channels" ("organizationId", "guildId")`
    );

    // Lookup by guild
    await queryRunner.query(
      `CREATE INDEX "IDX_team_discord_channels_guild" ON "team_discord_channels" ("guildId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_guild"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_org_guild"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_org_team_guild"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_discord_channels"`);
  }
}
