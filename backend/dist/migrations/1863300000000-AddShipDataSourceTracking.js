"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddShipDataSourceTracking1863300000000 = void 0;
class AddShipDataSourceTracking1863300000000 {
    name = 'AddShipDataSourceTracking1863300000000';
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'dataSource'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "dataSource" varchar(32) NOT NULL DEFAULT 'manual';
          UPDATE "ships" SET "dataSource" = 'manual' WHERE "dataSource" IS NULL;
        END IF;
      END $$;
    `);
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'lastFetchedAt'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "lastFetchedAt" timestamp;
        END IF;
      END $$;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "lastFetchedAt"`);
        await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "dataSource"`);
    }
}
exports.AddShipDataSourceTracking1863300000000 = AddShipDataSourceTracking1863300000000;
//# sourceMappingURL=1863300000000-AddShipDataSourceTracking.js.map