"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRolesToRsiCrawledMembers1832000000000 = void 0;
class AddRolesToRsiCrawledMembers1832000000000 {
    async up(queryRunner) {
        const hasColumn = await queryRunner.hasColumn('rsi_crawled_members', 'roles');
        if (!hasColumn) {
            await queryRunner.query(`ALTER TABLE "rsi_crawled_members" ADD COLUMN "roles" text NULL`);
        }
    }
    async down(queryRunner) {
        const hasColumn = await queryRunner.hasColumn('rsi_crawled_members', 'roles');
        if (hasColumn) {
            await queryRunner.query(`ALTER TABLE "rsi_crawled_members" DROP COLUMN "roles"`);
        }
    }
}
exports.AddRolesToRsiCrawledMembers1832000000000 = AddRolesToRsiCrawledMembers1832000000000;
//# sourceMappingURL=1832000000000-AddRolesToRsiCrawledMembers.js.map