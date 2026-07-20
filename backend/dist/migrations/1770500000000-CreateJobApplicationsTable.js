"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateJobApplicationsTable1770500000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateJobApplicationsTable1770500000000 {
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
        const tableExists = await queryRunner.hasTable('job_applications');
        if (tableExists) {
            const jobListingColumn = await this.resolveColumnName(queryRunner, 'job_applications', 'jobListingId');
            const applicantColumn = await this.resolveColumnName(queryRunner, 'job_applications', 'applicantUserId');
            if (jobListingColumn && applicantColumn) {
                return;
            }
        }
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE job_application_status_enum AS ENUM ('pending','approved','rejected','waitlisted','withdrawn');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE job_application_type_enum AS ENUM ('crew','passenger','vehicle','general');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'job_applications',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
                { name: 'jobListingId', type: 'uuid', isNullable: false },
                { name: 'applicantUserId', type: 'varchar', length: '255', isNullable: false },
                {
                    name: 'applicationType',
                    type: 'job_application_type_enum',
                    default: `'general'`,
                },
                {
                    name: 'status',
                    type: 'job_application_status_enum',
                    default: `'pending'`,
                },
                { name: 'applicantDisplayName', type: 'varchar', length: '255' },
                { name: 'message', type: 'text', isNullable: true },
                { name: 'shipIndex', type: 'integer', isNullable: true },
                { name: 'roleIndex', type: 'integer', isNullable: true },
                { name: 'roleName', type: 'varchar', length: '100', isNullable: true },
                { name: 'shipName', type: 'varchar', length: '255', isNullable: true },
                { name: 'passengerShipIndex', type: 'integer', isNullable: true },
                { name: 'passengerRole', type: 'varchar', length: '100', isNullable: true },
                { name: 'vehicleName', type: 'varchar', length: '255', isNullable: true },
                { name: 'reviewedBy', type: 'varchar', length: '255', isNullable: true },
                { name: 'reviewNote', type: 'text', isNullable: true },
                { name: 'reviewedAt', type: 'timestamp', isNullable: true },
                { name: 'waitlistPosition', type: 'integer', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'NOW()' },
                { name: 'updatedAt', type: 'timestamp', default: 'NOW()' },
            ],
        }), true);
        await queryRunner.createIndex('job_applications', new typeorm_1.TableIndex({ name: 'IDX_job_applications_jobListingId', columnNames: ['jobListingId'] }));
        await queryRunner.createIndex('job_applications', new typeorm_1.TableIndex({
            name: 'IDX_job_applications_applicantUserId',
            columnNames: ['applicantUserId'],
        }));
        await queryRunner.createIndex('job_applications', new typeorm_1.TableIndex({ name: 'IDX_job_applications_status', columnNames: ['status'] }));
        await queryRunner.createIndex('job_applications', new typeorm_1.TableIndex({
            name: 'IDX_job_applications_applicationType',
            columnNames: ['applicationType'],
        }));
        await queryRunner.createForeignKey('job_applications', new typeorm_1.TableForeignKey({
            name: 'FK_job_applications_jobListing',
            columnNames: ['jobListingId'],
            referencedTableName: 'public_job_listings',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
        await queryRunner.createForeignKey('job_applications', new typeorm_1.TableForeignKey({
            name: 'FK_job_applications_applicant',
            columnNames: ['applicantUserId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('job_applications', true);
        await queryRunner.query(`DROP TYPE IF EXISTS job_application_status_enum`);
        await queryRunner.query(`DROP TYPE IF EXISTS job_application_type_enum`);
    }
}
exports.CreateJobApplicationsTable1770500000000 = CreateJobApplicationsTable1770500000000;
//# sourceMappingURL=1770500000000-CreateJobApplicationsTable.js.map