"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFleetSharingColumns1768100000100 = void 0;
const typeorm_1 = require("typeorm");
class AddFleetSharingColumns1768100000100 {
    async up(queryRunner) {
        const hasVisibility = await queryRunner.hasColumn('fleets', 'visibility');
        const hasAllowedOrganizations = await queryRunner.hasColumn('fleets', 'allowedOrganizations');
        const hasPublicViewEnabled = await queryRunner.hasColumn('fleets', 'publicViewEnabled');
        const hasAllowJoinRequests = await queryRunner.hasColumn('fleets', 'allowJoinRequests');
        const columnsToAdd = [];
        if (!hasVisibility) {
            columnsToAdd.push(new typeorm_1.TableColumn({
                name: 'visibility',
                type: 'varchar',
                isNullable: false,
                default: "'private'",
            }));
        }
        if (!hasAllowedOrganizations) {
            columnsToAdd.push(new typeorm_1.TableColumn({
                name: 'allowedOrganizations',
                type: 'text',
                isNullable: false,
                default: "''",
            }));
        }
        if (!hasPublicViewEnabled) {
            columnsToAdd.push(new typeorm_1.TableColumn({
                name: 'publicViewEnabled',
                type: 'boolean',
                isNullable: false,
                default: false,
            }));
        }
        if (!hasAllowJoinRequests) {
            columnsToAdd.push(new typeorm_1.TableColumn({
                name: 'allowJoinRequests',
                type: 'boolean',
                isNullable: false,
                default: false,
            }));
        }
        if (columnsToAdd.length > 0) {
            await queryRunner.addColumns('fleets', columnsToAdd);
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('fleets', 'allowJoinRequests')) {
            await queryRunner.dropColumn('fleets', 'allowJoinRequests');
        }
        if (await queryRunner.hasColumn('fleets', 'publicViewEnabled')) {
            await queryRunner.dropColumn('fleets', 'publicViewEnabled');
        }
        if (await queryRunner.hasColumn('fleets', 'allowedOrganizations')) {
            await queryRunner.dropColumn('fleets', 'allowedOrganizations');
        }
        if (await queryRunner.hasColumn('fleets', 'visibility')) {
            await queryRunner.dropColumn('fleets', 'visibility');
        }
    }
}
exports.AddFleetSharingColumns1768100000100 = AddFleetSharingColumns1768100000100;
//# sourceMappingURL=1768100000100-AddFleetSharingColumns.js.map