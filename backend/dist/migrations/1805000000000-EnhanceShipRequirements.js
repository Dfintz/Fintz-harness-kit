"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhanceShipRequirements1805000000000 = void 0;
const typeorm_1 = require("typeorm");
class EnhanceShipRequirements1805000000000 {
    async up(queryRunner) {
        const activityTable = await queryRunner.getTable('activities');
        const hasShipReqType = activityTable?.columns.some(c => c.name === 'shipRequirementType');
        const hasRequiredShips = activityTable?.columns.some(c => c.name === 'requiredShips');
        if (!hasShipReqType) {
            await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
                name: 'shipRequirementType',
                type: 'varchar',
                length: '20',
                isNullable: true,
                default: "'none'",
            }));
        }
        if (!hasRequiredShips) {
            await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
                name: 'requiredShips',
                type: 'jsonb',
                isNullable: true,
            }));
        }
        await queryRunner.query(`
      UPDATE public_job_listings
      SET "requiredShips" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'requirementType', 'specific',
            'shipName', elem::text,
            'count', 1,
            'crewPerShip', 1
          )
        )
        FROM jsonb_array_elements_text("requiredShips") AS elem
      )
      WHERE "requiredShips" IS NOT NULL
        AND jsonb_typeof("requiredShips") = 'array'
        AND jsonb_array_length("requiredShips") > 0
        AND jsonb_typeof("requiredShips"->0) = 'string'
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      UPDATE public_job_listings
      SET "requiredShips" = (
        SELECT jsonb_agg(elem->>'shipName')
        FROM jsonb_array_elements("requiredShips") AS elem
      )
      WHERE "requiredShips" IS NOT NULL
        AND jsonb_typeof("requiredShips") = 'array'
        AND jsonb_array_length("requiredShips") > 0
        AND jsonb_typeof("requiredShips"->0) = 'object'
    `);
        const activityTable = await queryRunner.getTable('activities');
        if (activityTable?.columns.some(c => c.name === 'requiredShips')) {
            await queryRunner.dropColumn('activities', 'requiredShips');
        }
        if (activityTable?.columns.some(c => c.name === 'shipRequirementType')) {
            await queryRunner.dropColumn('activities', 'shipRequirementType');
        }
    }
}
exports.EnhanceShipRequirements1805000000000 = EnhanceShipRequirements1805000000000;
//# sourceMappingURL=1805000000000-EnhanceShipRequirements.js.map