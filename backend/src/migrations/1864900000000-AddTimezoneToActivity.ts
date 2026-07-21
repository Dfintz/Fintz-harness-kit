import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the nullable `timezone` column to the `activities` table.
 *
 * The Activity entity declares `@Column({ nullable: true }) timezone?: string`
 * (backend/src/models/Activity.ts), but no migration ever created the column.
 * In local dev (DB_SYNCHRONIZE=true) the column is auto-created, masking the gap;
 * in production (migrations only) any query that loads the Activity entity fails
 * with `column activity.timezone does not exist`, 500-ing recruitment/activity
 * endpoints. This migration closes that gap.
 */
export class AddTimezoneToActivity1864900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Raw DDL (not queryRunner.addColumn) so it does not depend on the
    // `typeorm_metadata` table, which is absent in production.
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "timezone" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "timezone"`);
  }
}
