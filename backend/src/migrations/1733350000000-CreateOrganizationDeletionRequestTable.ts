import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateOrganizationDeletionRequestTable1733350000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if organization_deletion_requests table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('organization_deletion_requests');
        if (existingTable) {
            logger.warn('organization_deletion_requests table already exists, skipping creation');
            return;
        }

        // Create organization_deletion_requests table
        await queryRunner.createTable(
            new Table({
                name: 'organization_deletion_requests',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                        length: '255'
                    },
                    {
                        name: 'requestedBy',
                        type: 'varchar',
                        length: '255'
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed', 'failed'],
                        default: "'pending'"
                    },
                    {
                        name: 'requestedAt',
                        type: 'timestamp'
                    },
                    {
                        name: 'approvedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'approvedBy',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'approvalNotes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'rejectedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'rejectedBy',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'rejectionReason',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'scheduledFor',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'completedAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'cancelledAt',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'cancelledBy',
                        type: 'varchar',
                        length: '255',
                        isNullable: true
                    },
                    {
                        name: 'cancellationReason',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'requestReason',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'requestIpAddress',
                        type: 'varchar',
                        length: '45',
                        isNullable: true
                    },
                    {
                        name: 'requestUserAgent',
                        type: 'varchar',
                        length: '500',
                        isNullable: true
                    },
                    {
                        name: 'failureReason',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'deleteDescendants',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'dataExportGenerated',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'exportFilePath',
                        type: 'varchar',
                        length: '500',
                        isNullable: true
                    },
                    {
                        name: 'exportDownloadToken',
                        type: 'varchar',
                        length: '1000',
                        isNullable: true
                    },
                    {
                        name: 'deletionPreview',
                        type: 'jsonb',
                        isNullable: true
                    },
                    {
                        name: 'gracePeriodDays',
                        type: 'integer',
                        default: 30
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
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            'organization_deletion_requests',
            new TableIndex({
                name: 'IDX_org_deletion_request_organization_status',
                columnNames: ['organizationId', 'status']
            })
        );

        await queryRunner.createIndex(
            'organization_deletion_requests',
            new TableIndex({
                name: 'IDX_org_deletion_request_status_scheduled',
                columnNames: ['status', 'scheduledFor']
            })
        );

        await queryRunner.createIndex(
            'organization_deletion_requests',
            new TableIndex({
                name: 'IDX_org_deletion_request_organization',
                columnNames: ['organizationId']
            })
        );

        // Create foreign key to organizations table
        await queryRunner.createForeignKey(
            'organization_deletion_requests',
            new TableForeignKey({
                name: 'FK_org_deletion_request_organization',
                columnNames: ['organizationId'],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE'
            })
        );

        // Create foreign key to users table for requestedBy
        await queryRunner.createForeignKey(
            'organization_deletion_requests',
            new TableForeignKey({
                name: 'FK_org_deletion_request_requester',
                columnNames: ['requestedBy'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL'
            })
        );

        // Create foreign key to users table for approvedBy
        await queryRunner.createForeignKey(
            'organization_deletion_requests',
            new TableForeignKey({
                name: 'FK_org_deletion_request_approver',
                columnNames: ['approvedBy'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL'
            })
        );

        // Create foreign key to users table for rejectedBy
        await queryRunner.createForeignKey(
            'organization_deletion_requests',
            new TableForeignKey({
                name: 'FK_org_deletion_request_rejector',
                columnNames: ['rejectedBy'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL'
            })
        );

        // Create foreign key to users table for cancelledBy
        await queryRunner.createForeignKey(
            'organization_deletion_requests',
            new TableForeignKey({
                name: 'FK_org_deletion_request_canceller',
                columnNames: ['cancelledBy'],
                referencedTableName: 'users',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL'
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign keys
        await queryRunner.dropForeignKey('organization_deletion_requests', 'FK_org_deletion_request_canceller');
        await queryRunner.dropForeignKey('organization_deletion_requests', 'FK_org_deletion_request_rejector');
        await queryRunner.dropForeignKey('organization_deletion_requests', 'FK_org_deletion_request_approver');
        await queryRunner.dropForeignKey('organization_deletion_requests', 'FK_org_deletion_request_requester');
        await queryRunner.dropForeignKey('organization_deletion_requests', 'FK_org_deletion_request_organization');

        // Drop indexes
        await queryRunner.dropIndex('organization_deletion_requests', 'IDX_org_deletion_request_organization');
        await queryRunner.dropIndex('organization_deletion_requests', 'IDX_org_deletion_request_status_scheduled');
        await queryRunner.dropIndex('organization_deletion_requests', 'IDX_org_deletion_request_organization_status');

        // Drop table
        await queryRunner.dropTable('organization_deletion_requests');
    }
}
