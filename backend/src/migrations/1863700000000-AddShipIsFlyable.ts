import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddShipIsFlyable
 *
 * Adds `isFlyable` boolean column to the ships table so concept ships
 * (announced but not yet released) can be hidden or labelled distinctly on
 * downstream pages. Defaults to true so existing rows are treated as flyable
 * until explicitly marked otherwise.
 *
 * Uses raw SQL with information_schema guards (same approach as
 * AddShipDataSourceTracking) because the ships table has a generated column
 * (search_vector) that breaks queryRunner.addColumn() in environments where
 * typeorm_metadata is absent.
 *
 * Idempotent.
 */
export class AddShipIsFlyable1863700000000 implements MigrationInterface {
  name = 'AddShipIsFlyable1863700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'isFlyable'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "isFlyable" boolean NOT NULL DEFAULT true;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'isFlyable'
        ) THEN
          ALTER TABLE "ships" DROP COLUMN "isFlyable";
        END IF;
      END $$;
    `);
  }
}
