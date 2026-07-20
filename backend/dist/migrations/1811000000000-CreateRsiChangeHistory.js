"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiChangeHistory1811000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateRsiChangeHistory1811000000000 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_change_history',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'entityType',
                    type: 'varchar',
                    length: '20',
                },
                {
                    name: 'entityId',
                    type: 'varchar',
                    length: '255',
                },
                {
                    name: 'fieldName',
                    type: 'varchar',
                    length: '100',
                },
                {
                    name: 'oldValue',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'newValue',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'detectedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_entity" ON "rsi_change_history" ("entityType", "entityId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_entity_field" ON "rsi_change_history" ("entityType", "entityId", "fieldName")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_detected_at" ON "rsi_change_history" ("detectedAt")`);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('rsi_change_history');
    }
}
exports.CreateRsiChangeHistory1811000000000 = CreateRsiChangeHistory1811000000000;
//# sourceMappingURL=1811000000000-CreateRsiChangeHistory.js.map