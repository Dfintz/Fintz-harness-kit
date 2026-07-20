"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExternalIntegrationOwnerScope20260713101500 = void 0;
const typeorm_1 = require("typeorm");
class AddExternalIntegrationOwnerScope20260713101500 {
    name = 'AddExternalIntegrationOwnerScope20260713101500';
    async up(queryRunner) {
        const hasOwnerType = await queryRunner.hasColumn('external_integrations', 'ownerType');
        if (!hasOwnerType) {
            await queryRunner.addColumn('external_integrations', new typeorm_1.TableColumn({
                name: 'ownerType',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const hasOwnerId = await queryRunner.hasColumn('external_integrations', 'ownerId');
        if (!hasOwnerId) {
            await queryRunner.addColumn('external_integrations', new typeorm_1.TableColumn({
                name: 'ownerId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        await queryRunner.query(`
      UPDATE external_integrations
      SET "ownerType" = 'fleet', "ownerId" = "fleetId"
      WHERE "ownerType" IS NULL OR "ownerId" IS NULL
    `);
    }
    async down(queryRunner) {
        const hasOwnerId = await queryRunner.hasColumn('external_integrations', 'ownerId');
        if (hasOwnerId) {
            await queryRunner.dropColumn('external_integrations', 'ownerId');
        }
        const hasOwnerType = await queryRunner.hasColumn('external_integrations', 'ownerType');
        if (hasOwnerType) {
            await queryRunner.dropColumn('external_integrations', 'ownerType');
        }
    }
}
exports.AddExternalIntegrationOwnerScope20260713101500 = AddExternalIntegrationOwnerScope20260713101500;
//# sourceMappingURL=20260713101500-AddExternalIntegrationOwnerScope.js.map