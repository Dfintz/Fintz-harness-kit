"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddEmblemToTeams1858000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddEmblemToTeams1858000000000 {
    async up(queryRunner) {
        const hasEmblem = await queryRunner.hasColumn('teams', 'emblem');
        if (!hasEmblem) {
            await queryRunner.addColumn('teams', new typeorm_1.TableColumn({
                name: 'emblem',
                type: 'text',
                isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        const hasEmblem = await queryRunner.hasColumn('teams', 'emblem');
        if (hasEmblem) {
            await queryRunner.dropColumn('teams', 'emblem');
        }
    }
}
exports.AddEmblemToTeams1858000000000 = AddEmblemToTeams1858000000000;
//# sourceMappingURL=1858000000000-AddEmblemToTeams.js.map