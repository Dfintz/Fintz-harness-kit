"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAccountLockoutFields1745070000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddAccountLockoutFields1745070000000 {
    async up(queryRunner) {
        logger_1.logger.info('Adding account lockout fields to users table...');
        const table = await queryRunner.getTable('users');
        const failedAttemptsExists = table?.findColumnByName('failedLoginAttempts');
        const lockedUntilExists = table?.findColumnByName('lockedUntil');
        if (!failedAttemptsExists) {
            await queryRunner.addColumn('users', new typeorm_1.TableColumn({
                name: 'failedLoginAttempts',
                type: 'integer',
                default: 0,
                isNullable: false
            }));
            logger_1.logger.info('  Added failedLoginAttempts column');
        }
        else {
            logger_1.logger.info('  failedLoginAttempts column already exists, skipping');
        }
        if (!lockedUntilExists) {
            await queryRunner.addColumn('users', new typeorm_1.TableColumn({
                name: 'lockedUntil',
                type: 'timestamp',
                isNullable: true,
                default: null
            }));
            logger_1.logger.info('  Added lockedUntil column');
        }
        else {
            logger_1.logger.info('  lockedUntil column already exists, skipping');
        }
        logger_1.logger.info('Account lockout fields migration completed');
    }
    async down(queryRunner) {
        logger_1.logger.info('Removing account lockout fields from users table...');
        await queryRunner.dropColumn('users', 'lockedUntil');
        await queryRunner.dropColumn('users', 'failedLoginAttempts');
        logger_1.logger.info('Account lockout fields removed successfully');
    }
}
exports.AddAccountLockoutFields1745070000000 = AddAccountLockoutFields1745070000000;
//# sourceMappingURL=1745070000000-AddAccountLockoutFields.js.map