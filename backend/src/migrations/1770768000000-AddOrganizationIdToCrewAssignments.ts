import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

export class AddOrganizationIdToCrewAssignments1770768000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('crew_assignments');
    if (!table) {
      logger.warn('crew_assignments table not found — skipping migration');
      return;
    }

    // Add organizationId column if not exists
    const orgCol = table.findColumnByName('organizationId');
    if (!orgCol) {
      await queryRunner.addColumn(
        'crew_assignments',
        new TableColumn({
          name: 'organizationId',
          type: 'varchar',
          isNullable: true, // Allow null initially for existing rows
        })
      );
    }

    // Make missionId nullable if it isn't already
    const missionCol = table.findColumnByName('missionId');
    if (missionCol && !missionCol.isNullable) {
      await queryRunner.changeColumn(
        'crew_assignments',
        'missionId',
        new TableColumn({
          name: 'missionId',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    // Add indexes
    const existingIndexes = new Set(table.indices.map(i => i.name));
    if (!existingIndexes.has('idx_crew_assignment_org')) {
      await queryRunner.createIndex(
        'crew_assignments',
        new TableIndex({
          name: 'idx_crew_assignment_org',
          columnNames: ['organizationId'],
        })
      );
    }
    if (!existingIndexes.has('idx_crew_assignment_ship')) {
      await queryRunner.createIndex(
        'crew_assignments',
        new TableIndex({
          name: 'idx_crew_assignment_ship',
          columnNames: ['shipId'],
        })
      );
    }

    logger.info('Migration: Added organizationId to crew_assignments');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('crew_assignments');
    if (!table) {
      return;
    }

    const orgIndex = table.indices.find(i => i.name === 'idx_crew_assignment_org');
    if (orgIndex) {
      await queryRunner.dropIndex('crew_assignments', orgIndex);
    }

    const shipIndex = table.indices.find(i => i.name === 'idx_crew_assignment_ship');
    if (shipIndex) {
      await queryRunner.dropIndex('crew_assignments', shipIndex);
    }

    const orgCol = table.findColumnByName('organizationId');
    if (orgCol) {
      await queryRunner.dropColumn('crew_assignments', 'organizationId');
    }

    logger.info('Migration: Reverted organizationId from crew_assignments');
  }
}
