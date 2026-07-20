"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStarCommsIntegrationFields20260712000001 = void 0;
const typeorm_1 = require("typeorm");
class AddStarCommsIntegrationFields20260712000001 {
    name = 'AddStarCommsIntegrationFields20260712000001';
    async up(queryRunner) {
        const hasStarCommsConfig = await queryRunner.hasColumn('external_integrations', 'starCommsConfig');
        if (!hasStarCommsConfig) {
            await queryRunner.addColumn('external_integrations', new typeorm_1.TableColumn({
                name: 'starCommsConfig',
                type: 'text',
                isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        const hasStarCommsConfig = await queryRunner.hasColumn('external_integrations', 'starCommsConfig');
        if (hasStarCommsConfig) {
            await queryRunner.dropColumn('external_integrations', 'starCommsConfig');
        }
    }
}
exports.AddStarCommsIntegrationFields20260712000001 = AddStarCommsIntegrationFields20260712000001;
//# sourceMappingURL=20260712000001-AddStarCommsIntegrationFields.js.map