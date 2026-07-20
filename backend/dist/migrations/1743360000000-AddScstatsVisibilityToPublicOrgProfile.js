"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddScstatsVisibilityToPublicOrgProfile1743360000000 = void 0;
class AddScstatsVisibilityToPublicOrgProfile1743360000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('public_org_profiles');
        if (table && !table.findColumnByName('scstatsVisibility')) {
            await queryRunner.query(`ALTER TABLE "public_org_profiles" ADD COLUMN "scstatsVisibility" jsonb`);
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('public_org_profiles');
        if (table?.findColumnByName('scstatsVisibility')) {
            await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN "scstatsVisibility"`);
        }
    }
}
exports.AddScstatsVisibilityToPublicOrgProfile1743360000000 = AddScstatsVisibilityToPublicOrgProfile1743360000000;
//# sourceMappingURL=1743360000000-AddScstatsVisibilityToPublicOrgProfile.js.map