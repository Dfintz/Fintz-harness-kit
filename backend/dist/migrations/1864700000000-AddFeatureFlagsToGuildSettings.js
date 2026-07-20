"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFeatureFlagsToGuildSettings1864700000000 = void 0;
class AddFeatureFlagsToGuildSettings1864700000000 {
    name = 'AddFeatureFlagsToGuildSettings1864700000000';
    async up(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'featureFlags'`);
        if (result.length === 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" ADD COLUMN "featureFlags" jsonb`);
        }
    }
    async down(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'discord_guild_settings' AND column_name = 'featureFlags'`);
        if (result.length > 0) {
            await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN "featureFlags"`);
        }
    }
}
exports.AddFeatureFlagsToGuildSettings1864700000000 = AddFeatureFlagsToGuildSettings1864700000000;
//# sourceMappingURL=1864700000000-AddFeatureFlagsToGuildSettings.js.map