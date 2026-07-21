import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates a persistent per-period ledger for automated dues runs.
 *
 * This table is used by DuesService to ensure exactly-once collection intent
 * per (dues schedule, UTC collection date) with recovery for failed/stale runs.
 */
export class CreateOrgDuesCollectionRunsTable1864000000000 implements MigrationInterface {
  name = 'CreateOrgDuesCollectionRunsTable1864000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_dues_collection_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" character varying NOT NULL,
        "duesId" uuid NOT NULL,
        "collectionDateUtc" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'running',
        "attemptCount" integer NOT NULL DEFAULT 1,
        "lastError" text,
        "transactionId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_dues_collection_runs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_org_dues_collection_runs_dues" FOREIGN KEY ("duesId") REFERENCES "org_dues"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_org_dues_collection_runs_dues_date"
      ON "org_dues_collection_runs" ("duesId", "collectionDateUtc")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_dues_collection_runs_org_date"
      ON "org_dues_collection_runs" ("organizationId", "collectionDateUtc")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_org_dues_collection_runs_status"
      ON "org_dues_collection_runs" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_dues_collection_runs_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_dues_collection_runs_org_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_org_dues_collection_runs_dues_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_dues_collection_runs"`);
  }
}
