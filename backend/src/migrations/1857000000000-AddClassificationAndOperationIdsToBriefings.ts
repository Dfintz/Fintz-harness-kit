import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds intelligence classification gating and multi-operation binding to briefings.
 *
 * - `classification` enum column (public/restricted/confidential/secret/top_secret)
 *   defaults to 'restricted' — mirrors IntelClassification from the intel domain.
 * - `operationIds` JSON column (array of activity UUIDs) for binding a briefing
 *   to one or more operations.
 */
export class AddClassificationAndOperationIdsToBriefings1857000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'briefings_classification_enum') THEN
          CREATE TYPE "briefings_classification_enum" AS ENUM ('public', 'restricted', 'confidential', 'secret', 'top_secret');
        END IF;
      END $$`
    );

    // Add classification column
    const hasClassification = await queryRunner.hasColumn('briefings', 'classification');
    if (!hasClassification) {
      await queryRunner.query(
        `ALTER TABLE "briefings" ADD COLUMN "classification" "briefings_classification_enum" NOT NULL DEFAULT 'restricted'`
      );
    }

    // Add operationIds column (JSON array of UUIDs)
    const hasOperationIds = await queryRunner.hasColumn('briefings', 'operationIds');
    if (!hasOperationIds) {
      await queryRunner.query(
        `ALTER TABLE "briefings" ADD COLUMN "operationIds" text DEFAULT '[]'`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasOperationIds = await queryRunner.hasColumn('briefings', 'operationIds');
    if (hasOperationIds) {
      await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "operationIds"`);
    }

    const hasClassification = await queryRunner.hasColumn('briefings', 'classification');
    if (hasClassification) {
      await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "classification"`);
    }

    await queryRunner.query(`DROP TYPE IF EXISTS "briefings_classification_enum"`);
  }
}
