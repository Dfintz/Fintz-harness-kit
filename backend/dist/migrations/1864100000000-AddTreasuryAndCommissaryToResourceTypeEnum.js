"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTreasuryAndCommissaryToResourceTypeEnum1864100000000 = void 0;
class AddTreasuryAndCommissaryToResourceTypeEnum1864100000000 {
    name = 'AddTreasuryAndCommissaryToResourceTypeEnum1864100000000';
    async up(queryRunner) {
        const treasuryExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = $1
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `, ['treasury']);
        if (!treasuryExists?.[0]?.exists) {
            await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'treasury'
      `);
        }
        const commissaryExists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = $1
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `, ['commissary']);
        if (!commissaryExists?.[0]?.exists) {
            await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'commissary'
      `);
        }
    }
    async down(_queryRunner) {
    }
}
exports.AddTreasuryAndCommissaryToResourceTypeEnum1864100000000 = AddTreasuryAndCommissaryToResourceTypeEnum1864100000000;
//# sourceMappingURL=1864100000000-AddTreasuryAndCommissaryToResourceTypeEnum.js.map