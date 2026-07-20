"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixPreferencesJsonData1851000000000 = void 0;
const logger_1 = require("../utils/logger");
class FixPreferencesJsonData1851000000000 {
    name = 'FixPreferencesJsonData1851000000000';
    async up(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        const emptyResult = await queryRunner.query(`UPDATE users SET preferences = NULL WHERE preferences = ''`);
        logger_1.logger.info('Fixed empty-string preferences', {
            rowsAffected: emptyResult?.[1] ?? 0,
        });
        const malformedResult = await queryRunner.query(`UPDATE users SET preferences = NULL
       WHERE preferences IS NOT NULL
         AND LEFT(TRIM(preferences), 1) != '{'`);
        logger_1.logger.info('Fixed malformed preferences', {
            rowsAffected: malformedResult?.[1] ?? 0,
        });
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility`);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL AND preferences != '' AND LEFT(TRIM(preferences), 1) = '{';
    `);
    }
    async down(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        await queryRunner.query(`DROP INDEX IF EXISTS idx_user_profile_visibility`);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_profile_visibility
        ON users ((preferences::jsonb->'privacy'->>'profileVisibility'))
        WHERE preferences IS NOT NULL;
    `);
    }
}
exports.FixPreferencesJsonData1851000000000 = FixPreferencesJsonData1851000000000;
//# sourceMappingURL=1851000000000-FixPreferencesJsonData.js.map