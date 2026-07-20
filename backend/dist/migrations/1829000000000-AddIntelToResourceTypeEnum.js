"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddIntelToResourceTypeEnum1829000000000 = void 0;
class AddIntelToResourceTypeEnum1829000000000 {
    name = 'AddIntelToResourceTypeEnum1829000000000';
    async up(queryRunner) {
        const enumExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'intel'
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `);
        if (!enumExists?.[0]?.exists) {
            await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'intel'
      `);
        }
    }
    async down(_queryRunner) {
    }
}
exports.AddIntelToResourceTypeEnum1829000000000 = AddIntelToResourceTypeEnum1829000000000;
//# sourceMappingURL=1829000000000-AddIntelToResourceTypeEnum.js.map