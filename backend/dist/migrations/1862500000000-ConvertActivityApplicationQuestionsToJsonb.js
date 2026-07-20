"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvertActivityApplicationQuestionsToJsonb1862500000000 = void 0;
class ConvertActivityApplicationQuestionsToJsonb1862500000000 {
    name = 'ConvertActivityApplicationQuestionsToJsonb1862500000000';
    async up(queryRunner) {
        const cols = await queryRunner.query(`SELECT data_type FROM information_schema.columns
       WHERE table_name = 'activities' AND column_name = 'applicationQuestions'`);
        if (cols.length === 0) {
            await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "applicationQuestions" jsonb`);
            return;
        }
        if (cols[0].data_type === 'jsonb') {
            return;
        }
        await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "applicationQuestions_new" jsonb`);
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
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "applicationQuestions"`);
        await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "applicationQuestions_new" TO "applicationQuestions"`);
    }
    async down(queryRunner) {
        const cols = await queryRunner.query(`SELECT data_type FROM information_schema.columns
       WHERE table_name = 'activities' AND column_name = 'applicationQuestions'`);
        if (cols.length === 0 || cols[0].data_type !== 'jsonb') {
            return;
        }
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
        await queryRunner.query(`ALTER TABLE "activities" RENAME COLUMN "applicationQuestions_old" TO "applicationQuestions"`);
    }
}
exports.ConvertActivityApplicationQuestionsToJsonb1862500000000 = ConvertActivityApplicationQuestionsToJsonb1862500000000;
//# sourceMappingURL=1862500000000-ConvertActivityApplicationQuestionsToJsonb.js.map