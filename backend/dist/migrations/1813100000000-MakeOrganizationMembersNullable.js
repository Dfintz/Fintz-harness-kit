"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeOrganizationMembersNullable1813100000000 = void 0;
class MakeOrganizationMembersNullable1813100000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" SET DEFAULT ''`);
    }
    async down(queryRunner) {
        await queryRunner.query(`UPDATE "organizations" SET "members" = '' WHERE "members" IS NULL`);
        await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" SET NOT NULL`);
    }
}
exports.MakeOrganizationMembersNullable1813100000000 = MakeOrganizationMembersNullable1813100000000;
//# sourceMappingURL=1813100000000-MakeOrganizationMembersNullable.js.map