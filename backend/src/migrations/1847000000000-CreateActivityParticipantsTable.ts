import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 — Create activity_participants normalized table and migrate existing JSON data.
 *
 * This migration:
 * 1. Creates the `activity_participants` table with proper indexes
 * 2. Migrates existing participant data from the `participants` JSON column on `activities`
 * 3. Keeps the JSON column intact for backward compatibility during transition
 *
 * The JSON column will be deprecated (select: false) after all services are migrated.
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Phase 4 (B1, 4.1, 4.2)
 */
export class CreateActivityParticipantsTable1847000000000 implements MigrationInterface {
  name = 'CreateActivityParticipantsTable1847000000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveActivitiesColumnName(
    queryRunner: QueryRunner,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activities'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 4.1 — Create the normalized table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_participants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "activityId" uuid NOT NULL,
        "userId" varchar NOT NULL,
        "userName" varchar NOT NULL,
        "avatarUrl" varchar,
        "organizationId" varchar,
        "organizationName" varchar,
        "role" varchar(50) NOT NULL DEFAULT 'member',
        "status" varchar(20) NOT NULL DEFAULT 'accepted',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "shipType" varchar,
        "shipName" varchar,
        "shipId" varchar,
        "crewPosition" varchar(50),
        "crewShipId" varchar,
        "reputation" decimal(5,2),
        "notes" text,
        "message" text,
        "metadata" text,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_participants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_activity_participant" UNIQUE ("activityId", "userId"),
        CONSTRAINT "FK_activity_participants_activity" FOREIGN KEY ("activityId")
          REFERENCES "activities"("id") ON DELETE CASCADE
      )
    `);

    // Indexes for common query patterns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_participants_user"
        ON "activity_participants" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_participants_activity"
        ON "activity_participants" ("activityId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_activity_participants_status"
        ON "activity_participants" ("activityId", "status")
    `);

    // 4.2 — Migrate existing JSON data to the new table
    // Process in batches of 500 activities to avoid lock contention and WAL pressure
    // Validates JSON before parsing to skip corrupted entries
    const BATCH_SIZE = 500;
    let offset = 0;
    let hasMore = true;

    const activitiesIdColumn = await this.resolveActivitiesColumnName(queryRunner, 'id');
    const activitiesParticipantsColumn = await this.resolveActivitiesColumnName(
      queryRunner,
      'participants'
    );
    const activitiesCreatedAtColumn = await this.resolveActivitiesColumnName(
      queryRunner,
      'createdAt'
    );

    if (!activitiesIdColumn || !activitiesParticipantsColumn || !activitiesCreatedAtColumn) {
      return;
    }

    const activityIdRef = `a.${this.quoteIdentifier(activitiesIdColumn)}`;
    const participantsRef = `a.${this.quoteIdentifier(activitiesParticipantsColumn)}`;
    const createdAtRef = `a.${this.quoteIdentifier(activitiesCreatedAtColumn)}`;

    while (hasMore) {
      const result = await queryRunner.query(`
        WITH valid_activities AS (
          SELECT ${activityIdRef} AS "id", ${participantsRef} AS "participants", ${createdAtRef} AS "createdAt"
          FROM "activities" a
          WHERE ${participantsRef} IS NOT NULL
            AND ${participantsRef} != '[]'
            AND ${participantsRef} != ''
            AND ${participantsRef} ~ '^\\[.*\\]$'
          ORDER BY ${activityIdRef}
          LIMIT ${BATCH_SIZE} OFFSET ${offset}
        )
        INSERT INTO "activity_participants" (
          "activityId", "userId", "userName", "avatarUrl",
          "organizationId", "organizationName", "role", "status",
          "joinedAt", "shipType", "shipName", "shipId",
          "crewPosition", "crewShipId", "reputation", "notes",
          "message", "metadata"
        )
        SELECT
          va."id" AS "activityId",
          p->>'userId' AS "userId",
          COALESCE(p->>'userName', 'Unknown') AS "userName",
          p->>'avatarUrl' AS "avatarUrl",
          p->>'organizationId' AS "organizationId",
          p->>'organizationName' AS "organizationName",
          COALESCE(p->>'role', 'member') AS "role",
          COALESCE(p->>'status', 'accepted') AS "status",
          COALESCE(
            CASE WHEN p->>'joinedAt' ~ '^\\d{4}-' THEN (p->>'joinedAt')::timestamp ELSE NULL END,
            va."createdAt"
          ) AS "joinedAt",
          p->>'shipType' AS "shipType",
          p->>'shipName' AS "shipName",
          p->>'shipId' AS "shipId",
          p->>'crewPosition' AS "crewPosition",
          p->>'crewShipId' AS "crewShipId",
          CASE WHEN p->>'reputation' ~ '^[0-9]' THEN (p->>'reputation')::decimal ELSE NULL END AS "reputation",
          p->>'notes' AS "notes",
          p->>'message' AS "message",
          p->>'metadata' AS "metadata"
        FROM valid_activities va,
          json_array_elements(va."participants"::json) AS p
        WHERE p->>'userId' IS NOT NULL
        ON CONFLICT ("activityId", "userId") DO NOTHING
      `);

      const rowsInserted = Array.isArray(result) ? 0 : (result?.rowCount ?? 0);
      hasMore = offset < 100000; // Safety cap: process up to 100K activities
      offset += BATCH_SIZE;

      if (rowsInserted === 0 && offset > BATCH_SIZE) {
        hasMore = false; // No more data to process
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "activity_participants"');
  }
}
