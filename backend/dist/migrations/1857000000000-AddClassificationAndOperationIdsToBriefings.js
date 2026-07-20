"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddClassificationAndOperationIdsToBriefings1857000000000 = void 0;
class AddClassificationAndOperationIdsToBriefings1857000000000 {
    async up(queryRunner) {
        await queryRunner.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'briefings_classification_enum') THEN
          CREATE TYPE "briefings_classification_enum" AS ENUM ('public', 'restricted', 'confidential', 'secret', 'top_secret');
        END IF;
      END $$`);
        const hasClassification = await queryRunner.hasColumn('briefings', 'classification');
        if (!hasClassification) {
            await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "classification" "briefings_classification_enum" NOT NULL DEFAULT 'restricted'`);
        }
        const hasOperationIds = await queryRunner.hasColumn('briefings', 'operationIds');
        if (!hasOperationIds) {
            await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "operationIds" text DEFAULT '[]'`);
        }
    }
    async down(queryRunner) {
        const hasOperationIds = await queryRunner.hasColumn('briefings', 'operationIds');
        if (hasOperationIds) {
            await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "operationIds"`);
        }
        const hasClassification = await queryRunner.hasColumn('briefings', 'classification');
        if (hasClassification) {
            await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "classification"`);
        }
        await queryRunner.query(`DROP TYPE IF EXISTS "briefings_classification_enum"`);
    }
}
exports.AddClassificationAndOperationIdsToBriefings1857000000000 = AddClassificationAndOperationIdsToBriefings1857000000000;
//# sourceMappingURL=1857000000000-AddClassificationAndOperationIdsToBriefings.js.map