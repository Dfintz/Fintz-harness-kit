import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 12-D: Drop the fleet_members table.
 *
 * All data was migrated to team_members in 1789000000000-MigrateFleetMembersToTeamMembers.
 * The FleetMember entity and SquadronService have been removed from the codebase.
 *
 * The `down` migration recreates the table with the original schema so the
 * migration chain remains reversible.
 */
export class DropFleetMemberTable1790000000000 implements MigrationInterface {
  name = 'DropFleetMemberTable1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first (if they still exist)
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_fleetId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_members_status"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "fleet_members"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_members_fleetId" ON "fleet_members" ("fleetId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_members_userId" ON "fleet_members" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_members_organizationId" ON "fleet_members" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fleet_members_status" ON "fleet_members" ("status")`
    );
  }
}
