"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationIdToShip1760792356000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddOrganizationIdToShip1760792356000 {
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
        logger_1.logger.info('Adding multi-tenancy to ships table (DEV MODE)...', { table: 'ships' });
        const table = await queryRunner.getTable('ships');
        if (!table) {
            logger_1.logger.warn('Table does not exist, skipping migration', { table: 'ships' });
            logger_1.logger.info('Table will be created by TypeORM synchronize or future migration');
            return;
        }
        const orgIdColumn = await this.resolveColumnName(queryRunner, 'ships', 'organizationId');
        if (orgIdColumn) {
            logger_1.logger.warn('Column already exists, skipping migration', {
                table: 'ships',
                column: orgIdColumn,
            });
            return;
        }
        await queryRunner.addColumn('ships', new typeorm_1.TableColumn({
            name: 'organizationId',
            type: 'varchar',
            length: '255',
            isNullable: false,
            default: "'default-org'",
        }));
        await queryRunner.addColumn('ships', new typeorm_1.TableColumn({
            name: 'sharedWithOrgs',
            type: 'text',
            isNullable: true,
            isArray: true,
            default: "'{}'",
        }));
        await queryRunner.createIndex('ships', new typeorm_1.TableIndex({
            name: 'idx_ships_org_name',
            columnNames: ['organizationId', 'name'],
        }));
        await queryRunner.createIndex('ships', new typeorm_1.TableIndex({
            name: 'idx_ships_org_manufacturer',
            columnNames: ['organizationId', 'manufacturer'],
        }));
        await queryRunner.createIndex('ships', new typeorm_1.TableIndex({
            name: 'idx_ships_org_active',
            columnNames: ['organizationId', 'isActive'],
        }));
        await queryRunner.createIndex('ships', new typeorm_1.TableIndex({
            name: 'idx_ships_org_id',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createForeignKey('ships', new typeorm_1.TableForeignKey({
            name: 'fk_ships_organization',
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        }));
        logger_1.logger.info('Ships table multi-tenancy added successfully', { table: 'ships' });
    }
    async down(queryRunner) {
        logger_1.logger.info('Rolling back ships multi-tenancy...', { table: 'ships' });
        await queryRunner.dropForeignKey('ships', 'fk_ships_organization');
        await queryRunner.dropIndex('ships', 'idx_ships_org_id');
        await queryRunner.dropIndex('ships', 'idx_ships_org_active');
        await queryRunner.dropIndex('ships', 'idx_ships_org_manufacturer');
        await queryRunner.dropIndex('ships', 'idx_ships_org_name');
        await queryRunner.dropColumn('ships', 'sharedWithOrgs');
        await queryRunner.dropColumn('ships', 'organizationId');
        logger_1.logger.info('Rollback complete', { table: 'ships' });
    }
}
exports.AddOrganizationIdToShip1760792356000 = AddOrganizationIdToShip1760792356000;
//# sourceMappingURL=1760792356000-AddOrganizationIdToShip.js.map