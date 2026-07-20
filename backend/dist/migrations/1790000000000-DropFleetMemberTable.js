"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropFleetMemberTable1790000000000 = void 0;
class DropFleetMemberTable1790000000000 {
    name = 'DropFleetMemberTable1790000000000';
    async up(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_fleetId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_organizationId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_status"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "fleet_members"`);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE "fleet_members" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "fleetId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "organizationId" uuid,
        "role" character varying(50),
        "roles" text,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "isLeader" boolean NOT NULL DEFAULT false,
        "shipType" character varying(100),
        "notes" text,
        "stats" text,
        "lastActiveAt" TIMESTAMP,
        "departureReason" character varying(255),
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fleet_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_fleet_members_fleet_user" UNIQUE ("fleetId", "userId")
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_members_fleetId" ON "fleet_members" ("fleetId")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_members_userId" ON "fleet_members" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_members_organizationId" ON "fleet_members" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_members_status" ON "fleet_members" ("status")`);
    }
}
exports.DropFleetMemberTable1790000000000 = DropFleetMemberTable1790000000000;
//# sourceMappingURL=1790000000000-DropFleetMemberTable.js.map