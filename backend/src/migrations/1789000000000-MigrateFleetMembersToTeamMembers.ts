import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 12-C1: Migrate FleetMember data → TeamMember
 *
 * Phase 1 — Auto-create teams for fleets without a teamId
 * Phase 2 — INSERT new TeamMembers from FleetMembers (no duplicates)
 * Phase 3 — MERGE personnel fields into pre-existing TeamMembers
 *
 * Column mapping:
 *   FleetMember.roles         → TeamMember.additional_roles
 *   FleetMember.stats (text)  → TeamMember.stats (jsonb)
 *   FleetMember.isLeader      → TeamMember.role = 'leader'
 *   FleetMember.role (free)   → mapped to 'leader'|'officer'|'member'
 *   FleetMember.shipType      → TeamMember.ship_type
 *   FleetMember.lastActiveAt  → TeamMember.last_active_at
 *   FleetMember.departureReason → TeamMember.departure_reason
 *   FleetMember.notes         → dropped (still in fleet_members for 12-D)
 */
export class MigrateFleetMembersToTeamMembers1789000000000 implements MigrationInterface {
  name = 'MigrateFleetMembersToTeamMembers1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFleetMembers = await queryRunner.query(`SELECT 1 FROM fleet_members LIMIT 1`);
    if (hasFleetMembers.length === 0) {
      return;
    }

    // =================================================================
    // Phase 1: Auto-create teams for fleets without a teamId
    // =================================================================
    // Uses PL/pgSQL to iterate fleets, create uniquely-named teams,
    // set maxMembers >= member count, and link fleet.teamId.
    await queryRunner.query(`
      DO $$
      DECLARE
        fleet_rec RECORD;
        new_team_id UUID;
        team_name_val TEXT;
        member_count INT;
      BEGIN
        FOR fleet_rec IN
          SELECT f.id, f.name, f.description, f."organizationId"
          FROM fleets f
          WHERE f."teamId" IS NULL
            AND EXISTS (
              SELECT 1 FROM fleet_members fm WHERE fm."fleetId" = f.id
            )
        LOOP
          -- Unique name within the organization
          team_name_val := fleet_rec.name;

          IF EXISTS (
            SELECT 1 FROM teams t
            WHERE t."organizationId" = fleet_rec."organizationId"
              AND t.name = team_name_val
          ) THEN
            team_name_val := team_name_val || ' (Fleet)';
          END IF;

          IF EXISTS (
            SELECT 1 FROM teams t
            WHERE t."organizationId" = fleet_rec."organizationId"
              AND t.name = team_name_val
          ) THEN
            team_name_val := fleet_rec.name
              || ' (' || LEFT(fleet_rec.id::text, 8) || ')';
          END IF;

          SELECT COUNT(*) INTO member_count
          FROM fleet_members
          WHERE "fleetId" = fleet_rec.id;

          new_team_id := gen_random_uuid();

          INSERT INTO teams (
            id, "organizationId", name, description, type,
            level, "sortOrder", "maxMembers", "isActive",
            "createdAt", "updatedAt"
          ) VALUES (
            new_team_id,
            fleet_rec."organizationId",
            team_name_val,
            'Auto-created from fleet: ' || fleet_rec.name,
            'squad',
            0, 0,
            GREATEST(member_count, 20),
            true,
            NOW(), NOW()
          );

          UPDATE fleets
          SET "teamId" = new_team_id
          WHERE id = fleet_rec.id;
        END LOOP;
      END $$;
    `);

    // =================================================================
    // Phase 2: Insert new TeamMembers from FleetMembers
    // =================================================================
    // Skips rows where a TeamMember already exists for (userId, teamId).
    await queryRunner.query(`
      INSERT INTO team_members (
        id, "organizationId", "teamId", "userId",
        role, status, "joinedAt", "leftAt",
        rank, ship_type, specialization, stats,
        certifications, additional_roles, last_active_at,
        departure_reason, "createdAt", "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        fm."organizationId",
        f."teamId",
        fm."userId",
        CASE
          WHEN fm."isLeader" = true THEN 'leader'
          WHEN LOWER(COALESCE(fm.role, ''))
            IN ('officer', 'commander', 'squad-leader', 'admin')
          THEN 'officer'
          ELSE 'member'
        END,
        CASE
          WHEN fm.status IN (
            'active', 'inactive', 'on_leave', 'probation', 'deployed'
          ) THEN fm.status
          ELSE 'active'
        END,
        fm."joinedAt",
        fm."leftAt",
        fm.rank,
        fm."shipType",
        fm.specialization,
        CASE
          WHEN fm.stats IS NOT NULL AND fm.stats <> ''
          THEN fm.stats::jsonb
          ELSE NULL
        END,
        fm.certifications,
        fm.roles,
        fm."lastActiveAt",
        fm."departureReason",
        NOW(),
        NOW()
      FROM fleet_members fm
      JOIN fleets f ON fm."fleetId" = f.id
      WHERE f."teamId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM team_members tm
          WHERE tm."userId" = fm."userId"
            AND tm."teamId" = f."teamId"
        )
    `);

    // =================================================================
    // Phase 3: Merge personnel fields into existing TeamMembers
    // =================================================================
    // Only backfills NULL fields — never overwrites existing data.
    await queryRunner.query(`
      UPDATE team_members tm SET
        rank              = COALESCE(tm.rank, fm.rank),
        ship_type         = COALESCE(tm.ship_type, fm."shipType"),
        specialization    = COALESCE(tm.specialization, fm.specialization),
        stats             = COALESCE(
          tm.stats,
          CASE
            WHEN fm.stats IS NOT NULL AND fm.stats <> ''
            THEN fm.stats::jsonb
            ELSE NULL
          END
        ),
        certifications    = COALESCE(tm.certifications, fm.certifications),
        additional_roles  = COALESCE(tm.additional_roles, fm.roles),
        last_active_at    = COALESCE(tm.last_active_at, fm."lastActiveAt"),
        departure_reason  = COALESCE(tm.departure_reason, fm."departureReason"),
        "updatedAt"       = NOW()
      FROM fleet_members fm
      JOIN fleets f ON fm."fleetId" = f.id
      WHERE tm."userId" = fm."userId"
        AND tm."teamId" = f."teamId"
        AND f."teamId"  IS NOT NULL
        AND (
          tm.rank             IS NULL OR
          tm.ship_type        IS NULL OR
          tm.specialization   IS NULL OR
          tm.stats            IS NULL OR
          tm.certifications   IS NULL OR
          tm.additional_roles IS NULL OR
          tm.last_active_at   IS NULL OR
          tm.departure_reason IS NULL
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: Best-effort rollback. Merged data in pre-existing
    // TeamMembers cannot be perfectly reverted.

    // 1. Remove team_members that match fleet_member records
    await queryRunner.query(`
      DELETE FROM team_members tm
      USING fleet_members fm, fleets f
      WHERE f."teamId" = tm."teamId"
        AND fm."fleetId" = f.id
        AND fm."userId" = tm."userId"
    `);

    // 2. Unlink auto-created teams from fleets
    await queryRunner.query(`
      UPDATE fleets f
      SET "teamId" = NULL
      FROM teams t
      WHERE f."teamId" = t.id
        AND t.description LIKE 'Auto-created from fleet:%'
    `);

    // 3. Delete auto-created teams
    await queryRunner.query(`
      DELETE FROM teams
      WHERE description LIKE 'Auto-created from fleet:%'
    `);
  }
}
