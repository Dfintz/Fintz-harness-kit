import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateIntelVaultTables1730000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if intel tables already exist (they're in the complete schema)
        const intelEntriesTable = await queryRunner.getTable('intel_entries');
        if (intelEntriesTable) {
            logger.warn('Intel vault tables already exist (from complete schema), skipping creation');
            return;
        }

        // Create intel_entries table
        await queryRunner.createTable(
            new Table({
                name: 'intel_entries',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true,
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                    },
                    {
                        name: 'content',
                        type: 'text',
                    },
                    {
                        name: 'classification',
                        type: 'varchar',
                        default: "'restricted'",
                    },
                    {
                        name: 'category',
                        type: 'varchar',
                        default: "'other'",
                    },
                    {
                        name: 'tags',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'location',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'eventDate',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'isArchived',
                        type: 'boolean',
                        default: false,
                    },
                    {
                        name: 'createdBy',
                        type: 'varchar',
                    },
                    {
                        name: 'updatedBy',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Create intel_officers table
        await queryRunner.createTable(
            new Table({
                name: 'intel_officers',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true,
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                    },
                    {
                        name: 'userId',
                        type: 'varchar',
                    },
                    {
                        name: 'rank',
                        type: 'varchar',
                        default: "'junior'",
                    },
                    {
                        name: 'accessLevel',
                        type: 'varchar',
                        default: "'read'",
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'specializations',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'appointedBy',
                        type: 'varchar',
                    },
                    {
                        name: 'revokedBy',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'revokedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'appointedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Create intel_audit_logs table
        await queryRunner.createTable(
            new Table({
                name: 'intel_audit_logs',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true,
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                    },
                    {
                        name: 'userId',
                        type: 'varchar',
                    },
                    {
                        name: 'intelEntryId',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'action',
                        type: 'varchar',
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'ipAddress',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'userAgent',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'severity',
                        type: 'varchar',
                        default: "'info'",
                    },
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true
        );

        // Create indexes for intel_entries
        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_organizationId',
                columnNames: ['organizationId'],
            })
        );

        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_createdBy',
                columnNames: ['createdBy'],
            })
        );

        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_classification',
                columnNames: ['classification'],
            })
        );

        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_category',
                columnNames: ['category'],
            })
        );

        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_isArchived',
                columnNames: ['isArchived'],
            })
        );

        await queryRunner.createIndex(
            'intel_entries',
            new TableIndex({
                name: 'IDX_intel_entries_createdAt',
                columnNames: ['createdAt'],
            })
        );

        // Create indexes for intel_officers
        await queryRunner.createIndex(
            'intel_officers',
            new TableIndex({
                name: 'IDX_intel_officers_org_user_unique',
                columnNames: ['organizationId', 'userId'],
                isUnique: true,
            })
        );

        await queryRunner.createIndex(
            'intel_officers',
            new TableIndex({
                name: 'IDX_intel_officers_org_rank',
                columnNames: ['organizationId', 'rank'],
            })
        );

        await queryRunner.createIndex(
            'intel_officers',
            new TableIndex({
                name: 'IDX_intel_officers_userId',
                columnNames: ['userId'],
            })
        );

        await queryRunner.createIndex(
            'intel_officers',
            new TableIndex({
                name: 'IDX_intel_officers_isActive',
                columnNames: ['isActive'],
            })
        );

        // Create indexes for intel_audit_logs
        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_organizationId',
                columnNames: ['organizationId'],
            })
        );

        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_userId',
                columnNames: ['userId'],
            })
        );

        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_intelEntryId',
                columnNames: ['intelEntryId'],
            })
        );

        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_action',
                columnNames: ['action'],
            })
        );

        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_createdAt',
                columnNames: ['createdAt'],
            })
        );

        await queryRunner.createIndex(
            'intel_audit_logs',
            new TableIndex({
                name: 'IDX_intel_audit_logs_severity',
                columnNames: ['severity'],
            })
        );

        // Create foreign keys for intel_entries
        await queryRunner.createForeignKey(
            'intel_entries',
            new TableForeignKey({
                columnNames: ['organizationId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'organizations',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_entries',
            new TableForeignKey({
                columnNames: ['createdBy'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_entries',
            new TableForeignKey({
                columnNames: ['updatedBy'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'SET NULL',
            })
        );

        // Create foreign keys for intel_officers
        await queryRunner.createForeignKey(
            'intel_officers',
            new TableForeignKey({
                columnNames: ['organizationId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'organizations',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_officers',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_officers',
            new TableForeignKey({
                columnNames: ['appointedBy'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_officers',
            new TableForeignKey({
                columnNames: ['revokedBy'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'SET NULL',
            })
        );

        // Create foreign keys for intel_audit_logs
        await queryRunner.createForeignKey(
            'intel_audit_logs',
            new TableForeignKey({
                columnNames: ['organizationId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'organizations',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_audit_logs',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
            })
        );

        await queryRunner.createForeignKey(
            'intel_audit_logs',
            new TableForeignKey({
                columnNames: ['intelEntryId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'intel_entries',
                onDelete: 'SET NULL',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tables in reverse order
        await queryRunner.dropTable('intel_audit_logs', true);
        await queryRunner.dropTable('intel_officers', true);
        await queryRunner.dropTable('intel_entries', true);
    }
}
