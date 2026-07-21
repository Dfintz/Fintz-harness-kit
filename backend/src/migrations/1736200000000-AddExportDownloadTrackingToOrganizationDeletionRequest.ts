import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

export class AddExportDownloadTrackingToOrganizationDeletionRequest1736200000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('organization_deletion_requests');
        
        if (!table) {
            logger.warn('organization_deletion_requests table does not exist, skipping migration');
            return;
        }

        // Check if columns already exist
        const hasDownloadCount = table.findColumnByName('exportDownloadCount');
        const hasLastDownloadedAt = table.findColumnByName('exportLastDownloadedAt');

        if (!hasDownloadCount) {
            await queryRunner.addColumn(
                'organization_deletion_requests',
                new TableColumn({
                    name: 'exportDownloadCount',
                    type: 'integer',
                    default: 0,
                    isNullable: false
                })
            );
            logger.info('✅ Added exportDownloadCount column');
        } else {
            logger.warn('exportDownloadCount column already exists');
        }

        if (!hasLastDownloadedAt) {
            await queryRunner.addColumn(
                'organization_deletion_requests',
                new TableColumn({
                    name: 'exportLastDownloadedAt',
                    type: 'timestamp',
                    isNullable: true
                })
            );
            logger.info('✅ Added exportLastDownloadedAt column');
        } else {
            logger.warn('exportLastDownloadedAt column already exists');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('organization_deletion_requests');
        
        if (!table) {
            return;
        }

        // Remove columns if they exist
        const hasDownloadCount = table.findColumnByName('exportDownloadCount');
        const hasLastDownloadedAt = table.findColumnByName('exportLastDownloadedAt');

        if (hasLastDownloadedAt) {
            await queryRunner.dropColumn('organization_deletion_requests', 'exportLastDownloadedAt');
        }

        if (hasDownloadCount) {
            await queryRunner.dropColumn('organization_deletion_requests', 'exportDownloadCount');
        }
    }
}
