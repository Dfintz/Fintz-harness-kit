import { MigrationInterface, QueryRunner } from 'typeorm';

import { DEFAULT_GDPR_SETTINGS } from '../models/Organization';
import { logger } from '../utils/logger';

/**
 * Migration: Add GDPR Settings to Organizations
 * Adds configurable GDPR settings (deletion grace period, export link expiration) to organizations
 */
export class AddGdprSettingsToOrganizations1763500000000 implements MigrationInterface {
    
    public async up(queryRunner: QueryRunner): Promise<void> {
        // eslint-disable-next-line no-console
        logger.info('Adding GDPR settings to organizations...');

        // Check if organizations table exists
        const table = await queryRunner.getTable('organizations');
        if (!table) {
            // eslint-disable-next-line no-console
            logger.warn('organizations table does not exist, skipping migration');
            return;
        }

        // Update existing organizations to have default GDPR settings
        // This adds the gdpr property to the settings JSONB column
        await queryRunner.query(`
            UPDATE organizations
            SET settings = COALESCE(settings, '{}'::jsonb) || 
                jsonb_build_object('gdpr', jsonb_build_object(
                    'deletionGracePeriodDays', ${DEFAULT_GDPR_SETTINGS.deletionGracePeriodDays},
                    'exportLinkExpirationDays', ${DEFAULT_GDPR_SETTINGS.exportLinkExpirationDays}
                ))
            WHERE settings IS NULL OR NOT settings ? 'gdpr'
        `);

        // eslint-disable-next-line no-console
        logger.info('GDPR settings added successfully to organizations');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // eslint-disable-next-line no-console
        logger.info('Removing GDPR settings from organizations...');

        // Remove the gdpr property from settings JSONB column
        await queryRunner.query(`
            UPDATE organizations
            SET settings = settings - 'gdpr'
            WHERE settings ? 'gdpr'
        `);

        // eslint-disable-next-line no-console
        logger.info('GDPR settings removed successfully from organizations');
    }
}
