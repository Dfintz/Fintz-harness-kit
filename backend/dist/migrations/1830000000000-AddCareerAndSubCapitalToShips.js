"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCareerAndSubCapitalToShips1830000000000 = void 0;
class AddCareerAndSubCapitalToShips1830000000000 {
    name = 'AddCareerAndSubCapitalToShips1830000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "career" varchar`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "career"`);
    }
}
exports.AddCareerAndSubCapitalToShips1830000000000 = AddCareerAndSubCapitalToShips1830000000000;
//# sourceMappingURL=1830000000000-AddCareerAndSubCapitalToShips.js.map