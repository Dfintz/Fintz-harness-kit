import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Convert activities.applicationQuestions from `simple-array` (text, comma-separated)
 * to a structured jsonb column matching `ApplicationQuestion[]` shape.
 *
 * Phase 1.1 of the recruitment hardening plan (PR #1108 follow-up).
 *
 * Backfill rule: each existing comma-separated label becomes a minimal
 * `ApplicationQuestion` of type `paragraph`, required=false, with a generated UUID.
 */
export class ConvertActivityApplicationQuestionsToJsonb1862500000000 implements MigrationInterface {
  name = 'ConvertActivityApplicationQuestionsToJsonb1862500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Detect current column data type (simple-array stores as text)
    const cols = await queryRunner.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'activities' AND column_name = 'applicationQuestions'`
    );

    if (cols.length === 0) {
      // Column does not exist — create it fresh as jsonb
      await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "applicationQuestions" jsonb`);
      return;
    }

    if (cols[0].data_type === 'jsonb') {
      // Already migrated
      return;
    }

    // gen_random_uuid() is available natively in PostgreSQL 13+
    // (Azure Flexible Server runs PG 16, no pgcrypto extension needed)

    // 1. Add the new column
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "applicationQuestions_new" jsonb`);

    // 2. Backfill from the legacy text column. simple-array stores comma-separated values.
    //    We split on ',' and convert each non-empty label into a structured question.
    await queryRunner.query(`
      UPDATE "activities"
      SET "applicationQuestions_new" = sub.questions
      FROM (
        SELECT
          a.id,
          jsonb_agg(
            jsonb_build_object(
              'id', gen_random_uuid()::text,
              'label', trim(label),
              'type', 'paragraph',
              'required', false,
              'order', (idx - 1)
            )
            ORDER BY idx
          ) AS questions
        FROM "activities" a
        CROSS JOIN LATERAL unnest(string_to_array(a."applicationQuestions", ',')) WITH ORDINALITY AS x(label, idx)
        WHERE a."applicationQuestions" IS NOT NULL
          AND a."applicationQuestions" <> ''
          AND trim(label) <> ''
        GROUP BY a.id
      ) AS sub
      WHERE "activities".id = sub.id;
    `);

    // 3. Drop the old column and rename the new one
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "applicationQuestions"`);
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "applicationQuestions_new" TO "applicationQuestions"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = await queryRunner.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_name = 'activities' AND column_name = 'applicationQuestions'`
    );

    if (cols.length === 0 || cols[0].data_type !== 'jsonb') {
      return;
    }

    // Recreate as text and backfill labels joined with commas
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "applicationQuestions_old" text`);

    await queryRunner.query(`
      UPDATE "activities"
      SET "applicationQuestions_old" = sub.labels
      FROM (
        SELECT
          a.id,
          string_agg(q->>'label', ',' ORDER BY (q->>'order')::int) AS labels
        FROM "activities" a
        CROSS JOIN LATERAL jsonb_array_elements(a."applicationQuestions") AS q
        WHERE a."applicationQuestions" IS NOT NULL
        GROUP BY a.id
      ) AS sub
      WHERE "activities".id = sub.id;
    `);

    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "applicationQuestions"`);
    await queryRunner.query(
      `ALTER TABLE "activities" RENAME COLUMN "applicationQuestions_old" TO "applicationQuestions"`
    );
  }
}
