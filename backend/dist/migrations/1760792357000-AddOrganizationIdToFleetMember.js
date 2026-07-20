"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationIdToFleetMember1760792357000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddOrganizationIdToFleetMember1760792357000 {
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND LOWER(column_name) = LOWER($2)
             ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
             LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        logger_1.logger.info('Adding multi-tenancy to fleet_members table (DEV MODE)...');
        const table = await queryRunner.getTable('fleet_members');
        if (!table) {
            logger_1.logger.warn('fleet_members table does not exist, skipping migration');
            logger_1.logger.info('   (Table will be created by TypeORM synchronize or future migration)');
            return;
        }
        const orgIdColumn = await this.resolveColumnName(queryRunner, 'fleet_members', 'organizationId');
        if (orgIdColumn) {
            logger_1.logger.warn(`organizationId column already exists as ${orgIdColumn}, skipping migration`);
            return;
        }
        await queryRunner.addColumn('fleet_members', new typeorm_1.TableColumn({
            name: 'organizationId',
            type: 'varchar',
            length: '255',
            isNullable: false,
            default: "'default-org'",
        }));
        await queryRunner.addColumn('fleet_members', new typeorm_1.TableColumn({
            name: 'sharedWithOrgs',
            type: 'text',
            isNullable: true,
            isArray: true,
            default: "'{}'",
        }));
        await queryRunner.createIndex('fleet_members', new typeorm_1.TableIndex({
            name: 'idx_fleet_members_org_fleet',
            columnNames: ['organizationId', 'fleetId'],
        }));
        await queryRunner.createIndex('fleet_members', new typeorm_1.TableIndex({
            name: 'idx_fleet_members_org_user',
            columnNames: ['organizationId', 'userId'],
        }));
        await queryRunner.createIndex('fleet_members', new typeorm_1.TableIndex({
            name: 'idx_fleet_members_org_status',
            columnNames: ['organizationId', 'status'],
        }));
        await queryRunner.createIndex('fleet_members', new typeorm_1.TableIndex({
            name: 'idx_fleet_members_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createForeignKey('fleet_members', new typeorm_1.TableForeignKey({
            name: 'fk_fleet_members_organization',
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        }));
        logger_1.logger.info('✅ Fleet members table multi-tenancy added!');
    }
    async down(queryRunner) {
        logger_1.logger.info('Rolling back fleet_members multi-tenancy...');
        await queryRunner.dropForeignKey('fleet_members', 'fk_fleet_members_organization');
        await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_id');
        await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_status');
        await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_user');
        await queryRunner.dropIndex('fleet_members', 'idx_fleet_members_org_fleet');
        await queryRunner.dropColumn('fleet_members', 'sharedWithOrgs');
        await queryRunner.dropColumn('fleet_members', 'organizationId');
        logger_1.logger.info('✅ Rollback complete!');
    }
}
exports.AddOrganizationIdToFleetMember1760792357000 = AddOrganizationIdToFleetMember1760792357000;
//# sourceMappingURL=1760792357000-AddOrganizationIdToFleetMember.js.map