"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddIsRedactedToRsiCrawledMember1823000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddIsRedactedToRsiCrawledMember1823000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('rsi_crawled_members', new typeorm_1.TableColumn({
            name: 'isRedacted',
            type: 'boolean',
            default: false,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('rsi_crawled_members', 'isRedacted');
    }
}
exports.AddIsRedactedToRsiCrawledMember1823000000000 = AddIsRedactedToRsiCrawledMember1823000000000;
//# sourceMappingURL=1823000000000-AddIsRedactedToRsiCrawledMember.js.map