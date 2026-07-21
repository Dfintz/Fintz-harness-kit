import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make organizations.members nullable
 *
 * The `members` column is deprecated (replaced by OrganizationMembership entity)
 * but the original migration created it as NOT NULL. New organization creation
 * doesn't populate this field, causing INSERT failures.
 */
export class MakeOrganizationMembersNullable1813100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" SET DEFAULT ''`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Backfill empty strings before re-adding NOT NULL
    await queryRunner.query(`UPDATE "organizations" SET "members" = '' WHERE "members" IS NULL`);
    await queryRunner.query(`ALTER TABLE "organizations" ALTER COLUMN "members" SET NOT NULL`);
  }
}
