"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCrewPositionFieldsToTeamMember1826000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddCrewPositionFieldsToTeamMember1826000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('team_members', new typeorm_1.TableColumn({
            name: 'assigned_ship_id',
            type: 'uuid',
            isNullable: true,
        }));
        await queryRunner.addColumn('team_members', new typeorm_1.TableColumn({
            name: 'crew_role',
            type: 'varchar',
            length: '50',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('team_members', 'crew_role');
        await queryRunner.dropColumn('team_members', 'assigned_ship_id');
    }
}
exports.AddCrewPositionFieldsToTeamMember1826000000000 = AddCrewPositionFieldsToTeamMember1826000000000;
//# sourceMappingURL=1826000000000-AddCrewPositionFieldsToTeamMember.js.map