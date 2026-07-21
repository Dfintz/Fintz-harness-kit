import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Multi-Tenancy Support to Ship
 * DEV MODE: Simplified migration without data migration
 */
export class AddOrganizationIdToShip1760792356000 implements MigrationInterface {
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
    logger.info('Adding multi-tenancy to ships table (DEV MODE)...', { table: 'ships' });

    // Check if table exists first
    const table = await queryRunner.getTable('ships');
    if (!table) {
      logger.warn('Table does not exist, skipping migration', { table: 'ships' });
      logger.info('Table will be created by TypeORM synchronize or future migration');
      return;
    }

    // Check if organizationId already exists
    const orgIdColumn = await this.resolveColumnName(queryRunner, 'ships', 'organizationId');
    if (orgIdColumn) {
      logger.warn('Column already exists, skipping migration', {
        table: 'ships',
        column: orgIdColumn,
      });
      return;
    }

    // Add organizationId column (NOT NULL for dev)
    await queryRunner.addColumn(
      'ships',
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
      'ships',
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
      'ships',
      new TableIndex({
        name: 'idx_ships_org_name',
        columnNames: ['organizationId', 'name'],
      })
    );

    await queryRunner.createIndex(
      'ships',
      new TableIndex({
        name: 'idx_ships_org_manufacturer',
        columnNames: ['organizationId', 'manufacturer'],
      })
    );

    await queryRunner.createIndex(
      'ships',
      new TableIndex({
        name: 'idx_ships_org_active',
        columnNames: ['organizationId', 'isActive'],
      })
    );

    await queryRunner.createIndex(
      'ships',
      new TableIndex({
        name: 'idx_ships_org_id',
        columnNames: ['organizationId'],
      })
    );

    // Add foreign key
    await queryRunner.createForeignKey(
      'ships',
      new TableForeignKey({
        name: 'fk_ships_organization',
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      })
    );

    logger.info('Ships table multi-tenancy added successfully', { table: 'ships' });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('Rolling back ships multi-tenancy...', { table: 'ships' });

    await queryRunner.dropForeignKey('ships', 'fk_ships_organization');
    await queryRunner.dropIndex('ships', 'idx_ships_org_id');
    await queryRunner.dropIndex('ships', 'idx_ships_org_active');
    await queryRunner.dropIndex('ships', 'idx_ships_org_manufacturer');
    await queryRunner.dropIndex('ships', 'idx_ships_org_name');
    await queryRunner.dropColumn('ships', 'sharedWithOrgs');
    await queryRunner.dropColumn('ships', 'organizationId');

    logger.info('Rollback complete', { table: 'ships' });
  }
}
