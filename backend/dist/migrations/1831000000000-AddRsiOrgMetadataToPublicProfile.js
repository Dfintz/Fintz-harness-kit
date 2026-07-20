"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRsiOrgMetadataToPublicProfile1831000000000 = void 0;
class AddRsiOrgMetadataToPublicProfile1831000000000 {
    name = 'AddRsiOrgMetadataToPublicProfile1831000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiArchetype" varchar(100)`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiCommitment" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiRolePlay" boolean`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiExclusive" boolean`);
        await queryRunner.query(`ALTER TABLE "rsi_crawled_organizations" ADD COLUMN IF NOT EXISTS "exclusive" text`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiExclusive"`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiRolePlay"`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiCommitment"`);
        await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiArchetype"`);
        await queryRunner.query(`ALTER TABLE "rsi_crawled_organizations" DROP COLUMN IF EXISTS "exclusive"`);
    }
}
exports.AddRsiOrgMetadataToPublicProfile1831000000000 = AddRsiOrgMetadataToPublicProfile1831000000000;
//# sourceMappingURL=1831000000000-AddRsiOrgMetadataToPublicProfile.js.map