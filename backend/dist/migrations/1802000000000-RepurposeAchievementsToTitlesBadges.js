"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepurposeAchievementsToTitlesBadges1802000000000 = void 0;
class RepurposeAchievementsToTitlesBadges1802000000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD COLUMN "type" varchar NOT NULL DEFAULT 'badge'`);
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD COLUMN "federationId" uuid`);
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD COLUMN "metadata" jsonb`);
        await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "points"`);
        await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "criteria"`);
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD CONSTRAINT "FK_achievements_federationId"
         FOREIGN KEY ("federationId") REFERENCES "federations"("id")
         ON DELETE CASCADE`);
        await queryRunner.query(`CREATE INDEX "IDX_achievements_type" ON "achievements" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_achievements_federationId" ON "achievements" ("federationId")`);
        await queryRunner.query(`ALTER TABLE "user_achievements"
         ADD COLUMN "isDisplayed" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user_achievements"
         ADD COLUMN "displaySlot" int`);
        await queryRunner.query(`ALTER TABLE "federations"
         ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "federations" DROP COLUMN IF EXISTS "settings"`);
        await queryRunner.query(`ALTER TABLE "user_achievements" DROP COLUMN IF EXISTS "displaySlot"`);
        await queryRunner.query(`ALTER TABLE "user_achievements" DROP COLUMN IF EXISTS "isDisplayed"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_achievements_federationId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_achievements_type"`);
        await queryRunner.query(`ALTER TABLE "achievements"
         DROP CONSTRAINT IF EXISTS "FK_achievements_federationId"`);
        await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "metadata"`);
        await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "federationId"`);
        await queryRunner.query(`ALTER TABLE "achievements" DROP COLUMN IF EXISTS "type"`);
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD COLUMN "points" int NOT NULL DEFAULT 10`);
        await queryRunner.query(`ALTER TABLE "achievements"
         ADD COLUMN "criteria" text`);
    }
}
exports.RepurposeAchievementsToTitlesBadges1802000000000 = RepurposeAchievementsToTitlesBadges1802000000000;
//# sourceMappingURL=1802000000000-RepurposeAchievementsToTitlesBadges.js.map