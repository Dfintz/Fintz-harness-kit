"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAdminPortalTables1729350000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateAdminPortalTables1729350000000 {
    async up(queryRunner) {
        const featureFlagsTable = await queryRunner.getTable('feature_flags');
        if (featureFlagsTable) {
            logger_1.logger.warn('feature_flags table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'feature_flags',
            columns: [
                {
                    name: 'id',
                    type: 'varchar',
                    length: '100',
                    isPrimary: true,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                    default: "'disabled'",
                },
                {
                    name: 'scope',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                    default: "'global'",
                },
                {
                    name: 'rollout_percentage',
                    type: 'integer',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    default: null,
                },
                {
                    name: 'created_by',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'created_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updated_at',
                    type: 'timestamp with time zone',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('feature_flags', new typeorm_1.TableIndex({
            name: 'idx_feature_flags_status',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('feature_flags', new typeorm_1.TableIndex({
            name: 'idx_feature_flags_scope',
            columnNames: ['scope'],
        }));
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
                {
                    name: 'type',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'severity',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'user_hash',
                    type: 'varchar',
                    length: '64',
                    isNullable: true,
                },
                {
                    name: 'action',
                    type: 'text',
                    isNullable: false,
                },
                {
                    name: 'outcome',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'ip_address',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
                {
                    name: 'user_agent',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                    default: null,
                },
            ],
        }), true);
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
    }
    async down(queryRunner) {
        await queryRunner.dropTable('security_events');
        await queryRunner.dropTable('feature_flags');
    }
}
exports.CreateAdminPortalTables1729350000000 = CreateAdminPortalTables1729350000000;
//# sourceMappingURL=1729350000000-CreateAdminPortalTables.js.map