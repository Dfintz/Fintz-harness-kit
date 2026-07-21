import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddFleetArchiveColumns1801000000000 implements MigrationInterface {
  name = 'AddFleetArchiveColumns1801000000000';

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
    const isArchivedColumn = await this.resolveColumnName(queryRunner, 'fleets', 'isArchived');
    const archivedAtColumn = await this.resolveColumnName(queryRunner, 'fleets', 'archivedAt');
    const archivedByColumn = await this.resolveColumnName(queryRunner, 'fleets', 'archivedBy');
    const archiveReasonColumn = await this.resolveColumnName(
      queryRunner,
      'fleets',
      'archiveReason'
    );
    const restoredAtColumn = await this.resolveColumnName(queryRunner, 'fleets', 'restoredAt');
    const restoredByColumn = await this.resolveColumnName(queryRunner, 'fleets', 'restoredBy');

    if (
      isArchivedColumn &&
      archivedAtColumn &&
      archivedByColumn &&
      archiveReasonColumn &&
      restoredAtColumn &&
      restoredByColumn
    ) {
      return;
    }

    // Add archive columns to fleets table
    await queryRunner.addColumns('fleets', [
      new TableColumn({
        name: 'isArchived',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'archivedAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'archivedBy',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'archiveReason',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'restoredAt',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'restoredBy',
        type: 'varchar',
        isNullable: true,
      }),
    ]);

    // Add index for efficient archive queries
    await queryRunner.createIndex(
      'fleets',
      new TableIndex({
        name: 'idx_fleet_archived',
        columnNames: ['organizationId', 'isArchived'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('fleets', 'idx_fleet_archived');
    await queryRunner.dropColumns('fleets', [
      'isArchived',
      'archivedAt',
      'archivedBy',
      'archiveReason',
      'restoredAt',
      'restoredBy',
    ]);
  }
}
