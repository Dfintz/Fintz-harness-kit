"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAssistantRoleIdsToGuildSettings1862000000000 = void 0;
class AddAssistantRoleIdsToGuildSettings1862000000000 {
    async up(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'assistantRoleIds'`);
        if (result.length === 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" ADD COLUMN "assistantRoleIds" text NULL`);
        }
    }
    async down(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'assistantRoleIds'`);
        if (result.length > 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN "assistantRoleIds"`);
        }
    }
}
exports.AddAssistantRoleIdsToGuildSettings1862000000000 = AddAssistantRoleIdsToGuildSettings1862000000000;
//# sourceMappingURL=1862000000000-AddAssistantRoleIdsToGuildSettings.js.map