import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Create job_applications table for the apply / approve / waitlist flow.
 */
export class CreateJobApplicationsTable1770500000000 implements MigrationInterface {
  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('job_applications');
    if (tableExists) {
      const jobListingColumn = await this.resolveColumnName(
        queryRunner,
        'job_applications',
        'jobListingId'
      );
      const applicantColumn = await this.resolveColumnName(
        queryRunner,
        'job_applications',
        'applicantUserId'
      );

      if (jobListingColumn && applicantColumn) {
        return;
      }
    }

    // Create enum types
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

    await queryRunner.createTable(
      new Table({
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

          // crew-specific
          { name: 'shipIndex', type: 'integer', isNullable: true },
          { name: 'roleIndex', type: 'integer', isNullable: true },
          { name: 'roleName', type: 'varchar', length: '100', isNullable: true },
          { name: 'shipName', type: 'varchar', length: '255', isNullable: true },

          // passenger-specific
          { name: 'passengerShipIndex', type: 'integer', isNullable: true },
          { name: 'passengerRole', type: 'varchar', length: '100', isNullable: true },

          // vehicle-specific
          { name: 'vehicleName', type: 'varchar', length: '255', isNullable: true },

          // review
          { name: 'reviewedBy', type: 'varchar', length: '255', isNullable: true },
          { name: 'reviewNote', type: 'text', isNullable: true },
          { name: 'reviewedAt', type: 'timestamp', isNullable: true },

          // waitlist
          { name: 'waitlistPosition', type: 'integer', isNullable: true },

          // timestamps
          { name: 'createdAt', type: 'timestamp', default: 'NOW()' },
          { name: 'updatedAt', type: 'timestamp', default: 'NOW()' },
        ],
      }),
      true
    );

    // Indexes
    await queryRunner.createIndex(
      'job_applications',
      new TableIndex({ name: 'IDX_job_applications_jobListingId', columnNames: ['jobListingId'] })
    );
    await queryRunner.createIndex(
      'job_applications',
      new TableIndex({
        name: 'IDX_job_applications_applicantUserId',
        columnNames: ['applicantUserId'],
      })
    );
    await queryRunner.createIndex(
      'job_applications',
      new TableIndex({ name: 'IDX_job_applications_status', columnNames: ['status'] })
    );
    await queryRunner.createIndex(
      'job_applications',
      new TableIndex({
        name: 'IDX_job_applications_applicationType',
        columnNames: ['applicationType'],
      })
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'job_applications',
      new TableForeignKey({
        name: 'FK_job_applications_jobListing',
        columnNames: ['jobListingId'],
        referencedTableName: 'public_job_listings',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
    await queryRunner.createForeignKey(
      'job_applications',
      new TableForeignKey({
        name: 'FK_job_applications_applicant',
        columnNames: ['applicantUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('job_applications', true);
    await queryRunner.query(`DROP TYPE IF EXISTS job_application_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS job_application_type_enum`);
  }
}
