"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePollDiscordMirrorTable1797000000000 = void 0;
class CreatePollDiscordMirrorTable1797000000000 {
    name = 'CreatePollDiscordMirrorTable1797000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE "poll_discord_mirrors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "pollId" uuid NOT NULL,
        "scope" varchar(20) NOT NULL DEFAULT 'organization',
        "federationId" uuid,
        "organizationId" uuid NOT NULL,
        "guildId" varchar(20) NOT NULL,
        "channelId" varchar(20),
        "messageId" varchar(20),
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "retryCount" integer NOT NULL DEFAULT 0,
        "errorMessage" text,
        "deliveredAt" timestamp,
        "lastUpdatedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_poll_discord_mirrors" PRIMARY KEY ("id"),
        CONSTRAINT "FK_poll_discord_mirrors_poll" FOREIGN KEY ("pollId")
          REFERENCES "polls"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_poll_discord_mirrors_poll" ON "poll_discord_mirrors" ("pollId")`);
        await queryRunner.query(`CREATE INDEX "IDX_poll_discord_mirrors_guild" ON "poll_discord_mirrors" ("guildId")`);
        await queryRunner.query(`CREATE INDEX "IDX_poll_discord_mirrors_status" ON "poll_discord_mirrors" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_poll_discord_mirrors_org" ON "poll_discord_mirrors" ("organizationId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_poll_discord_mirrors_poll_guild" ON "poll_discord_mirrors" ("pollId", "guildId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_poll_discord_mirrors_poll_guild"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_poll_discord_mirrors_org"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_poll_discord_mirrors_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_poll_discord_mirrors_guild"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_poll_discord_mirrors_poll"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "poll_discord_mirrors"`);
    }
}
exports.CreatePollDiscordMirrorTable1797000000000 = CreatePollDiscordMirrorTable1797000000000;
//# sourceMappingURL=1797000000000-CreatePollDiscordMirrorTable.js.map