"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUserProfileVisibilityIndex1849000000000 = void 0;
class AddUserProfileVisibilityIndex1849000000000 {
    name = 'AddUserProfileVisibilityIndex1849000000000';
    async up(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL;
    `);
    }
    async down(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility;`);
    }
}
exports.AddUserProfileVisibilityIndex1849000000000 = AddUserProfileVisibilityIndex1849000000000;
//# sourceMappingURL=1849000000000-AddUserProfileVisibilityIndex.js.map