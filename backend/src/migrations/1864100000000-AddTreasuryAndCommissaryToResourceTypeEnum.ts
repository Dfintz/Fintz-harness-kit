import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddTreasuryAndCommissaryToResourceTypeEnum
 *
 * Adds 'treasury' and 'commissary' to the OrganizationPermission resource
 * PostgreSQL enum.
 *
 * Without this, permission checks for credits/commissary routes can trigger
 * PostgreSQL enum errors when filtering by resource.
 */
export class AddTreasuryAndCommissaryToResourceTypeEnum1864100000000 implements MigrationInterface {
  name = 'AddTreasuryAndCommissaryToResourceTypeEnum1864100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const treasuryExists = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = $1
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `,
      ['treasury']
    );

    if (!treasuryExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'treasury'
      `);
    }

    const commissaryExists = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = $1
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `,
      ['commissary']
    );

    if (!commissaryExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'commissary'
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
  }
}
