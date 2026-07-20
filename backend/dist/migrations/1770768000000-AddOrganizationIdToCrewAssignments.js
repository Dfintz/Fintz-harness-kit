"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationIdToCrewAssignments1770768000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddOrganizationIdToCrewAssignments1770768000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('crew_assignments');
        if (!table) {
            logger_1.logger.warn('crew_assignments table not found — skipping migration');
            return;
        }
        const orgCol = table.findColumnByName('organizationId');
        if (!orgCol) {
            await queryRunner.addColumn('crew_assignments', new typeorm_1.TableColumn({
                name: 'organizationId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const missionCol = table.findColumnByName('missionId');
        if (missionCol && !missionCol.isNullable) {
            await queryRunner.changeColumn('crew_assignments', 'missionId', new typeorm_1.TableColumn({
                name: 'missionId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const existingIndexes = new Set(table.indices.map(i => i.name));
        if (!existingIndexes.has('idx_crew_assignment_org')) {
            await queryRunner.createIndex('crew_assignments', new typeorm_1.TableIndex({
                name: 'idx_crew_assignment_org',
                columnNames: ['organizationId'],
            }));
        }
        if (!existingIndexes.has('idx_crew_assignment_ship')) {
            await queryRunner.createIndex('crew_assignments', new typeorm_1.TableIndex({
                name: 'idx_crew_assignment_ship',
                columnNames: ['shipId'],
            }));
        }
        logger_1.logger.info('Migration: Added organizationId to crew_assignments');
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('crew_assignments');
        if (!table) {
            return;
        }
        const orgIndex = table.indices.find(i => i.name === 'idx_crew_assignment_org');
        if (orgIndex) {
            await queryRunner.dropIndex('crew_assignments', orgIndex);
        }
        const shipIndex = table.indices.find(i => i.name === 'idx_crew_assignment_ship');
        if (shipIndex) {
            await queryRunner.dropIndex('crew_assignments', shipIndex);
        }
        const orgCol = table.findColumnByName('organizationId');
        if (orgCol) {
            await queryRunner.dropColumn('crew_assignments', 'organizationId');
        }
        logger_1.logger.info('Migration: Reverted organizationId from crew_assignments');
    }
}
exports.AddOrganizationIdToCrewAssignments1770768000000 = AddOrganizationIdToCrewAssignments1770768000000;
//# sourceMappingURL=1770768000000-AddOrganizationIdToCrewAssignments.js.map