import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

export class AddEmailVerificationToDeletionRequest1736190000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            logger.warn('organization_deletion_requests table does not exist, skipping migration');
            return;
        }

        // Check if columns already exist
        const hasEmailToken = table.columns.find(col => col.name === 'emailVerificationToken');
        if (hasEmailToken) {
            logger.warn('Email verification columns already exist, skipping migration');
            return;
        }

        // Add email verification token column
        await queryRunner.addColumn('organization_deletion_requests', new TableColumn({
            name: 'emailVerificationToken',
            type: 'varchar',
            length: '255',
            isNullable: true
        }));

        // Add email verified timestamp column
        await queryRunner.addColumn('organization_deletion_requests', new TableColumn({
            name: 'emailVerifiedAt',
            type: 'timestamp',
            isNullable: true
        }));

        // Check if enum type exists before attempting to add value
        const enumTypeExists = await queryRunner.query(`
            SELECT 1 FROM pg_type WHERE typname = 'organization_deletion_requests_status_enum'
        `);

        if (enumTypeExists && enumTypeExists.length > 0) {
            // Update enum to include email_verification_pending status
            await queryRunner.query(`
                ALTER TYPE "organization_deletion_requests_status_enum" 
                ADD VALUE IF NOT EXISTS 'email_verification_pending'
            `);
        } else {
            logger.warn('Enum type "organization_deletion_requests_status_enum" not found, skipping enum update');
        }

        logger.info('✅ Added email verification columns to organization_deletion_requests table');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            return;
        }

        await queryRunner.dropColumn('organization_deletion_requests', 'emailVerificationToken');
        await queryRunner.dropColumn('organization_deletion_requests', 'emailVerifiedAt');
        
        // Note: Cannot remove enum values in PostgreSQL, they would need recreation of the enum type
        logger.warn('Note: enum value "email_verification_pending" cannot be removed without recreating the enum type');
    }
}
