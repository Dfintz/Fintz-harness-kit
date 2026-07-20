"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddActivityQuickJoinTokenIndex1863800000000 = void 0;
class AddActivityQuickJoinTokenIndex1863800000000 {
    name = 'AddActivityQuickJoinTokenIndex1863800000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_activities_quick_join_token"
      ON "activities" (((metadata::jsonb)->>'quickJoinToken'))
      WHERE metadata IS NOT NULL AND (metadata::jsonb)->>'quickJoinToken' IS NOT NULL
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_activities_quick_join_token"
    `);
    }
}
exports.AddActivityQuickJoinTokenIndex1863800000000 = AddActivityQuickJoinTokenIndex1863800000000;
//# sourceMappingURL=1863800000000-AddActivityQuickJoinTokenIndex.js.map