import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * CreateExternalCatalogRecords
 *
 * Stores normalized snapshots of external catalog data pulled from SCMDB and SC Craft.
 * This table is source-agnostic and supports dry-run/apply reconciliation workflows.
 */
export class CreateExternalCatalogRecords1864600000000 implements MigrationInterface {
  name = 'CreateExternalCatalogRecords1864600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.getTable('external_catalog_records');
    if (existing) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'external_catalog_records',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'source',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'recordType',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'externalId',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'sourceVersion',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'payloadHash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'isActive',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'firstSeenAt',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'lastSeenAt',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'lastSyncedAt',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'external_catalog_records',
      new TableIndex({
        name: 'IDX_external_catalog_records_source_record_type_external_id',
        columnNames: ['source', 'recordType', 'externalId'],
        isUnique: true,
      })
    );

    await queryRunner.createIndex(
      'external_catalog_records',
      new TableIndex({
        name: 'IDX_external_catalog_records_source_record_type_active',
        columnNames: ['source', 'recordType', 'isActive'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('external_catalog_records', true);
  }
}
