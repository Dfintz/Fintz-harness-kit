"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddWelcomeAuditTimezone1860000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddWelcomeAuditTimezone1860000000000 {
    async up(queryRunner) {
        const hasWelcome = await queryRunner.hasColumn('discord_guild_settings', 'welcomeSettings');
        if (!hasWelcome) {
            await queryRunner.addColumn('discord_guild_settings', new typeorm_1.TableColumn({ name: 'welcomeSettings', type: 'jsonb', isNullable: true }));
        }
        const hasAudit = await queryRunner.hasColumn('discord_guild_settings', 'auditLogSettings');
        if (!hasAudit) {
            await queryRunner.addColumn('discord_guild_settings', new typeorm_1.TableColumn({ name: 'auditLogSettings', type: 'jsonb', isNullable: true }));
        }
        const hasTimezone = await queryRunner.hasColumn('discord_user_preferences', 'timezone');
        if (!hasTimezone) {
            await queryRunner.addColumn('discord_user_preferences', new typeorm_1.TableColumn({ name: 'timezone', type: 'varchar', isNullable: true }));
        }
    }
    async down(queryRunner) {
        const hasTimezone = await queryRunner.hasColumn('discord_user_preferences', 'timezone');
        if (hasTimezone) {
            await queryRunner.dropColumn('discord_user_preferences', 'timezone');
        }
        const hasAudit = await queryRunner.hasColumn('discord_guild_settings', 'auditLogSettings');
        if (hasAudit) {
            await queryRunner.dropColumn('discord_guild_settings', 'auditLogSettings');
        }
        const hasWelcome = await queryRunner.hasColumn('discord_guild_settings', 'welcomeSettings');
        if (hasWelcome) {
            await queryRunner.dropColumn('discord_guild_settings', 'welcomeSettings');
        }
    }
}
exports.AddWelcomeAuditTimezone1860000000000 = AddWelcomeAuditTimezone1860000000000;
//# sourceMappingURL=1860000000000-AddWelcomeAuditTimezone.js.map