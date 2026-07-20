"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMissionSourceReference20260715100000 = void 0;
class AddMissionSourceReference20260715100000 {
    name = 'AddMissionSourceReference20260715100000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "missions"
      ADD COLUMN IF NOT EXISTS "sourceReference" character varying(255)
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_mission_org_source_ref_unique"
      ON "missions" ("organizationId", "sourceReference")
      WHERE "sourceReference" IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_mission_org_source_ref_unique"
    `);
        await queryRunner.query(`
      ALTER TABLE "missions"
      DROP COLUMN IF EXISTS "sourceReference"
    `);
    }
}
exports.AddMissionSourceReference20260715100000 = AddMissionSourceReference20260715100000;
//# sourceMappingURL=20260715100000-AddMissionSourceReference.js.map