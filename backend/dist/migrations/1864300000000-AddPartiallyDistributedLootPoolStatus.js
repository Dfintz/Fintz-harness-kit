"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPartiallyDistributedLootPoolStatus1864300000000 = void 0;
class AddPartiallyDistributedLootPoolStatus1864300000000 {
    name = 'AddPartiallyDistributedLootPoolStatus1864300000000';
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TYPE "loot_pools_status_enum"
      ADD VALUE IF NOT EXISTS 'partially_distributed'
    `);
    }
    async down(_queryRunner) {
    }
}
exports.AddPartiallyDistributedLootPoolStatus1864300000000 = AddPartiallyDistributedLootPoolStatus1864300000000;
//# sourceMappingURL=1864300000000-AddPartiallyDistributedLootPoolStatus.js.map