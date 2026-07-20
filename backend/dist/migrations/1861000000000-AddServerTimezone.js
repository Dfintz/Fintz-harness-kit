"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddServerTimezone1861000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddServerTimezone1861000000000 {
    async up(queryRunner) {
        const has = await queryRunner.hasColumn('discord_guild_settings', 'timezone');
        if (!has) {
            await queryRunner.addColumn('discord_guild_settings', new typeorm_1.TableColumn({ name: 'timezone', type: 'varchar', isNullable: true }));
        }
    }
    async down(queryRunner) {
        const has = await queryRunner.hasColumn('discord_guild_settings', 'timezone');
        if (has) {
            await queryRunner.dropColumn('discord_guild_settings', 'timezone');
        }
    }
}
exports.AddServerTimezone1861000000000 = AddServerTimezone1861000000000;
//# sourceMappingURL=1861000000000-AddServerTimezone.js.map