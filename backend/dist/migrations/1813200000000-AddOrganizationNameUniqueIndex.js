"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationNameUniqueIndex1813200000000 = void 0;
class AddOrganizationNameUniqueIndex1813200000000 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_organizations_name_lower" ON "organizations" (LOWER("name"))`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_organizations_name_lower"`);
    }
}
exports.AddOrganizationNameUniqueIndex1813200000000 = AddOrganizationNameUniqueIndex1813200000000;
//# sourceMappingURL=1813200000000-AddOrganizationNameUniqueIndex.js.map