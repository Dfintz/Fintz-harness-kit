import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

/**
 * Make ships.organizationId and activities.organizationId nullable
 *
 * Ship and Activity entities use OptionalTenantEntity which allows NULL organizationId:
 * - Ships WITHOUT organizationId (NULL) = global reference catalog from external sources
 * - Activities WITHOUT organizationId (NULL) = personal/unaffiliated events and job listings
 *
 * The columns were originally NOT NULL (inherited from TenantEntity) which prevented:
 * - Importing ships from external data sources (Erkul, shipmatrix) into the global catalog
 * - Creating personal events, freelance job listings, and service offers without an org
 */
export class MakeShipOrgIdNullable1804000000000 implements MigrationInterface {
  private readonly tables = ['ships', 'activities'];

  private findOrganizationColumnName(
    table: Awaited<ReturnType<QueryRunner['getTable']>>
  ): string | null {
    const column = table?.columns.find(c => c.name.toLowerCase() === 'organizationid');
    return column?.name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of this.tables) {
      const table = await queryRunner.getTable(tableName);
      const organizationColumnName = this.findOrganizationColumnName(table);
      if (!table || !organizationColumnName) {
        continue;
      }

      // Drop the existing foreign key first.
      const fk = table.foreignKeys.find(fkConstraint =>
        fkConstraint.columnNames.some(
          columnName => columnName.toLowerCase() === organizationColumnName.toLowerCase()
        )
      );
      if (fk) {
        await queryRunner.dropForeignKey(tableName, fk);
      }

      // Make the column nullable.
      await queryRunner.query(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${organizationColumnName}" DROP NOT NULL`
      );

      // Re-add the foreign key with nullable support.
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          columnNames: [organizationColumnName],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of this.tables) {
      const table = await queryRunner.getTable(tableName);
      const organizationColumnName = this.findOrganizationColumnName(table);
      if (!table || !organizationColumnName) {
        continue;
      }

      // Drop foreign key
      const fk = table.foreignKeys.find(fkConstraint =>
        fkConstraint.columnNames.some(
          columnName => columnName.toLowerCase() === organizationColumnName.toLowerCase()
        )
      );
      if (fk) {
        await queryRunner.dropForeignKey(tableName, fk);
      }

      // Make column NOT NULL again
      await queryRunner.query(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${organizationColumnName}" SET NOT NULL`
      );

      // Re-add non-nullable foreign key
      await queryRunner.createForeignKey(
        tableName,
        new TableForeignKey({
          columnNames: [organizationColumnName],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }
  }
}
