"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddDescriptionToUserShips1840000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddDescriptionToUserShips1840000000000 {
    name = 'AddDescriptionToUserShips1840000000000';
    async up(queryRunner) {
        await queryRunner.addColumn('user_ships', new typeorm_1.TableColumn({
            name: 'description',
            type: 'text',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('user_ships', 'description');
    }
}
exports.AddDescriptionToUserShips1840000000000 = AddDescriptionToUserShips1840000000000;
//# sourceMappingURL=1840000000000-AddDescriptionToUserShips.js.map