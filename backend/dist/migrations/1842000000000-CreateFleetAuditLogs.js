"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFleetAuditLogs1842000000000 = void 0;
class CreateFleetAuditLogs1842000000000 {
    name = 'CreateFleetAuditLogs1842000000000';
    async up(queryRunner) {
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
        await queryRunner.query(`CREATE INDEX "IDX_fleet_audit_logs_fleet_org" ON "fleet_audit_logs" ("fleetId", "organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_audit_logs_org_created" ON "fleet_audit_logs" ("organizationId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_audit_logs_fleet_created" ON "fleet_audit_logs" ("fleetId", "createdAt")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_fleet_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_org_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_audit_logs_fleet_org"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "fleet_audit_logs"`);
    }
}
exports.CreateFleetAuditLogs1842000000000 = CreateFleetAuditLogs1842000000000;
//# sourceMappingURL=1842000000000-CreateFleetAuditLogs.js.map