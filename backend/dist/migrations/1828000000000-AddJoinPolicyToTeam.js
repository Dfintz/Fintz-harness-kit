"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddJoinPolicyToTeam1828000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddJoinPolicyToTeam1828000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('teams', new typeorm_1.TableColumn({
            name: 'joinPolicy',
            type: 'varchar',
            length: '10',
            default: "'closed'",
            isNullable: false,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('teams', 'joinPolicy');
    }
}
exports.AddJoinPolicyToTeam1828000000000 = AddJoinPolicyToTeam1828000000000;
//# sourceMappingURL=1828000000000-AddJoinPolicyToTeam.js.map