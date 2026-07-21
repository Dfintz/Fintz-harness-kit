import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a terminal pool status for best-effort distribution runs where one or
 * more settlement operations fail.
 */
export class AddPartiallyDistributedLootPoolStatus1864300000000 implements MigrationInterface {
  name = 'AddPartiallyDistributedLootPoolStatus1864300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "loot_pools_status_enum"
      ADD VALUE IF NOT EXISTS 'partially_distributed'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum values cannot be removed safely in down migrations.
  }
}
