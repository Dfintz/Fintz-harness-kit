"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAllianceDiplomacyTable1733275300000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateAllianceDiplomacyTable1733275300000 {
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('alliance_diplomacy');
        if (existingTable) {
            logger_1.logger.warn('alliance_diplomacy table already exists, skipping creation');
            return;
        }
        const tableExists = await queryRunner.hasTable('alliance_diplomacy');
        if (tableExists) {
            logger_1.logger.info('Table alliance_diplomacy already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'alliance_diplomacy',
            columns: [
                {
                    name: 'id',
                    type: 'varchar',
                    isPrimary: true
                },
                {
                    name: 'orgId1',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'orgId2',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'allianceType',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'status',
                    type: 'varchar',
                    default: "'proposed'"
                },
                {
                    name: 'proposedBy',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'approvedBy',
                    type: 'varchar',
                    isNullable: true
                },
                {
                    name: 'terms',
                    type: 'json',
                    default: "'[]'"
                },
                {
                    name: 'incidents',
                    type: 'json',
                    default: "'[]'"
                },
                {
                    name: 'startDate',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'endDate',
                    type: 'timestamp',
                    isNullable: true
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP'
                }
            ]
        }), true);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('alliance_diplomacy', true);
    }
}
exports.CreateAllianceDiplomacyTable1733275300000 = CreateAllianceDiplomacyTable1733275300000;
//# sourceMappingURL=1733275300000-CreateAllianceDiplomacyTable.js.map