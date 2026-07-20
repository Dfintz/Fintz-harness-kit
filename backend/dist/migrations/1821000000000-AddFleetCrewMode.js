"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFleetCrewMode1821000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFleetCrewMode1821000000000 {
    name = 'AddFleetCrewMode1821000000000';
    async up(queryRunner) {
        await queryRunner.addColumn('fleets', new typeorm_1.TableColumn({
            name: 'crewMode',
            type: 'varchar',
            length: '20',
            default: "'conservative'",
            isNullable: false,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('fleets', 'crewMode');
    }
}
exports.AddFleetCrewMode1821000000000 = AddFleetCrewMode1821000000000;
//# sourceMappingURL=1821000000000-AddFleetCrewMode.js.map