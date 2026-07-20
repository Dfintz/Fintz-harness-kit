"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveAvailableForOrgFromUserShips1763400100000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class RemoveAvailableForOrgFromUserShips1763400100000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('user_ships');
        if (!table) {
            logger_1.logger.warn('user_ships table does not exist, skipping migration');
            return;
        }
        const availableForOrgColumn = table.findColumnByName('availableForOrg');
        if (!availableForOrgColumn) {
            logger_1.logger.warn('availableForOrg column does not exist, skipping (may have been removed previously)');
            return;
        }
        await queryRunner.dropColumn('user_ships', 'availableForOrg');
    }
    async down(queryRunner) {
        await queryRunner.addColumn('user_ships', new typeorm_1.TableColumn({
            name: 'availableForOrg',
            type: 'boolean',
            default: false,
            isNullable: false
        }));
        await queryRunner.query(`
            UPDATE user_ships 
            SET "availableForOrg" = true 
            WHERE "sharingLevel" IN ('organization', 'alliance')
        `);
    }
}
exports.RemoveAvailableForOrgFromUserShips1763400100000 = RemoveAvailableForOrgFromUserShips1763400100000;
//# sourceMappingURL=1763400100000-RemoveAvailableForOrgFromUserShips.js.map