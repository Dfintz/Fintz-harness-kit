"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPagesToBriefing1862100000000 = void 0;
class AddPagesToBriefing1862100000000 {
    async up(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'briefings' AND column_name = 'pages'`);
        if (result.length === 0) {
            await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "pages" text NULL DEFAULT '[]'`);
        }
    }
    async down(queryRunner) {
        const result = await queryRunner.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'briefings' AND column_name = 'pages'`);
        if (result.length > 0) {
            await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "pages"`);
        }
    }
}
exports.AddPagesToBriefing1862100000000 = AddPagesToBriefing1862100000000;
//# sourceMappingURL=1862100000000-AddPagesToBriefing.js.map