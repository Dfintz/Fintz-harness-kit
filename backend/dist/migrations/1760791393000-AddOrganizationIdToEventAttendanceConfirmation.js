"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOrganizationIdToEventAttendanceConfirmation1760791393000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddOrganizationIdToEventAttendanceConfirmation1760791393000 {
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
        logger_1.logger.info('Starting multi-tenancy migration for event_attendance_confirmations...');
        const table = await queryRunner.getTable('event_attendance_confirmations');
        if (!table) {
            logger_1.logger.warn('event_attendance_confirmations table does not exist, skipping migration');
            logger_1.logger.info('   (Table will be created by TypeORM synchronize or future migration)');
            return;
        }
        const orgIdColumn = await this.resolveColumnName(queryRunner, 'event_attendance_confirmations', 'organizationId');
        if (orgIdColumn) {
            logger_1.logger.warn(`organizationId column already exists as ${orgIdColumn}, skipping migration`);
            return;
        }
        logger_1.logger.info('Step 1: Adding organizationId column...');
        await queryRunner.addColumn('event_attendance_confirmations', new typeorm_1.TableColumn({
            name: 'organizationId',
            type: 'varchar',
            length: '255',
            isNullable: true,
        }));
        logger_1.logger.info('Step 2: Adding sharedWithOrgs column...');
        await queryRunner.addColumn('event_attendance_confirmations', new typeorm_1.TableColumn({
            name: 'sharedWithOrgs',
            type: 'text',
            isNullable: true,
            isArray: true,
            default: "'{}'",
            comment: 'Array of organization IDs this confirmation is shared with',
        }));
        logger_1.logger.info('Step 3: Migrating existing data...');
        await queryRunner.query(`
            UPDATE event_attendance_confirmations eac
            SET organizationId = a.organizationId
            FROM activities a
            WHERE eac.eventId = a.id
              AND a.organizationId IS NOT NULL
              AND eac.organizationId IS NULL
        `);
        await queryRunner.query(`
            UPDATE event_attendance_confirmations eac
            SET organizationId = u.activeOrgId
            FROM users u
            WHERE eac.userId = u.id
              AND u.activeOrgId IS NOT NULL
              AND eac.organizationId IS NULL
        `);
        await queryRunner.query(`
            INSERT INTO organizations (id, name, type, status, level, path, createdAt, updatedAt)
            VALUES (
                'default-org',
                'Default Organization',
                'root',
                'active',
                0,
                'default-org',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING
        `);
        await queryRunner.query(`
            UPDATE event_attendance_confirmations
            SET organizationId = 'default-org'
            WHERE organizationId IS NULL
        `);
        logger_1.logger.info('Step 4: Making organizationId NOT NULL...');
        await queryRunner.changeColumn('event_attendance_confirmations', 'organizationId', new typeorm_1.TableColumn({
            name: 'organizationId',
            type: 'varchar',
            length: '255',
            isNullable: false,
        }));
        logger_1.logger.info('Step 5: Creating indexes...');
        await queryRunner.createIndex('event_attendance_confirmations', new typeorm_1.TableIndex({
            name: 'idx_event_attendance_org_event',
            columnNames: ['organizationId', 'eventId'],
        }));
        await queryRunner.createIndex('event_attendance_confirmations', new typeorm_1.TableIndex({
            name: 'idx_event_attendance_org_user',
            columnNames: ['organizationId', 'userId'],
        }));
        await queryRunner.createIndex('event_attendance_confirmations', new typeorm_1.TableIndex({
            name: 'idx_event_attendance_org_status',
            columnNames: ['organizationId', 'status'],
        }));
        await queryRunner.createIndex('event_attendance_confirmations', new typeorm_1.TableIndex({
            name: 'idx_event_attendance_org_id',
            columnNames: ['organizationId'],
        }));
        logger_1.logger.info('Step 6: Adding foreign key constraint...');
        await queryRunner.createForeignKey('event_attendance_confirmations', new typeorm_1.TableForeignKey({
            name: 'fk_event_attendance_organization',
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        }));
        logger_1.logger.info('✅ Migration completed successfully!');
        logger_1.logger.info('Summary:');
        const stats = await queryRunner.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT organizationId) as orgs,
                COUNT(DISTINCT eventId) as events
            FROM event_attendance_confirmations
        `);
        logger_1.logger.info(`- Total confirmations: ${stats[0]?.total || 0}`);
        logger_1.logger.info(`- Organizations: ${stats[0]?.orgs || 0}`);
        logger_1.logger.info(`- Events tracked: ${stats[0]?.events || 0}`);
    }
    async down(queryRunner) {
        logger_1.logger.info('Rolling back multi-tenancy migration for event_attendance_confirmations...');
        logger_1.logger.info('Removing foreign key constraint...');
        await queryRunner.dropForeignKey('event_attendance_confirmations', 'fk_event_attendance_organization');
        logger_1.logger.info('Removing indexes...');
        await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_id');
        await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_status');
        await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_user');
        await queryRunner.dropIndex('event_attendance_confirmations', 'idx_event_attendance_org_event');
        logger_1.logger.info('Removing columns...');
        await queryRunner.dropColumn('event_attendance_confirmations', 'sharedWithOrgs');
        await queryRunner.dropColumn('event_attendance_confirmations', 'organizationId');
        logger_1.logger.info('✅ Rollback completed successfully!');
    }
}
exports.AddOrganizationIdToEventAttendanceConfirmation1760791393000 = AddOrganizationIdToEventAttendanceConfirmation1760791393000;
//# sourceMappingURL=1760791393000-AddOrganizationIdToEventAttendanceConfirmation.js.map