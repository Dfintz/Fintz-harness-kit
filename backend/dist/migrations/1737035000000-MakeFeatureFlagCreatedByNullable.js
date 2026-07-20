"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeFeatureFlagCreatedByNullable1737035000000 = void 0;
const logger_1 = require("../utils/logger");
class MakeFeatureFlagCreatedByNullable1737035000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('feature_flags');
        if (!table) {
            logger_1.logger.warn('feature_flags table does not exist, skipping migration');
            return;
        }
        const createdByColumn = table.findColumnByName('created_by');
        if (!createdByColumn) {
            logger_1.logger.warn('created_by column does not exist, skipping migration');
            return;
        }
        logger_1.logger.info('Making created_by column nullable in feature_flags table');
        await queryRunner.query(`
      ALTER TABLE "feature_flags" 
      ALTER COLUMN "created_by" DROP NOT NULL
    `);
        logger_1.logger.info('Successfully made created_by column nullable');
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('feature_flags');
        if (!table) {
            return;
        }
        logger_1.logger.info('Making created_by column NOT NULL in feature_flags table');
        await queryRunner.query(`
      ALTER TABLE "feature_flags" 
      ALTER COLUMN "created_by" SET NOT NULL
    `);
    }
}
exports.MakeFeatureFlagCreatedByNullable1737035000000 = MakeFeatureFlagCreatedByNullable1737035000000;
//# sourceMappingURL=1737035000000-MakeFeatureFlagCreatedByNullable.js.map