import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddShipDataSourceTracking
 *
 * Adds `dataSource` and `lastFetchedAt` columns to the ships table to support
 * the Erkul/Sheets/CSV reconciliation flow in ShipDataFetcher.
 *
 * - `dataSource` (varchar(32), NOT NULL, default 'manual') — origin of the row
 *   so soft-delete reconciliation can scope by source ('erkul' | 'sheets' |
 *   'csv' | 'manual'). All existing rows are backfilled to 'manual' to avoid
 *   accidental deactivation when the next fetch runs.
 * - `lastFetchedAt` (timestamp, NULL) — wall-clock time of the last upsert
 *   from an external source. NULL for rows that have never been refreshed by
 *   the fetcher.
 *
 * Uses raw SQL instead of queryRunner.addColumn() because the ships table
 * has a generated column (search_vector) which causes TypeORM to query the
 * typeorm_metadata table — a table that may not exist in production databases
 * that were bootstrapped without synchronize.
 *
 * Idempotent: every DDL statement is guarded against re-runs.
 */
export class AddShipDataSourceTracking1863300000000 implements MigrationInterface {
  name = 'AddShipDataSourceTracking1863300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add dataSource column via raw DDL (avoids typeorm_metadata lookup).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'dataSource'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "dataSource" varchar(32) NOT NULL DEFAULT 'manual';
          UPDATE "ships" SET "dataSource" = 'manual' WHERE "dataSource" IS NULL;
        END IF;
      END $$;
    `);

    // Add lastFetchedAt column via raw DDL.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'lastFetchedAt'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "lastFetchedAt" timestamp;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "lastFetchedAt"`);
    await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "dataSource"`);
  }
}
