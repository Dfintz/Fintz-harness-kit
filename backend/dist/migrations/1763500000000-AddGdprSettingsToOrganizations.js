"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGdprSettingsToOrganizations1763500000000 = void 0;
const Organization_1 = require("../models/Organization");
const logger_1 = require("../utils/logger");
class AddGdprSettingsToOrganizations1763500000000 {
    async up(queryRunner) {
        logger_1.logger.info('Adding GDPR settings to organizations...');
        const table = await queryRunner.getTable('organizations');
        if (!table) {
            logger_1.logger.warn('organizations table does not exist, skipping migration');
            return;
        }
        await queryRunner.query(`
            UPDATE organizations
            SET settings = COALESCE(settings, '{}'::jsonb) || 
                jsonb_build_object('gdpr', jsonb_build_object(
                    'deletionGracePeriodDays', ${Organization_1.DEFAULT_GDPR_SETTINGS.deletionGracePeriodDays},
                    'exportLinkExpirationDays', ${Organization_1.DEFAULT_GDPR_SETTINGS.exportLinkExpirationDays}
                ))
            WHERE settings IS NULL OR NOT settings ? 'gdpr'
        `);
        logger_1.logger.info('GDPR settings added successfully to organizations');
    }
    async down(queryRunner) {
        logger_1.logger.info('Removing GDPR settings from organizations...');
        await queryRunner.query(`
            UPDATE organizations
            SET settings = settings - 'gdpr'
            WHERE settings ? 'gdpr'
        `);
        logger_1.logger.info('GDPR settings removed successfully from organizations');
    }
}
exports.AddGdprSettingsToOrganizations1763500000000 = AddGdprSettingsToOrganizations1763500000000;
//# sourceMappingURL=1763500000000-AddGdprSettingsToOrganizations.js.map