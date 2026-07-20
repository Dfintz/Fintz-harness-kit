"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrgMembershipRoleLookupIndex1864800000000 = void 0;
class AddOrgMembershipRoleLookupIndex1864800000000 {
    name = 'AddOrgMembershipRoleLookupIndex1864800000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_org_memberships_org_role_active"
      ON "organization_memberships" ("organizationId", "roleId")
      WHERE "isActive" = true
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_memberships_org_role_active"`);
    }
}
exports.AddOrgMembershipRoleLookupIndex1864800000000 = AddOrgMembershipRoleLookupIndex1864800000000;
//# sourceMappingURL=1864800000000-AddOrgMembershipRoleLookupIndex.js.map