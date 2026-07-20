"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFocusTables1791000000000 = void 0;
class CreateFocusTables1791000000000 {
    name = 'CreateFocusTables1791000000000';
    async up(queryRunner) {
        await queryRunner.query(`SET LOCAL statement_timeout = 0`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_focus_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "primaryFocuses" text NOT NULL DEFAULT '[]',
        "secondaryFocuses" text NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_focus_preferences" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_focus_preferences_userId" ON "user_focus_preferences" ("userId")`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_focus_preferences" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "orgId" character varying NOT NULL,
        "focuses" text NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_focus_preferences" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_org_focus_preferences_orgId" ON "org_focus_preferences" ("orgId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_focus_preferences_orgId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "org_focus_preferences"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_focus_preferences_userId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "user_focus_preferences"`);
    }
}
exports.CreateFocusTables1791000000000 = CreateFocusTables1791000000000;
//# sourceMappingURL=1791000000000-CreateFocusTables.js.map