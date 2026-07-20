"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTimezoneToActivity1864900000000 = void 0;
class AddTimezoneToActivity1864900000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "timezone" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "timezone"`);
    }
}
exports.AddTimezoneToActivity1864900000000 = AddTimezoneToActivity1864900000000;
//# sourceMappingURL=1864900000000-AddTimezoneToActivity.js.map