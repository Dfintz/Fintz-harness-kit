"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStarCommsManagerRoleIdsToDiscordSettings20260713112000 = void 0;
const typeorm_1 = require("typeorm");
class AddStarCommsManagerRoleIdsToDiscordSettings20260713112000 {
    name = 'AddStarCommsManagerRoleIdsToDiscordSettings20260713112000';
    async up(queryRunner) {
        const hasOrgColumn = await queryRunner.hasColumn('discord_guild_settings', 'starCommsManagerRoleIds');
        if (!hasOrgColumn) {
            await queryRunner.addColumn('discord_guild_settings', new typeorm_1.TableColumn({
                name: 'starCommsManagerRoleIds',
                type: 'text',
                isNullable: true,
            }));
        }
        const hasFederationColumn = await queryRunner.hasColumn('federation_discord_guild_settings', 'starCommsManagerRoleIds');
        if (!hasFederationColumn) {
            await queryRunner.addColumn('federation_discord_guild_settings', new typeorm_1.TableColumn({
                name: 'starCommsManagerRoleIds',
                type: 'text',
                isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        const hasFederationColumn = await queryRunner.hasColumn('federation_discord_guild_settings', 'starCommsManagerRoleIds');
        if (hasFederationColumn) {
            await queryRunner.dropColumn('federation_discord_guild_settings', 'starCommsManagerRoleIds');
        }
        const hasOrgColumn = await queryRunner.hasColumn('discord_guild_settings', 'starCommsManagerRoleIds');
        if (hasOrgColumn) {
            await queryRunner.dropColumn('discord_guild_settings', 'starCommsManagerRoleIds');
        }
    }
}
exports.AddStarCommsManagerRoleIdsToDiscordSettings20260713112000 = AddStarCommsManagerRoleIdsToDiscordSettings20260713112000;
//# sourceMappingURL=20260713112000-AddStarCommsManagerRoleIdsToDiscordSettings.js.map