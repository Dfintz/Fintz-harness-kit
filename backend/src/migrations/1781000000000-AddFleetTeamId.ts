import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * AddFleetTeamId
 *
 * Phase 1.2 — Cross-Domain Entity Linking
 *
 * Adds a `teamId` column to the `fleets` table so that fleets
 * can be directly assigned to a team/squad rather than relying on
 * member-based inference in the aggregator layer.
 *
 * The column is nullable — existing fleets remain unlinked (backward compatible).
 */
export class AddFleetTeamId1781000000000 implements MigrationInterface {
  name = 'AddFleetTeamId1781000000000';

  private findColumnCaseInsensitive(table: Table, preferredName: string): TableColumn | undefined {
    return table.columns.find(column => column.name.toLowerCase() === preferredName.toLowerCase());
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fleets');
    if (!table) {
      throw new Error('fleets table not found — cannot add teamId column');
    }

    const teamIdColumn = this.findColumnCaseInsensitive(table, 'teamId');
    const organizationIdColumn = this.findColumnCaseInsensitive(table, 'organizationId');
    if (teamIdColumn && organizationIdColumn) {
      return;
    }

    // 1. teamId column
    if (!table.findColumnByName('teamId')) {
      await queryRunner.addColumn(
        'fleets',
        new TableColumn({
          name: 'teamId',
          type: 'uuid',
          isNullable: true,
          comment: 'Optional team/squad this fleet is assigned to',
        })
      );
    }

    // 2. Foreign key to teams table
    const existingFK = table.foreignKeys.find((fk: TableForeignKey) => fk.name === 'FK_fleet_team');
    if (!existingFK) {
      await queryRunner.createForeignKey(
        'fleets',
        new TableForeignKey({
          name: 'FK_fleet_team',
          columnNames: ['teamId'],
          referencedTableName: 'teams',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        })
      );
    }

    // 3. Indexes for team-based queries
    const indexes: { name: string; columnNames: string[] }[] = [
      { name: 'IDX_fleet_team_id', columnNames: ['teamId'] },
      { name: 'IDX_fleet_org_team', columnNames: ['organizationId', 'teamId'] },
    ];

    for (const idx of indexes) {
      const existingIndex = table.indices.find((i: TableIndex) => i.name === idx.name);
      if (!existingIndex) {
        await queryRunner.createIndex(
          'fleets',
          new TableIndex({ name: idx.name, columnNames: idx.columnNames })
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fleets');
    if (!table) {
      return;
    }

    // Drop FK first
    const fk = table.foreignKeys.find((fk: TableForeignKey) => fk.name === 'FK_fleet_team');
    if (fk) {
      await queryRunner.dropForeignKey('fleets', fk);
    }

    // Drop indexes
    const indexNames = ['IDX_fleet_team_id', 'IDX_fleet_org_team'];
    for (const name of indexNames) {
      const idx = table.indices.find((i: TableIndex) => i.name === name);
      if (idx) {
        await queryRunner.dropIndex('fleets', idx);
      }
    }

    // Drop column
    if (table.findColumnByName('teamId')) {
      await queryRunner.dropColumn('fleets', 'teamId');
    }
  }
}
