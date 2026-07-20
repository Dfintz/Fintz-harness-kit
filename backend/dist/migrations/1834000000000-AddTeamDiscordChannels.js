"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTeamDiscordChannels1834000000000 = void 0;
class AddTeamDiscordChannels1834000000000 {
    async up(queryRunner) {
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
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_team_discord_channels_org_team_guild" ON "team_discord_channels" ("organizationId", "teamId", "guildId")`);
        await queryRunner.query(`CREATE INDEX "IDX_team_discord_channels_org_guild" ON "team_discord_channels" ("organizationId", "guildId")`);
        await queryRunner.query(`CREATE INDEX "IDX_team_discord_channels_guild" ON "team_discord_channels" ("guildId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_guild"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_org_guild"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_team_discord_channels_org_team_guild"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "team_discord_channels"`);
    }
}
exports.AddTeamDiscordChannels1834000000000 = AddTeamDiscordChannels1834000000000;
//# sourceMappingURL=1834000000000-AddTeamDiscordChannels.js.map