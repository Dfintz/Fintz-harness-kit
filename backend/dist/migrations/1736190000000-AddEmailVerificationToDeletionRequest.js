"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEmailVerificationToDeletionRequest1736190000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddEmailVerificationToDeletionRequest1736190000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            logger_1.logger.warn('organization_deletion_requests table does not exist, skipping migration');
            return;
        }
        const hasEmailToken = table.columns.find(col => col.name === 'emailVerificationToken');
        if (hasEmailToken) {
            logger_1.logger.warn('Email verification columns already exist, skipping migration');
            return;
        }
        await queryRunner.addColumn('organization_deletion_requests', new typeorm_1.TableColumn({
            name: 'emailVerificationToken',
            type: 'varchar',
            length: '255',
            isNullable: true
        }));
        await queryRunner.addColumn('organization_deletion_requests', new typeorm_1.TableColumn({
            name: 'emailVerifiedAt',
            type: 'timestamp',
            isNullable: true
        }));
        const enumTypeExists = await queryRunner.query(`
            SELECT 1 FROM pg_type WHERE typname = 'organization_deletion_requests_status_enum'
        `);
        if (enumTypeExists && enumTypeExists.length > 0) {
            await queryRunner.query(`
                ALTER TYPE "organization_deletion_requests_status_enum" 
                ADD VALUE IF NOT EXISTS 'email_verification_pending'
            `);
        }
        else {
            logger_1.logger.warn('Enum type "organization_deletion_requests_status_enum" not found, skipping enum update');
        }
        logger_1.logger.info('✅ Added email verification columns to organization_deletion_requests table');
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            return;
        }
        await queryRunner.dropColumn('organization_deletion_requests', 'emailVerificationToken');
        await queryRunner.dropColumn('organization_deletion_requests', 'emailVerifiedAt');
        logger_1.logger.warn('Note: enum value "email_verification_pending" cannot be removed without recreating the enum type');
    }
}
exports.AddEmailVerificationToDeletionRequest1736190000000 = AddEmailVerificationToDeletionRequest1736190000000;
//# sourceMappingURL=1736190000000-AddEmailVerificationToDeletionRequest.js.map