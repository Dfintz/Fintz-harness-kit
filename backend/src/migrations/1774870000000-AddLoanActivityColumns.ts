import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * AddLoanActivityColumns
 *
 * Adds activityId, organizationId, scope, purpose, shipName, and activityName
 * columns to the ship_loans table to support:
 * - Linking loans to activities/missions/jobs
 * - Tenant scoping for multi-org isolation
 * - Tracking loan scope (organization/alliance)
 *
 * Idempotent: checks column existence before adding.
 */
export class AddLoanActivityColumns1774870000000 implements MigrationInterface {
  name = 'AddLoanActivityColumns1774870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ship_loans');
    if (!table) {
      return;
    }

    const columnsToAdd: { name: string; type: string; isNullable: boolean }[] = [
      { name: 'shipName', type: 'varchar', isNullable: true },
      { name: 'organizationId', type: 'varchar', isNullable: true },
      { name: 'activityId', type: 'varchar', isNullable: true },
      { name: 'activityName', type: 'varchar', isNullable: true },
      { name: 'scope', type: 'varchar', isNullable: true },
      { name: 'purpose', type: 'text', isNullable: true },
    ];

    for (const col of columnsToAdd) {
      if (!table.columns.find(c => c.name === col.name)) {
        await queryRunner.addColumn(
          'ship_loans',
          new TableColumn({
            name: col.name,
            type: col.type,
            isNullable: col.isNullable,
          })
        );
      }
    }

    // Add indexes
    const indexDefs = [
      { name: 'idx_ship_loans_organization', columnNames: ['organizationId'] },
      { name: 'idx_ship_loans_activity', columnNames: ['activityId'] },
    ];

    for (const idx of indexDefs) {
      const exists = table.indices.find(i => i.name === idx.name);
      if (!exists) {
        await queryRunner.createIndex(
          'ship_loans',
          new TableIndex({ name: idx.name, columnNames: idx.columnNames })
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ship_loans');
    if (!table) {
      return;
    }

    const indexNames = ['idx_ship_loans_activity', 'idx_ship_loans_organization'];
    for (const name of indexNames) {
      if (table.indices.find(i => i.name === name)) {
        await queryRunner.dropIndex('ship_loans', name);
      }
    }

    const columnNames = [
      'purpose',
      'scope',
      'activityName',
      'activityId',
      'organizationId',
      'shipName',
    ];
    for (const col of columnNames) {
      if (table.columns.find(c => c.name === col)) {
        await queryRunner.dropColumn('ship_loans', col);
      }
    }
  }
}
