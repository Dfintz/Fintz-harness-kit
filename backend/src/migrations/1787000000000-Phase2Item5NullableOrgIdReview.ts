import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 Item 5 — Review nullable organizationId columns on 8 tables
 *
 * Part A: crew_assignments — Make organizationId NOT NULL + add FK CASCADE
 *         Entity declares `organizationId!: string` (non-null) but DB column is nullable with no FK.
 *
 * Part B: announcement_templates — Add FK CASCADE (column stays nullable for global templates)
 *         Column exists but has no referential integrity constraint.
 *
 * Part C: user_ships — Change FK from NO ACTION to SET NULL
 *         Ships belong to users, not orgs. Org deletion shouldn't block; SET NULL is correct.
 *
 * Part D: CHECK constraints — Enforce business rules at DB level
 *         5 tables have nullable organizationId where companion columns dictate when null is valid.
 */
export class Phase2Item5NullableOrgIdReview1787000000000 implements MigrationInterface {
  name = 'Phase2Item5NullableOrgIdReview1787000000000';

  private async hasConstraint(
    queryRunner: QueryRunner,
    tableName: string,
    constraintName: string
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(constraint_name) = LOWER($2)
       LIMIT 1`,
      [tableName, constraintName]
    );

    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await this.hasConstraint(
        queryRunner,
        'crew_assignments',
        'FK_crew_assignments_organizationId'
      )) &&
      (await this.hasConstraint(
        queryRunner,
        'announcement_templates',
        'FK_announcement_templates_organizationId'
      )) &&
      (await this.hasConstraint(queryRunner, 'roles', 'CHK_roles_orgId_or_system'))
    ) {
      return;
    }

    // ========================================================================
    // PART A: crew_assignments — Make NOT NULL + add FK CASCADE
    // ========================================================================
    // Entity declares `organizationId!: string` (non-null assertion) but DB has it nullable.
    // Crew assignments are always org-scoped. Table has 0 rows so safe to alter.
    await queryRunner.query(
      `ALTER TABLE "crew_assignments" ALTER COLUMN "organizationId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "crew_assignments" ADD CONSTRAINT "FK_crew_assignments_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`
    );

    // ========================================================================
    // PART B: announcement_templates — Add FK CASCADE
    // ========================================================================
    // organizationId column exists (uuid, nullable) but has no FK constraint.
    // Global templates (isGlobal=true) have null organizationId; org templates reference orgs.
    await queryRunner.query(
      `ALTER TABLE "announcement_templates" ADD CONSTRAINT "FK_announcement_templates_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`
    );

    // ========================================================================
    // PART C: user_ships — Change FK from NO ACTION to SET NULL
    // ========================================================================
    // Ships belong to users, not organizations. The organizationId column exists in DB
    // but is NOT defined in the UserShip entity. Org deletion should set null, not block.
    await queryRunner.query(
      `ALTER TABLE "user_ships" DROP CONSTRAINT "FK_a9d055678779c3f4fe2c5b678ef"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_ships" ADD CONSTRAINT "FK_user_ships_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL`
    );

    // ========================================================================
    // PART D: CHECK constraints — Enforce business rules at DB level
    // ========================================================================

    // roles: System roles (isSystemRole=true) can have null organizationId.
    // Organization roles must have an organizationId.
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "CHK_roles_orgId_or_system" CHECK ("isSystemRole" = true OR "organizationId" IS NOT NULL)`
    );

    // public_job_listings: When ownerType is 'organization', organizationId is required.
    // For 'alliance' or 'user' owner types, organizationId may be null.
    await queryRunner.query(
      `ALTER TABLE "public_job_listings" ADD CONSTRAINT "CHK_pjl_orgId_when_org_owner" CHECK ("ownerType" != 'organization' OR "organizationId" IS NOT NULL)`
    );

    // contact_requests: When targetType is 'organization', organizationId is required.
    // For 'alliance' target type, organizationId may be null.
    await queryRunner.query(
      `ALTER TABLE "contact_requests" ADD CONSTRAINT "CHK_cr_orgId_when_org_target" CHECK ("targetType" != 'organization' OR "organizationId" IS NOT NULL)`
    );

    // trading_routes: When visibility is 'organization', organizationId is required.
    // For 'public' or 'private' visibility, organizationId may be null.
    await queryRunner.query(
      `ALTER TABLE "trading_routes" ADD CONSTRAINT "CHK_tr_orgId_when_org_visibility" CHECK ("visibility" != 'organization' OR "organizationId" IS NOT NULL)`
    );

    // announcement_templates: Global templates (isGlobal=true) can have null organizationId.
    // Non-global templates must belong to an organization.
    await queryRunner.query(
      `ALTER TABLE "announcement_templates" ADD CONSTRAINT "CHK_at_orgId_or_global" CHECK ("isGlobal" = true OR "organizationId" IS NOT NULL)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========================================================================
    // PART D (reverse): Drop CHECK constraints
    // ========================================================================
    await queryRunner.query(
      `ALTER TABLE "announcement_templates" DROP CONSTRAINT "CHK_at_orgId_or_global"`
    );
    await queryRunner.query(
      `ALTER TABLE "trading_routes" DROP CONSTRAINT "CHK_tr_orgId_when_org_visibility"`
    );
    await queryRunner.query(
      `ALTER TABLE "contact_requests" DROP CONSTRAINT "CHK_cr_orgId_when_org_target"`
    );
    await queryRunner.query(
      `ALTER TABLE "public_job_listings" DROP CONSTRAINT "CHK_pjl_orgId_when_org_owner"`
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "CHK_roles_orgId_or_system"`);

    // ========================================================================
    // PART C (reverse): Restore user_ships FK as NO ACTION
    // ========================================================================
    await queryRunner.query(
      `ALTER TABLE "user_ships" DROP CONSTRAINT "FK_user_ships_organizationId"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_ships" ADD CONSTRAINT "FK_a9d055678779c3f4fe2c5b678ef" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION`
    );

    // ========================================================================
    // PART B (reverse): Drop announcement_templates FK
    // ========================================================================
    await queryRunner.query(
      `ALTER TABLE "announcement_templates" DROP CONSTRAINT "FK_announcement_templates_organizationId"`
    );

    // ========================================================================
    // PART A (reverse): Drop crew_assignments FK + make nullable again
    // ========================================================================
    await queryRunner.query(
      `ALTER TABLE "crew_assignments" DROP CONSTRAINT "FK_crew_assignments_organizationId"`
    );
    await queryRunner.query(
      `ALTER TABLE "crew_assignments" ALTER COLUMN "organizationId" DROP NOT NULL`
    );
  }
}
