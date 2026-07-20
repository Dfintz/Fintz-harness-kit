"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRouteCalculationFieldsToActivity1776391600000 = void 0;
const typeorm_1 = require("typeorm");
class AddRouteCalculationFieldsToActivity1776391600000 {
    async up(queryRunner) {
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'totalCargoCapacity',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Total cargo capacity (SCU) across all assigned ships',
        }));
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'totalQuantumFuel',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Total quantum fuel capacity across all ships',
        }));
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'totalQuantumFuelRequired',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Total quantum fuel needed for the entire route',
        }));
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'maxJumpRange',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: true,
            comment: 'Maximum single jump range (km) - limited by bottleneck ship',
        }));
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'hasRefuelShip',
            type: 'boolean',
            isNullable: true,
            default: false,
            comment: 'Whether fleet includes a refuel-capable ship (Starfarer, Vulcan)',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('activities', 'hasRefuelShip');
        await queryRunner.dropColumn('activities', 'maxJumpRange');
        await queryRunner.dropColumn('activities', 'totalQuantumFuelRequired');
        await queryRunner.dropColumn('activities', 'totalQuantumFuel');
        await queryRunner.dropColumn('activities', 'totalCargoCapacity');
    }
}
exports.AddRouteCalculationFieldsToActivity1776391600000 = AddRouteCalculationFieldsToActivity1776391600000;
//# sourceMappingURL=1776391600000-AddRouteCalculationFieldsToActivity.js.map