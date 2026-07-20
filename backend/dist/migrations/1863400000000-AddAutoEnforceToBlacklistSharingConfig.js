"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAutoEnforceToBlacklistSharingConfig1863400000000 = void 0;
class AddAutoEnforceToBlacklistSharingConfig1863400000000 {
    name = 'AddAutoEnforceToBlacklistSharingConfig1863400000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceTimeouts" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceKicks" boolean NOT NULL DEFAULT false`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceKicks"`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceTimeouts"`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceEnabled"`);
    }
}
exports.AddAutoEnforceToBlacklistSharingConfig1863400000000 = AddAutoEnforceToBlacklistSharingConfig1863400000000;
//# sourceMappingURL=1863400000000-AddAutoEnforceToBlacklistSharingConfig.js.map