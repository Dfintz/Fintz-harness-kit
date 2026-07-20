"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase2Item5NullableOrgIdReview1787000000000 = void 0;
class Phase2Item5NullableOrgIdReview1787000000000 {
    name = 'Phase2Item5NullableOrgIdReview1787000000000';
    async hasConstraint(queryRunner, tableName, constraintName) {
        const rows = await queryRunner.query(`SELECT 1
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(constraint_name) = LOWER($2)
       LIMIT 1`, [tableName, constraintName]);
        return rows.length > 0;
    }
    async up(queryRunner) {
        if ((await this.hasConstraint(queryRunner, 'crew_assignments', 'FK_crew_assignments_organizationId')) &&
            (await this.hasConstraint(queryRunner, 'announcement_templates', 'FK_announcement_templates_organizationId')) &&
            (await this.hasConstraint(queryRunner, 'roles', 'CHK_roles_orgId_or_system'))) {
            return;
        }
        await queryRunner.query(`ALTER TABLE "crew_assignments" ALTER COLUMN "organizationId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "crew_assignments" ADD CONSTRAINT "FK_crew_assignments_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "announcement_templates" ADD CONSTRAINT "FK_announcement_templates_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_ships" DROP CONSTRAINT "FK_a9d055678779c3f4fe2c5b678ef"`);
        await queryRunner.query(`ALTER TABLE "user_ships" ADD CONSTRAINT "FK_user_ships_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL`);
        await queryRunner.query(`ALTER TABLE "roles" ADD CONSTRAINT "CHK_roles_orgId_or_system" CHECK ("isSystemRole" = true OR "organizationId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "public_job_listings" ADD CONSTRAINT "CHK_pjl_orgId_when_org_owner" CHECK ("ownerType" != 'organization' OR "organizationId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "contact_requests" ADD CONSTRAINT "CHK_cr_orgId_when_org_target" CHECK ("targetType" != 'organization' OR "organizationId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "trading_routes" ADD CONSTRAINT "CHK_tr_orgId_when_org_visibility" CHECK ("visibility" != 'organization' OR "organizationId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "announcement_templates" ADD CONSTRAINT "CHK_at_orgId_or_global" CHECK ("isGlobal" = true OR "organizationId" IS NOT NULL)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcement_templates" DROP CONSTRAINT "CHK_at_orgId_or_global"`);
        await queryRunner.query(`ALTER TABLE "trading_routes" DROP CONSTRAINT "CHK_tr_orgId_when_org_visibility"`);
        await queryRunner.query(`ALTER TABLE "contact_requests" DROP CONSTRAINT "CHK_cr_orgId_when_org_target"`);
        await queryRunner.query(`ALTER TABLE "public_job_listings" DROP CONSTRAINT "CHK_pjl_orgId_when_org_owner"`);
        await queryRunner.query(`ALTER TABLE "roles" DROP CONSTRAINT "CHK_roles_orgId_or_system"`);
        await queryRunner.query(`ALTER TABLE "user_ships" DROP CONSTRAINT "FK_user_ships_organizationId"`);
        await queryRunner.query(`ALTER TABLE "user_ships" ADD CONSTRAINT "FK_a9d055678779c3f4fe2c5b678ef" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "announcement_templates" DROP CONSTRAINT "FK_announcement_templates_organizationId"`);
        await queryRunner.query(`ALTER TABLE "crew_assignments" DROP CONSTRAINT "FK_crew_assignments_organizationId"`);
        await queryRunner.query(`ALTER TABLE "crew_assignments" ALTER COLUMN "organizationId" DROP NOT NULL`);
    }
}
exports.Phase2Item5NullableOrgIdReview1787000000000 = Phase2Item5NullableOrgIdReview1787000000000;
//# sourceMappingURL=1787000000000-Phase2Item5NullableOrgIdReview.js.map