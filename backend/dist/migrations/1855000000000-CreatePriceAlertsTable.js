"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePriceAlertsTable1855000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreatePriceAlertsTable1855000000000 {
    async up(queryRunner) {
        const tableExists = await queryRunner.hasTable('price_alerts');
        if (tableExists) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'price_alerts',
            columns: [
                {
                    name: 'id',
                    type: 'varchar',
                    length: '64',
                    isPrimary: true,
                },
                {
                    name: 'userId',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'commodity',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'location',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'condition',
                    type: 'varchar',
                    length: '32',
                },
                {
                    name: 'threshold',
                    type: 'float',
                },
                {
                    name: 'enabled',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'lastTriggered',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('price_alerts', new typeorm_1.TableIndex({ name: 'IDX_price_alerts_userId', columnNames: ['userId'] }));
        await queryRunner.createIndex('price_alerts', new typeorm_1.TableIndex({ name: 'IDX_price_alerts_commodity', columnNames: ['commodity'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('price_alerts', 'IDX_price_alerts_commodity');
        await queryRunner.dropIndex('price_alerts', 'IDX_price_alerts_userId');
        await queryRunner.dropTable('price_alerts', true);
    }
}
exports.CreatePriceAlertsTable1855000000000 = CreatePriceAlertsTable1855000000000;
//# sourceMappingURL=1855000000000-CreatePriceAlertsTable.js.map