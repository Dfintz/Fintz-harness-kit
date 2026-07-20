"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrgDuesCollectionRunsTable1864000000000 = void 0;
class CreateOrgDuesCollectionRunsTable1864000000000 {
    name = 'CreateOrgDuesCollectionRunsTable1864000000000';
    async up(queryRunner) {
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
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_dues_collection_runs_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_org_dues_collection_runs_org_date"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_org_dues_collection_runs_dues_date"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "org_dues_collection_runs"`);
    }
}
exports.CreateOrgDuesCollectionRunsTable1864000000000 = CreateOrgDuesCollectionRunsTable1864000000000;
//# sourceMappingURL=1864000000000-CreateOrgDuesCollectionRunsTable.js.map