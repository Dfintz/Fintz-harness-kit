import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Fix FeatureFlag schema to match entity model
 *
 * Changes:
 * 1. Rename rollout_percentage to percentage
 * 2. Add targetOrganizations column (simple-array)
 * 3. Add targetUsers column (simple-array)
 */
export class FixFeatureFlagSchema1768300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table exists
    const table = await queryRunner.getTable('feature_flags');
    if (!table) {
      logger.warn('feature_flags table does not exist, skipping migration');
      return;
    }

    // 1. Rename rollout_percentage to percentage if it exists
    const rolloutPercentageColumn = table.findColumnByName('rollout_percentage');
    if (rolloutPercentageColumn) {
      logger.info('Renaming rollout_percentage column to percentage');
      await queryRunner.renameColumn('feature_flags', 'rollout_percentage', 'percentage');
    } else {
      // Check if percentage column already exists
      const percentageColumn = table.findColumnByName('percentage');
      if (!percentageColumn) {
        logger.info('Adding percentage column');
        await queryRunner.addColumn(
          'feature_flags',
          new TableColumn({
            name: 'percentage',
            type: 'int',
            isNullable: true,
            default: null,
          })
        );
      } else {
        logger.info('percentage column already exists');
      }
    }

    // Refetch table metadata after percentage column changes
    const updatedTable = await queryRunner.getTable('feature_flags');
    if (!updatedTable) {
      logger.error('Could not retrieve updated table metadata');
      return;
    }

    // 2. Add targetOrganizations column if it doesn't exist
    const targetOrganizationsColumn = updatedTable.findColumnByName('targetOrganizations');
    if (!targetOrganizationsColumn) {
      logger.info('Adding targetOrganizations column');
      await queryRunner.addColumn(
        'feature_flags',
        new TableColumn({
          name: 'targetOrganizations',
          type: 'text',
          isNullable: true,
          default: null,
        })
      );
    } else {
      logger.info('targetOrganizations column already exists');
    }

    // 3. Add targetUsers column if it doesn't exist
    const targetUsersColumn = updatedTable.findColumnByName('targetUsers');
    if (!targetUsersColumn) {
      logger.info('Adding targetUsers column');
      await queryRunner.addColumn(
        'feature_flags',
        new TableColumn({
          name: 'targetUsers',
          type: 'text',
          isNullable: true,
          default: null,
        })
      );
    } else {
      logger.info('targetUsers column already exists');
    }

    logger.info('FeatureFlag schema migration completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('feature_flags');
    if (!table) {
      return;
    }

    // Remove targetUsers column
    const targetUsersColumn = table.findColumnByName('targetUsers');
    if (targetUsersColumn) {
      await queryRunner.dropColumn('feature_flags', 'targetUsers');
    }

    // Remove targetOrganizations column
    const targetOrganizationsColumn = table.findColumnByName('targetOrganizations');
    if (targetOrganizationsColumn) {
      await queryRunner.dropColumn('feature_flags', 'targetOrganizations');
    }

    // Get fresh table metadata after dropping columns
    const updatedTable = await queryRunner.getTable('feature_flags');
    if (!updatedTable) {
      return;
    }

    // Check if we should rename percentage back to rollout_percentage
    // Only rename if percentage column exists and rollout_percentage doesn't
    const percentageColumn = updatedTable.findColumnByName('percentage');
    const rolloutPercentageColumn = updatedTable.findColumnByName('rollout_percentage');

    if (percentageColumn && !rolloutPercentageColumn) {
      // The original table had rollout_percentage which we renamed to percentage
      // So we should rename it back
      await queryRunner.renameColumn('feature_flags', 'percentage', 'rollout_percentage');
    } else if (percentageColumn && rolloutPercentageColumn) {
      // Both exist somehow - drop the percentage column as it was added in up()
      await queryRunner.dropColumn('feature_flags', 'percentage');
    }
    // If neither exists or only rollout_percentage exists, nothing to do
  }
}
