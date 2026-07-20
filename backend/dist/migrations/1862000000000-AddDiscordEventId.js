"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDiscordEventId1862000000000 = void 0;
class AddDiscordEventId1862000000000 {
    async up(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'discordEventId'`);
        if (result.length === 0) {
            await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "discordEventId" varchar NULL`);
        }
    }
    async down(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'discordEventId'`);
        if (result.length > 0) {
            await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "discordEventId"`);
        }
    }
}
exports.AddDiscordEventId1862000000000 = AddDiscordEventId1862000000000;
//# sourceMappingURL=1862000000000-AddDiscordEventId.js.map