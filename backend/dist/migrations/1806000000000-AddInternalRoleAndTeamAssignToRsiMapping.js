"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddInternalRoleAndTeamAssignToRsiMapping1806000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddInternalRoleAndTeamAssignToRsiMapping1806000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('rsi_role_mappings', new typeorm_1.TableColumn({
            name: 'internalRoleId',
            type: 'uuid',
            isNullable: true,
        }));
        await queryRunner.addColumn('rsi_role_mappings', new typeorm_1.TableColumn({
            name: 'autoAssignTeamIds',
            type: 'jsonb',
            isNullable: true,
        }));
        await queryRunner.createForeignKey('rsi_role_mappings', new typeorm_1.TableForeignKey({
            name: 'FK_rsi_role_mappings_internal_role',
            columnNames: ['internalRoleId'],
            referencedTableName: 'roles',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
        }));
        await queryRunner.createIndex('rsi_role_mappings', new typeorm_1.TableIndex({
            name: 'IDX_rsi_role_mappings_internal_role',
            columnNames: ['internalRoleId'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_internal_role');
        await queryRunner.dropForeignKey('rsi_role_mappings', 'FK_rsi_role_mappings_internal_role');
        await queryRunner.dropColumn('rsi_role_mappings', 'autoAssignTeamIds');
        await queryRunner.dropColumn('rsi_role_mappings', 'internalRoleId');
    }
}
exports.AddInternalRoleAndTeamAssignToRsiMapping1806000000000 = AddInternalRoleAndTeamAssignToRsiMapping1806000000000;
//# sourceMappingURL=1806000000000-AddInternalRoleAndTeamAssignToRsiMapping.js.map