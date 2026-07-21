import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * AddTenantColumnsToFleetShips
 *
 * The FleetShip entity extends TenantEntity which declares `sharedWithOrgs`,
 * `deletedAt`, and `deletedBy` columns, but the original CreateFleetShipsTable
 * migration did not include them. This causes 500 errors because TypeORM's
 * @DeleteDateColumn adds an implicit `WHERE "deletedAt" IS NULL` filter that
 * fails when the column doesn't exist.
 *
 * Idempotent: guards each DDL statement to allow safe re-runs.
 */
export class AddTenantColumnsToFleetShips1820000000000 implements MigrationInterface {
  name = 'AddTenantColumnsToFleetShips1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fleet_ships');
    if (!table) {
      return;
    }

    const hasDeletedAt = table.columns.some(c => c.name === 'deletedAt');
    if (!hasDeletedAt) {
      await queryRunner.addColumn(
        'fleet_ships',
        new TableColumn({
          name: 'deletedAt',
          type: 'timestamp',
          isNullable: true,
        })
      );
    }

    const hasDeletedBy = table.columns.some(c => c.name === 'deletedBy');
    if (!hasDeletedBy) {
      await queryRunner.addColumn(
        'fleet_ships',
        new TableColumn({
          name: 'deletedBy',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    const hasSharedWithOrgs = table.columns.some(c => c.name === 'sharedWithOrgs');
    if (!hasSharedWithOrgs) {
      await queryRunner.addColumn(
        'fleet_ships',
        new TableColumn({
          name: 'sharedWithOrgs',
          type: 'text',
          isNullable: true,
          default: "''",
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fleet_ships');
    if (!table) {
      return;
    }

    if (table.columns.some(c => c.name === 'sharedWithOrgs')) {
      await queryRunner.dropColumn('fleet_ships', 'sharedWithOrgs');
    }
    if (table.columns.some(c => c.name === 'deletedBy')) {
      await queryRunner.dropColumn('fleet_ships', 'deletedBy');
    }
    if (table.columns.some(c => c.name === 'deletedAt')) {
      await queryRunner.dropColumn('fleet_ships', 'deletedAt');
    }
  }
}
