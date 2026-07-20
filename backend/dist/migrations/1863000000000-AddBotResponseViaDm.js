"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBotResponseViaDm1863000000000 = void 0;
class AddBotResponseViaDm1863000000000 {
    name = 'AddBotResponseViaDm1863000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "discord_user_preferences" ADD "botResponseViaDm" boolean NOT NULL DEFAULT false`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "discord_user_preferences" DROP COLUMN "botResponseViaDm"`);
    }
}
exports.AddBotResponseViaDm1863000000000 = AddBotResponseViaDm1863000000000;
//# sourceMappingURL=1863000000000-AddBotResponseViaDm.js.map