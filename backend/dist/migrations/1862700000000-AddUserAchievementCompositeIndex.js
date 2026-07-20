"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUserAchievementCompositeIndex1862700000000 = void 0;
class AddUserAchievementCompositeIndex1862700000000 {
    name = 'AddUserAchievementCompositeIndex1862700000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_achievements_userId_isDisplayed"
        ON "user_achievements" ("userId", "isDisplayed")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_user_achievements_userId_isDisplayed"
    `);
    }
}
exports.AddUserAchievementCompositeIndex1862700000000 = AddUserAchievementCompositeIndex1862700000000;
//# sourceMappingURL=1862700000000-AddUserAchievementCompositeIndex.js.map