import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Remove deprecated availableForOrg from user_ships
 * 
 * Removes the deprecated availableForOrg boolean field now that
 * sharingLevel has been added and data migrated.
 * 
 * This is done in a separate migration to allow for:
 * 1. Safe rollback if issues are found
 * 2. Testing period with both fields present
 * 3. Gradual deployment strategy
 */
export class RemoveAvailableForOrgFromUserShips1763400100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if user_ships table exists
        const table = await queryRunner.getTable('user_ships');
        if (!table) {
            logger.warn('user_ships table does not exist, skipping migration');
            return;
        }

        // Check if column exists before dropping (may have been removed by previous migration run)
        const availableForOrgColumn = table.findColumnByName('availableForOrg');
        if (!availableForOrgColumn) {
            logger.warn('availableForOrg column does not exist, skipping (may have been removed previously)');
            return;
        }

        // Drop the deprecated availableForOrg column
        await queryRunner.dropColumn('user_ships', 'availableForOrg');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the availableForOrg column if rolling back
        await queryRunner.addColumn(
            'user_ships',
            new TableColumn({
                name: 'availableForOrg',
                type: 'boolean',
                default: false,
                isNullable: false
            })
        );

        // Migrate data back: sharingLevel='organization' or 'alliance' -> availableForOrg=true
        await queryRunner.query(`
            UPDATE user_ships 
            SET "availableForOrg" = true 
            WHERE "sharingLevel" IN ('organization', 'alliance')
        `);
    }
}
