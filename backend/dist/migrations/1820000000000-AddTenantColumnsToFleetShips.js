"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTenantColumnsToFleetShips1820000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddTenantColumnsToFleetShips1820000000000 {
    name = 'AddTenantColumnsToFleetShips1820000000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('fleet_ships');
        if (!table) {
            return;
        }
        const hasDeletedAt = table.columns.some(c => c.name === 'deletedAt');
        if (!hasDeletedAt) {
            await queryRunner.addColumn('fleet_ships', new typeorm_1.TableColumn({
                name: 'deletedAt',
                type: 'timestamp',
                isNullable: true,
            }));
        }
        const hasDeletedBy = table.columns.some(c => c.name === 'deletedBy');
        if (!hasDeletedBy) {
            await queryRunner.addColumn('fleet_ships', new typeorm_1.TableColumn({
                name: 'deletedBy',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const hasSharedWithOrgs = table.columns.some(c => c.name === 'sharedWithOrgs');
        if (!hasSharedWithOrgs) {
            await queryRunner.addColumn('fleet_ships', new typeorm_1.TableColumn({
                name: 'sharedWithOrgs',
                type: 'text',
                isNullable: true,
                default: "''",
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('fleet_ships');
        if (!table) {
            return;
        }
        if (table.columns.some(c => c.name === 'sharedWithOrgs')) {
            await queryRunner.dropColumn('fleet_ships', 'sharedWithOrgs');
        }
        if (table.columns.some(c => c.name === 'deletedBy')) {
            await queryRunner.dropColumn('fleet_ships', 'deletedBy');
        }
        if (table.columns.some(c => c.name === 'deletedAt')) {
            await queryRunner.dropColumn('fleet_ships', 'deletedAt');
        }
    }
}
exports.AddTenantColumnsToFleetShips1820000000000 = AddTenantColumnsToFleetShips1820000000000;
//# sourceMappingURL=1820000000000-AddTenantColumnsToFleetShips.js.map