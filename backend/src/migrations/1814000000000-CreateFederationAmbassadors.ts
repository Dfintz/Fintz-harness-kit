import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * CreateFederationAmbassadors
 *
 * Federation Phase 1 — Ambassador System
 *
 * Creates the `federation_ambassadors` table which links users to federations
 * as appointed representatives of their member organizations.
 *
 * Includes:
 *   - Foreign key to federations (CASCADE delete)
 *   - Unique constraint on (federationId, userId)
 *   - Indexes on federationId, organizationId, userId
 *
 * Idempotent: guards DDL statements to allow safe re-runs.
 */
export class CreateFederationAmbassadors1814000000000 implements MigrationInterface {
  name = 'CreateFederationAmbassadors1814000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('federation_ambassadors');
    if (!table) {
      await queryRunner.createTable(
        new Table({
          name: 'federation_ambassadors',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'federationId', type: 'uuid', isNullable: false },
            { name: 'organizationId', type: 'varchar', isNullable: false },
            { name: 'organizationName', type: 'varchar', length: '200', isNullable: false },
            { name: 'userId', type: 'varchar', isNullable: false },
            { name: 'userName', type: 'varchar', length: '200', isNullable: false },
            {
              name: 'role',
              type: 'varchar',
              length: '20',
              isNullable: false,
              default: "'representative'",
            },
            {
              name: 'permissions',
              type: 'jsonb',
              isNullable: false,
              default: '\'["view"]\'',
            },
            {
              name: 'isActive',
              type: 'boolean',
              isNullable: false,
              default: true,
            },
            {
              name: 'title',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            {
              name: 'appointedAt',
              type: 'timestamptz',
              isNullable: false,
              default: 'now()',
            },
          ],
        }),
        true
      );

      // Foreign key: federationId → federations.id
      await queryRunner.createForeignKey(
        'federation_ambassadors',
        new TableForeignKey({
          name: 'FK_fed_ambassador_federation',
          columnNames: ['federationId'],
          referencedTableName: 'federations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      // Indexes
      await queryRunner.createIndex(
        'federation_ambassadors',
        new TableIndex({
          name: 'idx_fed_amb_federation',
          columnNames: ['federationId'],
        })
      );

      await queryRunner.createIndex(
        'federation_ambassadors',
        new TableIndex({
          name: 'idx_fed_amb_org',
          columnNames: ['organizationId'],
        })
      );

      await queryRunner.createIndex(
        'federation_ambassadors',
        new TableIndex({
          name: 'idx_fed_amb_user',
          columnNames: ['userId'],
        })
      );

      // Unique: one user per federation
      await queryRunner.createIndex(
        'federation_ambassadors',
        new TableIndex({
          name: 'idx_fed_amb_unique',
          columnNames: ['federationId', 'userId'],
          isUnique: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('federation_ambassadors');
    if (table) {
      await queryRunner.dropTable('federation_ambassadors');
    }
  }
}
