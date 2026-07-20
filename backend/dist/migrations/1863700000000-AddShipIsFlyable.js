"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddShipIsFlyable1863700000000 = void 0;
class AddShipIsFlyable1863700000000 {
    name = 'AddShipIsFlyable1863700000000';
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'isFlyable'
        ) THEN
          ALTER TABLE "ships" ADD COLUMN "isFlyable" boolean NOT NULL DEFAULT true;
        END IF;
      END $$;
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ships' AND column_name = 'isFlyable'
        ) THEN
          ALTER TABLE "ships" DROP COLUMN "isFlyable";
        END IF;
      END $$;
    `);
    }
}
exports.AddShipIsFlyable1863700000000 = AddShipIsFlyable1863700000000;
//# sourceMappingURL=1863700000000-AddShipIsFlyable.js.map