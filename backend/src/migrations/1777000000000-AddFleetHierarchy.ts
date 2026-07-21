import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * AddFleetHierarchy
 *
 * Wave 2.2 — Visual Fleet Organizer
 *
 * Adds hierarchy columns to the existing `fleets` table:
 * - parentFleetId: self-referencing FK for parent/child relationships
 * - level: depth in the hierarchy tree (0 = root)
 * - sortOrder: display order among siblings
 * - hierarchyPath: materialized path for efficient subtree queries
 *
 * Existing flat fleets get level=0, no parent (backward compatible).
 */
export class AddFleetHierarchy1777000000000 implements MigrationInterface {
  name = 'AddFleetHierarchy1777000000000';

  private findColumnCaseInsensitive(table: Table, preferredName: string): TableColumn | undefined {
    return table.columns.find(column => column.name.toLowerCase() === preferredName.toLowerCase());
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('fleets');
    if (!table) {
      throw new Error('fleets table not found — cannot add hierarchy columns');
    }

    const hasParentFleetId = this.findColumnCaseInsensitive(table, 'parentFleetId');
    const hasLevel = this.findColumnCaseInsensitive(table, 'level');
    const hasSortOrder = this.findColumnCaseInsensitive(table, 'sortOrder');
    const hasHierarchyPath = this.findColumnCaseInsensitive(table, 'hierarchyPath');
    if (hasParentFleetId && hasLevel && hasSortOrder && hasHierarchyPath) {
      return;
    }

    // 1. parentFleetId — self-referencing FK
    if (!table.findColumnByName('parentFleetId')) {
      await queryRunner.addColumn(
        'fleets',
        new TableColumn({
          name: 'parentFleetId',
          type: 'varchar',
          isNullable: true,
          comment: 'Parent fleet ID for hierarchy (null = root fleet)',
        })
      );
    }

    // 2. level — depth in the tree (0 = root)
    if (!table.findColumnByName('level')) {
      await queryRunner.addColumn(
        'fleets',
        new TableColumn({
          name: 'level',
          type: 'int',
          default: 0,
          comment: 'Depth level in hierarchy (0 = root)',
        })
      );
    }

    // 3. sortOrder — sibling ordering
    if (!table.findColumnByName('sortOrder')) {
      await queryRunner.addColumn(
        'fleets',
        new TableColumn({
          name: 'sortOrder',
          type: 'int',
          default: 0,
          comment: 'Sort position among siblings',
        })
      );
    }

    // 4. hierarchyPath — materialized path
    if (!table.findColumnByName('hierarchyPath')) {
      await queryRunner.addColumn(
        'fleets',
        new TableColumn({
          name: 'hierarchyPath',
          type: 'text',
          default: `''`,
          comment: 'Materialized path for subtree queries (e.g., "rootId.parentId.thisId")',
        })
      );
    }

    // 5. Self-referencing foreign key
    const existingFK = table.foreignKeys.find(fk => fk.name === 'FK_fleet_parent');
    if (!existingFK) {
      await queryRunner.createForeignKey(
        'fleets',
        new TableForeignKey({
          name: 'FK_fleet_parent',
          columnNames: ['parentFleetId'],
          referencedTableName: 'fleets',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        })
      );
    }

    // 6. Indexes for hierarchy queries
    const indexes: { name: string; columnNames: string[] }[] = [
      { name: 'IDX_fleet_parent_id', columnNames: ['parentFleetId'] },
      { name: 'IDX_fleet_hierarchy_path', columnNames: ['hierarchyPath'] },
      {
        name: 'IDX_fleet_org_parent_sort',
        columnNames: ['organizationId', 'parentFleetId', 'sortOrder'],
      },
    ];

    for (const idx of indexes) {
      const existingIndex = table.indices.find(i => i.name === idx.name);
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
    const fk = table.foreignKeys.find(fk => fk.name === 'FK_fleet_parent');
    if (fk) {
      await queryRunner.dropForeignKey('fleets', fk);
    }

    // Drop indexes
    const indexNames = [
      'IDX_fleet_parent_id',
      'IDX_fleet_hierarchy_path',
      'IDX_fleet_org_parent_sort',
    ];
    for (const name of indexNames) {
      const idx = table.indices.find(i => i.name === name);
      if (idx) {
        await queryRunner.dropIndex('fleets', idx);
      }
    }

    // Drop columns in reverse order
    const columns = ['hierarchyPath', 'sortOrder', 'level', 'parentFleetId'];
    for (const col of columns) {
      if (table.findColumnByName(col)) {
        await queryRunner.dropColumn('fleets', col);
      }
    }
  }
}
