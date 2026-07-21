import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Migration: Create user_availability table
 * Wave 2.4 — Group Scheduling & Availability
 */
export class CreateUserAvailability1778000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_availability');
    if (table) {
      return; // Already exists — idempotent
    }

    await queryRunner.createTable(
      new Table({
        name: 'user_availability',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'varchar', isNullable: false },
          { name: 'organizationId', type: 'varchar', isNullable: false },
          { name: 'dayOfWeek', type: 'int', isNullable: false },
          { name: 'startMinute', type: 'int', isNullable: false },
          { name: 'endMinute', type: 'int', isNullable: false },
          { name: 'isRecurring', type: 'boolean', default: true },
          { name: 'effectiveDate', type: 'date', isNullable: true },
          { name: 'expiresAt', type: 'date', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'user_availability',
      new TableIndex({
        name: 'idx_avail_user_org',
        columnNames: ['userId', 'organizationId'],
      })
    );

    await queryRunner.createIndex(
      'user_availability',
      new TableIndex({
        name: 'idx_avail_org_day',
        columnNames: ['organizationId', 'dayOfWeek'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_availability', true);
  }
}
