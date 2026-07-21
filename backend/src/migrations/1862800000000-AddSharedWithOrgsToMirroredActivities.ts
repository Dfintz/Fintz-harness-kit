import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the missing `sharedWithOrgs` column to `mirrored_activities`.
 *
 * TenantEntity defines this column, but the original CreateMirroredActivitiesTable
 * migration didn't include it. TypeORM queries SELECT it (inherited from TenantEntity),
 * causing "column MirroredActivity.sharedWithOrgs does not exist" errors.
 */
export class AddSharedWithOrgsToMirroredActivities1862800000000 implements MigrationInterface {
  name = 'AddSharedWithOrgsToMirroredActivities1862800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'mirrored_activities' AND column_name = 'sharedWithOrgs'`
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "mirrored_activities" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mirrored_activities" DROP COLUMN IF EXISTS "sharedWithOrgs"`
    );
  }
}
