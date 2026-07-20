"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDiscordUserPreferences1859000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateDiscordUserPreferences1859000000000 {
    async up(queryRunner) {
        const hasTable = await queryRunner.hasTable('discord_user_preferences');
        if (!hasTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'discord_user_preferences',
                columns: [
                    { name: 'userId', type: 'varchar', isPrimary: true },
                    { name: 'guildId', type: 'varchar', isPrimary: true },
                    { name: 'dmEnabled', type: 'boolean', default: true },
                    { name: 'lfgPingOptIn', type: 'boolean', default: true },
                    { name: 'eventReminderOptIn', type: 'boolean', default: true },
                    { name: 'ticketDmOptIn', type: 'boolean', default: true },
                    { name: 'recruitmentDmOptIn', type: 'boolean', default: true },
                    { name: 'moderationAlertOptIn', type: 'boolean', default: true },
                    { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('discord_user_preferences', new typeorm_1.TableIndex({
                name: 'IDX_discord_user_prefs_user_guild',
                columnNames: ['userId', 'guildId'],
                isUnique: true,
            }));
        }
    }
    async down(queryRunner) {
        const hasTable = await queryRunner.hasTable('discord_user_preferences');
        if (hasTable) {
            await queryRunner.dropTable('discord_user_preferences');
        }
    }
}
exports.CreateDiscordUserPreferences1859000000000 = CreateDiscordUserPreferences1859000000000;
//# sourceMappingURL=1859000000000-CreateDiscordUserPreferences.js.map