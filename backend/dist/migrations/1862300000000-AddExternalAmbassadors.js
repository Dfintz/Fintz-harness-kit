"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExternalAmbassadors1862300000000 = void 0;
class AddExternalAmbassadors1862300000000 {
    name = 'AddExternalAmbassadors1862300000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "federation_ambassadors" ADD "isExternal" boolean NOT NULL DEFAULT false`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "federation_ambassadors" DROP COLUMN "isExternal"`);
    }
}
exports.AddExternalAmbassadors1862300000000 = AddExternalAmbassadors1862300000000;
//# sourceMappingURL=1862300000000-AddExternalAmbassadors.js.map