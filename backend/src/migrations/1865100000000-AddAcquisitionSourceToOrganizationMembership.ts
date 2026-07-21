import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds member-acquisition tracking to organization_memberships:
 * - acquisitionSource: how the member arrived (application / invitation / founder / …)
 * - acquisitionRefId:  the source record id (application/invitation id) when known
 * Plus a partial index for the acquisition-funnel GROUP BY over active members.
 *
 * Nullable columns: existing rows remain NULL (the "legacy/unknown" funnel bucket);
 * no backfill (historical acquisition source is unknowable).
 */
export class AddAcquisitionSourceToOrganizationMembership1865100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Raw idempotent DDL (not queryRunner.getTable/addColumn) so it does not depend
    // on the typeorm_metadata table, which is absent in production.
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "acquisitionSource" text`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "acquisitionRefId" text`
    );

    // Partial index for the acquisition funnel GROUP BY (active members only).
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_org_membership_acquisition" ` +
        `ON "organization_memberships" ("organizationId", "acquisitionSource") ` +
        `WHERE "isActive" = true`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_membership_acquisition"`);
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP COLUMN IF EXISTS "acquisitionRefId"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_memberships" DROP COLUMN IF EXISTS "acquisitionSource"`
    );
  }
}
