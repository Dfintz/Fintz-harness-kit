"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrgApplicationsTable1770900000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateOrgApplicationsTable1770900000000 {
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
        const tableExists = await queryRunner.hasTable('org_applications');
        if (tableExists) {
            const organizationIdColumn = await this.resolveColumnName(queryRunner, 'org_applications', 'organizationId');
            const applicantUserIdColumn = await this.resolveColumnName(queryRunner, 'org_applications', 'applicantUserId');
            if (organizationIdColumn && applicantUserIdColumn) {
                return;
            }
        }
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE org_application_status_enum AS ENUM ('pending','approved','rejected','withdrawn');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'org_applications',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
                { name: 'organizationId', type: 'varchar', length: '255', isNullable: false },
                { name: 'applicantUserId', type: 'varchar', length: '255', isNullable: false },
                {
                    name: 'status',
                    type: 'org_application_status_enum',
                    default: `'pending'`,
                },
                { name: 'message', type: 'text', isNullable: true },
                { name: 'reviewedBy', type: 'varchar', length: '255', isNullable: true },
                { name: 'reviewNote', type: 'text', isNullable: true },
                { name: 'reviewedAt', type: 'timestamp', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'NOW()' },
                { name: 'updatedAt', type: 'timestamp', default: 'NOW()' },
            ],
        }), true);
        await queryRunner.createIndex('org_applications', new typeorm_1.TableIndex({
            name: 'IDX_org_applications_organizationId',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('org_applications', new typeorm_1.TableIndex({
            name: 'IDX_org_applications_applicantUserId',
            columnNames: ['applicantUserId'],
        }));
        await queryRunner.createIndex('org_applications', new typeorm_1.TableIndex({
            name: 'IDX_org_applications_status',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('org_applications', new typeorm_1.TableIndex({
            name: 'IDX_org_applications_org_status',
            columnNames: ['organizationId', 'status'],
        }));
        await queryRunner.createForeignKey('org_applications', new typeorm_1.TableForeignKey({
            name: 'FK_org_applications_organization',
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
        await queryRunner.createForeignKey('org_applications', new typeorm_1.TableForeignKey({
            name: 'FK_org_applications_applicant',
            columnNames: ['applicantUserId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('org_applications', true);
        await queryRunner.query(`DROP TYPE IF EXISTS org_application_status_enum`);
    }
}
exports.CreateOrgApplicationsTable1770900000000 = CreateOrgApplicationsTable1770900000000;
//# sourceMappingURL=1770900000000-CreateOrgApplicationsTable.js.map