"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExportDownloadTrackingToOrganizationDeletionRequest1736200000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddExportDownloadTrackingToOrganizationDeletionRequest1736200000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            logger_1.logger.warn('organization_deletion_requests table does not exist, skipping migration');
            return;
        }
        const hasDownloadCount = table.findColumnByName('exportDownloadCount');
        const hasLastDownloadedAt = table.findColumnByName('exportLastDownloadedAt');
        if (!hasDownloadCount) {
            await queryRunner.addColumn('organization_deletion_requests', new typeorm_1.TableColumn({
                name: 'exportDownloadCount',
                type: 'integer',
                default: 0,
                isNullable: false
            }));
            logger_1.logger.info('✅ Added exportDownloadCount column');
        }
        else {
            logger_1.logger.warn('exportDownloadCount column already exists');
        }
        if (!hasLastDownloadedAt) {
            await queryRunner.addColumn('organization_deletion_requests', new typeorm_1.TableColumn({
                name: 'exportLastDownloadedAt',
                type: 'timestamp',
                isNullable: true
            }));
            logger_1.logger.info('✅ Added exportLastDownloadedAt column');
        }
        else {
            logger_1.logger.warn('exportLastDownloadedAt column already exists');
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('organization_deletion_requests');
        if (!table) {
            return;
        }
        const hasDownloadCount = table.findColumnByName('exportDownloadCount');
        const hasLastDownloadedAt = table.findColumnByName('exportLastDownloadedAt');
        if (hasLastDownloadedAt) {
            await queryRunner.dropColumn('organization_deletion_requests', 'exportLastDownloadedAt');
        }
        if (hasDownloadCount) {
            await queryRunner.dropColumn('organization_deletion_requests', 'exportDownloadCount');
        }
    }
}
exports.AddExportDownloadTrackingToOrganizationDeletionRequest1736200000000 = AddExportDownloadTrackingToOrganizationDeletionRequest1736200000000;
//# sourceMappingURL=1736200000000-AddExportDownloadTrackingToOrganizationDeletionRequest.js.map