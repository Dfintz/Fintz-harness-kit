import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Wave 1.8 — Event Mirroring
 *
 * Creates the mirrored_activities table for tracking event mirrors
 * across Discord servers.
 */
export class CreateMirroredActivitiesTable1775000000001 implements MigrationInterface {
  name = 'CreateMirroredActivitiesTable1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type first (skip if already exists)
    const enumExists = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'mirrored_activity_status_enum'`
    );
    if (enumExists.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "mirrored_activity_status_enum" AS ENUM ('active', 'paused', 'cancelled', 'expired')`
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'mirrored_activities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'sourceActivityId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'sourceGuildId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'sourceOrganizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'mirrorActivityId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'mirrorGuildId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'mirrorChannelId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'mirrorMessageId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'mirrorKey',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'mirrored_activity_status_enum',
            default: "'active'",
          },
          {
            name: 'syncEnabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastSyncAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
          // TenantEntity soft-delete columns
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'varchar',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create indexes (skip if they already exist)
    const existingIndexes = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'mirrored_activities'`
    );
    const indexNames = new Set(existingIndexes.map((r: { indexname: string }) => r.indexname));

    if (!indexNames.has('idx_mirrored_source')) {
      await queryRunner.createIndex(
        'mirrored_activities',
        new TableIndex({
          name: 'idx_mirrored_source',
          columnNames: ['sourceActivityId'],
        })
      );
    }

    if (!indexNames.has('idx_mirrored_mirror')) {
      await queryRunner.createIndex(
        'mirrored_activities',
        new TableIndex({
          name: 'idx_mirrored_mirror',
          columnNames: ['mirrorActivityId'],
        })
      );
    }

    if (!indexNames.has('idx_mirrored_guild')) {
      await queryRunner.createIndex(
        'mirrored_activities',
        new TableIndex({
          name: 'idx_mirrored_guild',
          columnNames: ['mirrorGuildId'],
        })
      );
    }

    if (!indexNames.has('idx_mirrored_status')) {
      await queryRunner.createIndex(
        'mirrored_activities',
        new TableIndex({
          name: 'idx_mirrored_status',
          columnNames: ['status'],
        })
      );
    }

    if (!indexNames.has('idx_mirrored_org')) {
      await queryRunner.createIndex(
        'mirrored_activities',
        new TableIndex({
          name: 'idx_mirrored_org',
          columnNames: ['organizationId'],
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('mirrored_activities', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "mirrored_activity_status_enum"`);
  }
}
