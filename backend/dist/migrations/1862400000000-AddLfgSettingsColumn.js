"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLfgSettingsColumn1862400000000 = void 0;
class AddLfgSettingsColumn1862400000000 {
    name = 'AddLfgSettingsColumn1862400000000';
    async up(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'lfgSettings'`);
        if (result.length === 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" ADD COLUMN "lfgSettings" jsonb`);
        }
    }
    async down(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'lfgSettings'`);
        if (result.length > 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN "lfgSettings"`);
        }
    }
}
exports.AddLfgSettingsColumn1862400000000 = AddLfgSettingsColumn1862400000000;
//# sourceMappingURL=1862400000000-AddLfgSettingsColumn.js.map