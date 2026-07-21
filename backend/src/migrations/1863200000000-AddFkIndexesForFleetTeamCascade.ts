import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add indexes on FK columns referenced by ON DELETE SET NULL cascades.
 *
 * When a Fleet is deleted, PostgreSQL must locate every row whose FK points at
 * the deleted fleet so it can apply the SET NULL action. Without an index on
 * the referencing column this requires a sequential scan of the entire child
 * table — observed as slow fleet deletions in production.
 *
 * Adds indexes on:
 *   - fleets.parentFleetId   (Fleet -> Fleet self-FK, SET NULL on parent delete)
 *   - fleets.teamId          (Fleet -> Team FK, SET NULL on team delete)
 *   - missions.fleetId       (Mission -> Fleet FK, SET NULL on fleet delete)
 *   - activities.teamId      (Activity -> Team FK, SET NULL on team delete)
 */
export class AddFkIndexesForFleetTeamCascade1863200000000 implements MigrationInterface {
  name = 'AddFkIndexesForFleetTeamCascade1863200000000';

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

  private async createIndexIfColumnExists(
    queryRunner: QueryRunner,
    indexName: string,
    tableName: string,
    desiredColumnName: string
  ): Promise<void> {
    const resolvedColumnName = await this.resolveColumnName(
      queryRunner,
      tableName,
      desiredColumnName
    );
    if (!resolvedColumnName) {
      return;
    }

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)} ON ${this.quoteIdentifier(tableName)} (${this.quoteIdentifier(resolvedColumnName)})`
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createIndexIfColumnExists(
      queryRunner,
      'idx_fleet_parent',
      'fleets',
      'parentFleetId'
    );
    await this.createIndexIfColumnExists(queryRunner, 'idx_fleet_team', 'fleets', 'teamId');
    await this.createIndexIfColumnExists(queryRunner, 'idx_mission_fleet', 'missions', 'fleetId');
    await this.createIndexIfColumnExists(queryRunner, 'idx_activity_team', 'activities', 'teamId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_activity_team"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_mission_fleet"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_fleet_team"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_fleet_parent"');
  }
}
