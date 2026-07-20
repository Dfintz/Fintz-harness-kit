"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixFeatureFlagSchema1768300000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class FixFeatureFlagSchema1768300000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('feature_flags');
        if (!table) {
            logger_1.logger.warn('feature_flags table does not exist, skipping migration');
            return;
        }
        const rolloutPercentageColumn = table.findColumnByName('rollout_percentage');
        if (rolloutPercentageColumn) {
            logger_1.logger.info('Renaming rollout_percentage column to percentage');
            await queryRunner.renameColumn('feature_flags', 'rollout_percentage', 'percentage');
        }
        else {
            const percentageColumn = table.findColumnByName('percentage');
            if (!percentageColumn) {
                logger_1.logger.info('Adding percentage column');
                await queryRunner.addColumn('feature_flags', new typeorm_1.TableColumn({
                    name: 'percentage',
                    type: 'int',
                    isNullable: true,
                    default: null,
                }));
            }
            else {
                logger_1.logger.info('percentage column already exists');
            }
        }
        const updatedTable = await queryRunner.getTable('feature_flags');
        if (!updatedTable) {
            logger_1.logger.error('Could not retrieve updated table metadata');
            return;
        }
        const targetOrganizationsColumn = updatedTable.findColumnByName('targetOrganizations');
        if (!targetOrganizationsColumn) {
            logger_1.logger.info('Adding targetOrganizations column');
            await queryRunner.addColumn('feature_flags', new typeorm_1.TableColumn({
                name: 'targetOrganizations',
                type: 'text',
                isNullable: true,
                default: null,
            }));
        }
        else {
            logger_1.logger.info('targetOrganizations column already exists');
        }
        const targetUsersColumn = updatedTable.findColumnByName('targetUsers');
        if (!targetUsersColumn) {
            logger_1.logger.info('Adding targetUsers column');
            await queryRunner.addColumn('feature_flags', new typeorm_1.TableColumn({
                name: 'targetUsers',
                type: 'text',
                isNullable: true,
                default: null,
            }));
        }
        else {
            logger_1.logger.info('targetUsers column already exists');
        }
        logger_1.logger.info('FeatureFlag schema migration completed successfully');
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('feature_flags');
        if (!table) {
            return;
        }
        const targetUsersColumn = table.findColumnByName('targetUsers');
        if (targetUsersColumn) {
            await queryRunner.dropColumn('feature_flags', 'targetUsers');
        }
        const targetOrganizationsColumn = table.findColumnByName('targetOrganizations');
        if (targetOrganizationsColumn) {
            await queryRunner.dropColumn('feature_flags', 'targetOrganizations');
        }
        const updatedTable = await queryRunner.getTable('feature_flags');
        if (!updatedTable) {
            return;
        }
        const percentageColumn = updatedTable.findColumnByName('percentage');
        const rolloutPercentageColumn = updatedTable.findColumnByName('rollout_percentage');
        if (percentageColumn && !rolloutPercentageColumn) {
            await queryRunner.renameColumn('feature_flags', 'percentage', 'rollout_percentage');
        }
        else if (percentageColumn && rolloutPercentageColumn) {
            await queryRunner.dropColumn('feature_flags', 'percentage');
        }
    }
}
exports.FixFeatureFlagSchema1768300000000 = FixFeatureFlagSchema1768300000000;
//# sourceMappingURL=1768300000000-FixFeatureFlagSchema.js.map