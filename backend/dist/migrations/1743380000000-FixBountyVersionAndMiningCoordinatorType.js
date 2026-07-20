"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FixBountyVersionAndMiningCoordinatorType1743380000000 = void 0;
class FixBountyVersionAndMiningCoordinatorType1743380000000 {
    async up(queryRunner) {
        const bountiesTable = await queryRunner.getTable('bounties');
        if (bountiesTable && !bountiesTable.findColumnByName('version')) {
            await queryRunner.query(`ALTER TABLE "bounties" ADD COLUMN "version" integer NOT NULL DEFAULT 1`);
        }
        const miningTable = await queryRunner.getTable('mining_operations');
        if (miningTable) {
            const coordCol = miningTable.findColumnByName('coordinatorId');
            if (coordCol?.type === 'character varying') {
                await queryRunner.query(`ALTER TABLE "mining_operations" ALTER COLUMN "coordinatorId" TYPE uuid USING "coordinatorId"::uuid`);
            }
        }
        if (miningTable) {
            const idCol = miningTable.findColumnByName('id');
            if (idCol?.type === 'character varying') {
                await queryRunner.query(`ALTER TABLE "mining_operations" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`);
            }
        }
    }
    async down(queryRunner) {
        const bountiesTable = await queryRunner.getTable('bounties');
        if (bountiesTable?.findColumnByName('version')) {
            await queryRunner.query(`ALTER TABLE "bounties" DROP COLUMN "version"`);
        }
        const miningTable = await queryRunner.getTable('mining_operations');
        if (miningTable) {
            const coordCol = miningTable.findColumnByName('coordinatorId');
            if (coordCol?.type === 'uuid') {
                await queryRunner.query(`ALTER TABLE "mining_operations" ALTER COLUMN "coordinatorId" TYPE varchar USING "coordinatorId"::varchar`);
            }
        }
    }
}
exports.FixBountyVersionAndMiningCoordinatorType1743380000000 = FixBountyVersionAndMiningCoordinatorType1743380000000;
//# sourceMappingURL=1743380000000-FixBountyVersionAndMiningCoordinatorType.js.map