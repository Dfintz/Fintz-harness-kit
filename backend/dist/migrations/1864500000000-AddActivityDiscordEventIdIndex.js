"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddActivityDiscordEventIdIndex1864500000000 = void 0;
class AddActivityDiscordEventIdIndex1864500000000 {
    name = 'AddActivityDiscordEventIdIndex1864500000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_activity_discord_event_id"
      ON "activities" ("discordEventId")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_activity_discord_event_id"
    `);
    }
}
exports.AddActivityDiscordEventIdIndex1864500000000 = AddActivityDiscordEventIdIndex1864500000000;
//# sourceMappingURL=1864500000000-AddActivityDiscordEventIdIndex.js.map