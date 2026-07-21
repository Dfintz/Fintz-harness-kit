import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a partial index for active organization membership lookups by role.
 * This supports permission refresh fanout queries for role-based changes.
 */
export class AddOrgMembershipRoleLookupIndex1864800000000 implements MigrationInterface {
  name = 'AddOrgMembershipRoleLookupIndex1864800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_org_memberships_org_role_active"
      ON "organization_memberships" ("organizationId", "roleId")
      WHERE "isActive" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_memberships_org_role_active"`);
  }
}
