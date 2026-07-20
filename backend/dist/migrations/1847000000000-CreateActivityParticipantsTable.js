"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateActivityParticipantsTable1847000000000 = void 0;
class CreateActivityParticipantsTable1847000000000 {
    name = 'CreateActivityParticipantsTable1847000000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveActivitiesColumnName(queryRunner, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'activities'
        AND lower(column_name) = lower($1)
      ORDER BY CASE WHEN column_name = $1 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
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
        const BATCH_SIZE = 500;
        let offset = 0;
        let hasMore = true;
        const activitiesIdColumn = await this.resolveActivitiesColumnName(queryRunner, 'id');
        const activitiesParticipantsColumn = await this.resolveActivitiesColumnName(queryRunner, 'participants');
        const activitiesCreatedAtColumn = await this.resolveActivitiesColumnName(queryRunner, 'createdAt');
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
            hasMore = offset < 100000;
            offset += BATCH_SIZE;
            if (rowsInserted === 0 && offset > BATCH_SIZE) {
                hasMore = false;
            }
        }
    }
    async down(queryRunner) {
        await queryRunner.query('DROP TABLE IF EXISTS "activity_participants"');
    }
}
exports.CreateActivityParticipantsTable1847000000000 = CreateActivityParticipantsTable1847000000000;
//# sourceMappingURL=1847000000000-CreateActivityParticipantsTable.js.map