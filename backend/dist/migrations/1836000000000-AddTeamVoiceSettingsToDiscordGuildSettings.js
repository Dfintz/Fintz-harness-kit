"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTeamVoiceSettingsToDiscordGuildSettings1836000000000 = void 0;
class AddTeamVoiceSettingsToDiscordGuildSettings1836000000000 {
    name = 'AddTeamVoiceSettingsToDiscordGuildSettings1836000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "discord_guild_settings" ADD COLUMN IF NOT EXISTS "teamVoiceSettings" jsonb`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "discord_guild_settings" DROP COLUMN IF EXISTS "teamVoiceSettings"`);
    }
}
exports.AddTeamVoiceSettingsToDiscordGuildSettings1836000000000 = AddTeamVoiceSettingsToDiscordGuildSettings1836000000000;
//# sourceMappingURL=1836000000000-AddTeamVoiceSettingsToDiscordGuildSettings.js.map