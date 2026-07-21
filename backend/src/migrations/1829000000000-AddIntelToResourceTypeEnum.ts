import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddIntelToResourceTypeEnum
 *
 * Adds 'intel' to the OrganizationPermission resource_type PostgreSQL enum.
 * Required for permission checks on intel routes (audit flags, watchlist, member profiles).
 *
 * Without this, any `requirePermission('intel', ...)` call causes a 500 because
 * PostgreSQL rejects the invalid enum value.
 */
export class AddIntelToResourceTypeEnum1829000000000 implements MigrationInterface {
  name = 'AddIntelToResourceTypeEnum1829000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum type name follows TypeORM convention: "table_column_enum"
    // Check if the value already exists before adding
    const enumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'intel'
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `);

    if (!enumExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'intel'
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enum types directly.
    // This is a no-op; the value can remain safely in the enum.
  }
}
