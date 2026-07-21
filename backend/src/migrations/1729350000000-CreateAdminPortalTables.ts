import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateAdminPortalTables1729350000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if feature_flags table already exists
        const featureFlagsTable = await queryRunner.getTable('feature_flags');
        if (featureFlagsTable) {
            logger.warn('feature_flags table already exists, skipping creation');
            return;
        }

        // Create feature_flags table
        await queryRunner.createTable(
            new Table({
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
            }),
            true
        );

        // Create indexes for feature_flags
        await queryRunner.createIndex(
            'feature_flags',
            new TableIndex({
                name: 'idx_feature_flags_status',
                columnNames: ['status'],
            })
        );

        await queryRunner.createIndex(
            'feature_flags',
            new TableIndex({
                name: 'idx_feature_flags_scope',
                columnNames: ['scope'],
            })
        );

        // Create security_events table
        await queryRunner.createTable(
            new Table({
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
            }),
            true
        );

        // Create indexes for security_events
        await queryRunner.createIndex(
            'security_events',
            new TableIndex({
                name: 'idx_security_events_timestamp',
                columnNames: ['timestamp'],
            })
        );

        await queryRunner.createIndex(
            'security_events',
            new TableIndex({
                name: 'idx_security_events_type',
                columnNames: ['type'],
            })
        );

        await queryRunner.createIndex(
            'security_events',
            new TableIndex({
                name: 'idx_security_events_severity',
                columnNames: ['severity'],
            })
        );

        await queryRunner.createIndex(
            'security_events',
            new TableIndex({
                name: 'idx_security_events_user_hash',
                columnNames: ['user_hash'],
            })
        );

        // Create composite index for common queries
        await queryRunner.createIndex(
            'security_events',
            new TableIndex({
                name: 'idx_security_events_timestamp_severity',
                columnNames: ['timestamp', 'severity'],
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop security_events table (indexes are dropped automatically)
        await queryRunner.dropTable('security_events');

        // Drop feature_flags table (indexes are dropped automatically)
        await queryRunner.dropTable('feature_flags');
    }
}
