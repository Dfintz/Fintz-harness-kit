"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAcquisitionSourceToOrganizationMembership1865100000000 = void 0;
class AddAcquisitionSourceToOrganizationMembership1865100000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "acquisitionSource" text`);
        await queryRunner.query(`ALTER TABLE "organization_memberships" ADD COLUMN IF NOT EXISTS "acquisitionRefId" text`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_org_membership_acquisition" ` +
            `ON "organization_memberships" ("organizationId", "acquisitionSource") ` +
            `WHERE "isActive" = true`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_membership_acquisition"`);
        await queryRunner.query(`ALTER TABLE "organization_memberships" DROP COLUMN IF EXISTS "acquisitionRefId"`);
        await queryRunner.query(`ALTER TABLE "organization_memberships" DROP COLUMN IF EXISTS "acquisitionSource"`);
    }
}
exports.AddAcquisitionSourceToOrganizationMembership1865100000000 = AddAcquisitionSourceToOrganizationMembership1865100000000;
//# sourceMappingURL=1865100000000-AddAcquisitionSourceToOrganizationMembership.js.map