import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateFleetAuditLogs
 *
 * Creates the fleet_audit_logs table to persist fleet audit trail entries.
 * Previously, audit entries lived only in an in-memory circular buffer and
 * were lost on server restart. This migration adds durable storage.
 */
export class CreateFleetAuditLogs1842000000000 implements MigrationInterface {
  name = 'CreateFleetAuditLogs1842000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fleet_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "action" character varying(64) NOT NULL,
        "fleetId" uuid NOT NULL,
        "fleetName" character varying(255) NOT NULL,
        "organizationId" uuid NOT NULL,
        "performedById" character varying,
        "performedByName" character varying,
        "details" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fleet_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fleet_audit_logs_fleet" FOREIGN KEY ("fleetId")
          REFERENCES "fleets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_fleet_audit_logs_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_audit_logs_fleet_org" ON "fleet_audit_logs" ("fleetId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_audit_logs_org_created" ON "fleet_audit_logs" ("organizationId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_audit_logs_fleet_created" ON "fleet_audit_logs" ("fleetId", "createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_fleet_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_org_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_fleet_org"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "fleet_audit_logs"`);
  }
}
