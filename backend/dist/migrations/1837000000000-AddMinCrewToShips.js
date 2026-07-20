"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMinCrewToShips1837000000000 = void 0;
class AddMinCrewToShips1837000000000 {
    name = 'AddMinCrewToShips1837000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "minCrew" integer`);
        await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "maxCrew" integer`);
        await queryRunner.query(`UPDATE "ships" SET "maxCrew" = "crew" WHERE "maxCrew" IS NULL AND "crew" IS NOT NULL`);
        await queryRunner.query(`UPDATE "ships" SET "minCrew" = GREATEST(1, CEIL("crew" * 0.5)) WHERE "minCrew" IS NULL AND "crew" IS NOT NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "maxCrew"`);
        await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "minCrew"`);
    }
}
exports.AddMinCrewToShips1837000000000 = AddMinCrewToShips1837000000000;
//# sourceMappingURL=1837000000000-AddMinCrewToShips.js.map