import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBackupTables1794000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create backups table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backups" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "organizationId" varchar NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "name" varchar(255) NOT NULL,
        "description" varchar(1000),
        "backupType" varchar(50) NOT NULL DEFAULT 'full',
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "createdBy" varchar NOT NULL,
        "createdByName" varchar(255) NOT NULL,
        "sizeBytes" bigint,
        "blobName" varchar,
        "entityCount" integer NOT NULL DEFAULT 0,
        "entityBreakdown" jsonb,
        "errorMessage" varchar,
        "completedAt" timestamp,
        "expiresAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_backups" PRIMARY KEY ("id")
      )
    `);

    // Create backup_schedules table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "backup_schedules" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "organizationId" varchar NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "frequency" varchar(50) NOT NULL,
        "retentionDays" integer NOT NULL DEFAULT 30,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdBy" varchar NOT NULL,
        "lastRunAt" timestamp,
        "nextRunAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_backup_schedules" PRIMARY KEY ("id")
      )
    `);

    // Indexes for backups
    await queryRunner.query(
      `CREATE INDEX "IDX_backups_org_status" ON "backups" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_backups_org_createdAt" ON "backups" ("organizationId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_backups_status_expiresAt" ON "backups" ("status", "expiresAt")`
    );
    await queryRunner.query(`CREATE INDEX "IDX_backups_createdBy" ON "backups" ("createdBy")`);

    // Unique index for backup_schedules (one per org)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_backup_schedules_org" ON "backup_schedules" ("organizationId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "backup_schedules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "backups"`);
  }
}
