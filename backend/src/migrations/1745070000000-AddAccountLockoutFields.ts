import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Add Account Lockout Fields to Users
 * Adds failedLoginAttempts and lockedUntil fields to implement brute-force protection
 */
export class AddAccountLockoutFields1745070000000 implements MigrationInterface {
    
    public async up(queryRunner: QueryRunner): Promise<void> {
        logger.info('Adding account lockout fields to users table...');

        // Check if columns already exist (they might be in base migration)
        const table = await queryRunner.getTable('users');
        const failedAttemptsExists = table?.findColumnByName('failedLoginAttempts');
        const lockedUntilExists = table?.findColumnByName('lockedUntil');

        // Add failedLoginAttempts column if it doesn't exist
        if (!failedAttemptsExists) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'failedLoginAttempts',
                type: 'integer',
                default: 0,
                isNullable: false
            }));
            logger.info('  Added failedLoginAttempts column');
        } else {
            logger.info('  failedLoginAttempts column already exists, skipping');
        }

        // Add lockedUntil column if it doesn't exist
        if (!lockedUntilExists) {
            await queryRunner.addColumn('users', new TableColumn({
                name: 'lockedUntil',
                type: 'timestamp',
                isNullable: true,
                default: null
            }));
            logger.info('  Added lockedUntil column');
        } else {
            logger.info('  lockedUntil column already exists, skipping');
        }

        logger.info('Account lockout fields migration completed');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        logger.info('Removing account lockout fields from users table...');

        await queryRunner.dropColumn('users', 'lockedUntil');
        await queryRunner.dropColumn('users', 'failedLoginAttempts');

        logger.info('Account lockout fields removed successfully');
    }
}
