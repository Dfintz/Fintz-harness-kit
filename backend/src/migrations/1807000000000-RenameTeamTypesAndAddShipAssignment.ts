import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Migration: Rename team types and add ship/division assignment columns.
 *
 * 1. Renames TeamType values: 'squad' → 'squadron', 'flight' → 'crew'
 * 2. Updates the column default from 'squad' to 'squadron'
 * 3. Adds assignedShipId — links a team to a ship for auto-nesting
 * 4. Adds assignedDivisionId — links a team to a division for function grouping
 *
 * This enables:
 * - Squadrons stationed on capitals auto-nest under the capital's crew team
 * - Platoons assigned to dropships auto-nest under the transport's crew
 * - Fleet function-based grouping (mining fleet → T&I Division, etc.)
 */
export class RenameTeamTypesAndAddShipAssignment1807000000000 implements MigrationInterface {
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [tableName, desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    return table?.indices.some(index => index.name === indexName) ?? false;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const typeColumnName = await this.resolveColumnName(queryRunner, 'teams', 'type');
    if (!typeColumnName) {
      return;
    }

    const organizationColumnName = await this.resolveColumnName(
      queryRunner,
      'teams',
      'organizationId'
    );

    // Phase 1: Rename existing data values
    await queryRunner.query(
      `UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'squadron' WHERE ${this.quoteIdentifier(typeColumnName)} = 'squad'`
    );
    await queryRunner.query(
      `UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'crew' WHERE ${this.quoteIdentifier(typeColumnName)} = 'flight'`
    );

    // Phase 2: Update column default
    await queryRunner.query(
      `ALTER TABLE "teams" ALTER COLUMN ${this.quoteIdentifier(typeColumnName)} SET DEFAULT 'squadron'`
    );

    // Phase 3: Add assignedShipId column
    let assignedShipColumnName = await this.resolveColumnName(
      queryRunner,
      'teams',
      'assignedShipId'
    );
    if (!assignedShipColumnName) {
      await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "assignedShipId" varchar`);
      assignedShipColumnName = 'assignedShipId';
    }

    // Phase 4: Add assignedDivisionId column
    let assignedDivisionColumnName = await this.resolveColumnName(
      queryRunner,
      'teams',
      'assignedDivisionId'
    );
    if (!assignedDivisionColumnName) {
      await queryRunner.query(`ALTER TABLE "teams" ADD COLUMN "assignedDivisionId" uuid`);
      assignedDivisionColumnName = 'assignedDivisionId';
    }

    // Phase 5: Add indexes for efficient lookups
    if (
      organizationColumnName &&
      !(await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_ship'))
    ) {
      await queryRunner.createIndex(
        'teams',
        new TableIndex({
          name: 'IDX_team_assigned_ship',
          columnNames: [organizationColumnName, assignedShipColumnName],
        })
      );
    }

    if (
      organizationColumnName &&
      !(await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_division'))
    ) {
      await queryRunner.createIndex(
        'teams',
        new TableIndex({
          name: 'IDX_team_assigned_division',
          columnNames: [organizationColumnName, assignedDivisionColumnName],
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const typeColumnName = await this.resolveColumnName(queryRunner, 'teams', 'type');

    // Drop indexes
    if (await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_division')) {
      await queryRunner.dropIndex('teams', 'IDX_team_assigned_division');
    }
    if (await this.hasIndex(queryRunner, 'teams', 'IDX_team_assigned_ship')) {
      await queryRunner.dropIndex('teams', 'IDX_team_assigned_ship');
    }

    // Drop columns
    const assignedDivisionColumnName = await this.resolveColumnName(
      queryRunner,
      'teams',
      'assignedDivisionId'
    );
    if (assignedDivisionColumnName) {
      await queryRunner.dropColumn('teams', assignedDivisionColumnName);
    }
    const assignedShipColumnName = await this.resolveColumnName(
      queryRunner,
      'teams',
      'assignedShipId'
    );
    if (assignedShipColumnName) {
      await queryRunner.dropColumn('teams', assignedShipColumnName);
    }

    // Revert column default
    if (typeColumnName) {
      await queryRunner.query(
        `ALTER TABLE "teams" ALTER COLUMN ${this.quoteIdentifier(typeColumnName)} SET DEFAULT 'squad'`
      );

      // Revert data values
      await queryRunner.query(
        `UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'flight' WHERE ${this.quoteIdentifier(typeColumnName)} = 'crew'`
      );
      await queryRunner.query(
        `UPDATE teams SET ${this.quoteIdentifier(typeColumnName)} = 'squad' WHERE ${this.quoteIdentifier(typeColumnName)} = 'squadron'`
      );
    }
  }
}
