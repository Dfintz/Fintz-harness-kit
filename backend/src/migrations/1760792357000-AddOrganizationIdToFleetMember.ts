import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Multi-Tenancy Support to FleetMember
 * DEV MODE: Simplified migration without data migration
 */
export class AddOrganizationIdToFleetMember1760792357000 implements MigrationInterface {
  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND LOWER(column_name) = LOWER($2)
             ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
             LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    logger.info('Adding multi-tenancy to fleet_members table (DEV MODE)...');

    // Check if table exists first
    const table = await queryRunner.getTable('fleet_members');
    if (!table) {
      logger.warn('fleet_members table does not exist, skipping migration');
      logger.info('   (Table will be created by TypeORM synchronize or future migration)');
      return;
    }

    // Check if organizationId already exists
    const orgIdColumn = await this.resolveColumnName(
      queryRunner,
      'fleet_members',
      'organizationId'
    );
    if (orgIdColumn) {
      logger.warn(`organizationId column already exists as ${orgIdColumn}, skipping migration`);
      return;
    }

    // Add organizationId column (NOT NULL for dev)
    await queryRunner.addColumn(
      'fleet_members',
      new TableColumn({
        name: 'organizationId',
        type: 'varchar',
        length: '255',
        isNullable: false,
        default: "'default-org'",
      })
    );

    // Add sharedWithOrgs column
    await queryRunner.addColumn(
      'fleet_members',
      new TableColumn({
        name: 'sharedWithOrgs',
        type: 'text',
        isNullable: true,
        isArray: true,
        default: "'{}'",
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'fleet_members',
      new TableIndex({
        name: 'idx_fleet_members_org_fleet',
        columnNames: ['organizationId', 'fleetId'],
      })
    );

    await queryRunner.createIndex(
      'fleet_members',
      new TableIndex({
        name: 'idx_fleet_members_org_user',
        columnNames: ['organizationId', 'userId'],
      })
    );

    await queryRunner.createIndex(
      'fleet_members',
      new TableIndex({
        name: 'idx_fleet_members_org_status',
        columnNames: ['organizationId', 'status'],
      })
    );

    await queryRunner.createIndex(
      'fleet_members',
      new TableIndex({
        name: 'idx_fleet_members_org_id',
        columnNames: ['organizationId'],
      })
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'fleet_members',
      new TableForeignKey({
        name: 'fk_fleet_members_organization',
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      })
    );

    logger.info('✅ Fleet members table multi-tenancy added!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('Rolling back fleet_members multi-tenancy...');

    await queryRunner.dropForeignKey('fleet_members', 'fk_fleet_members_organization');
    await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_id');
    await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_status');
    await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_user');
    await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_fleet');
    await queryRunner.dropColumn('fleet_members', 'sharedWithOrgs');
    await queryRunner.dropColumn('fleet_members', 'organizationId');

    logger.info('✅ Rollback complete!');
  }
}
