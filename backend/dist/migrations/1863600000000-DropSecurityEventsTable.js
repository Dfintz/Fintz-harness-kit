"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropSecurityEventsTable1863600000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class DropSecurityEventsTable1863600000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('security_events');
        if (!table) {
            logger_1.logger.warn('security_events table does not exist, skipping drop');
            return;
        }
        await queryRunner.dropTable('security_events');
    }
    async down(queryRunner) {
        const existing = await queryRunner.getTable('security_events');
        if (existing) {
            logger_1.logger.warn('security_events table already exists, skipping recreate');
            return;
        }
        logger_1.logger.info('Recreating security_events table (migration rollback)');
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'security_events',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'timestamp',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                { name: 'type', type: 'varchar', length: '100', isNullable: false },
                { name: 'severity', type: 'varchar', length: '50', isNullable: false },
                { name: 'user_hash', type: 'varchar', length: '64', isNullable: true },
                { name: 'action', type: 'text', isNullable: false },
                { name: 'outcome', type: 'varchar', length: '50', isNullable: false },
                { name: 'ip_address', type: 'varchar', length: '50', isNullable: true },
                { name: 'user_agent', type: 'text', isNullable: true },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    default: null,
                },
            ],
        }), true);
        logger_1.logger.info('Created security_events table; creating indexes');
        await queryRunner.createIndex('security_events', new typeorm_1.TableIndex({
            name: 'idx_security_events_timestamp',
            columnNames: ['timestamp'],
        }));
        await queryRunner.createIndex('security_events', new typeorm_1.TableIndex({
            name: 'idx_security_events_type',
            columnNames: ['type'],
        }));
        await queryRunner.createIndex('security_events', new typeorm_1.TableIndex({
            name: 'idx_security_events_severity',
            columnNames: ['severity'],
        }));
        await queryRunner.createIndex('security_events', new typeorm_1.TableIndex({
            name: 'idx_security_events_user_hash',
            columnNames: ['user_hash'],
        }));
        await queryRunner.createIndex('security_events', new typeorm_1.TableIndex({
            name: 'idx_security_events_timestamp_severity',
            columnNames: ['timestamp', 'severity'],
        }));
        logger_1.logger.info('Created 5 security_events indexes (rollback complete)');
    }
}
exports.DropSecurityEventsTable1863600000000 = DropSecurityEventsTable1863600000000;
//# sourceMappingURL=1863600000000-DropSecurityEventsTable.js.map