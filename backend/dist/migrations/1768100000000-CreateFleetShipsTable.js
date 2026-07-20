"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFleetShipsTable1768100000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateFleetShipsTable1768100000000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('fleet_ships');
        if (existingTable) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'fleet_ships',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'fleetId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'shipId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'role',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'assignedBy',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'assignedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
            ],
        }), true);
        await queryRunner.createIndex('fleet_ships', new typeorm_1.TableIndex({
            name: 'idx_fleet_ships_fleet_ship',
            columnNames: ['fleetId', 'shipId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('fleet_ships', new typeorm_1.TableIndex({
            name: 'idx_fleet_ships_fleet',
            columnNames: ['fleetId'],
        }));
        await queryRunner.createIndex('fleet_ships', new typeorm_1.TableIndex({
            name: 'idx_fleet_ships_ship',
            columnNames: ['shipId'],
        }));
        await queryRunner.createIndex('fleet_ships', new typeorm_1.TableIndex({
            name: 'idx_fleet_ships_organization',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createForeignKey('fleet_ships', new typeorm_1.TableForeignKey({
            name: 'fk_fleet_ships_fleet',
            columnNames: ['fleetId'],
            referencedTableName: 'fleets',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
        await queryRunner.createForeignKey('fleet_ships', new typeorm_1.TableForeignKey({
            name: 'fk_fleet_ships_ship',
            columnNames: ['shipId'],
            referencedTableName: 'ships',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('fleet_ships', 'fk_fleet_ships_ship');
        await queryRunner.dropForeignKey('fleet_ships', 'fk_fleet_ships_fleet');
        await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_organization');
        await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_ship');
        await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_fleet');
        await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_fleet_ship');
        await queryRunner.dropTable('fleet_ships');
    }
}
exports.CreateFleetShipsTable1768100000000 = CreateFleetShipsTable1768100000000;
//# sourceMappingURL=1768100000000-CreateFleetShipsTable.js.map