import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create scstats_csv_imports table
 *
 * Stores parsed CSV data from the SCStats desktop app exports.
 * Each user has at most one record (upserted on re-import).
 */
export class CreateSCStatsCsvImports1785000000000 implements MigrationInterface {
  name = 'CreateSCStatsCsvImports1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('scstats_csv_imports');
    if (existing) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'scstats_csv_imports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'playtimeData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'loadoutTopData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'loadoutDetailData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'purchasesData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'shipsData',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'playtimeImportedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'loadoutImportedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'purchasesImportedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'shipsImportedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'summary',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'consentGranted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'consentDate',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Unique index on userId (one record per user)
    await queryRunner.createIndex(
      'scstats_csv_imports',
      new TableIndex({
        name: 'IDX_scstats_csv_imports_userId',
        columnNames: ['userId'],
        isUnique: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('scstats_csv_imports', true);
  }
}
