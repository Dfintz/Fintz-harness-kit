import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fixes two pre-existing schema mismatches:
 * 1. Bounty.version — @VersionColumn requires an integer 'version' column
 * 2. MiningOperation.coordinatorId — needs to be uuid to match organization_memberships.userId
 */
export class FixBountyVersionAndMiningCoordinatorType1743380000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add 'version' column to bounties if missing
    const bountiesTable = await queryRunner.getTable('bounties');
    if (bountiesTable && !bountiesTable.findColumnByName('version')) {
      await queryRunner.query(
        `ALTER TABLE "bounties" ADD COLUMN "version" integer NOT NULL DEFAULT 1`
      );
    }

    // 2. Cast mining_operations.coordinatorId to uuid if it's varchar
    const miningTable = await queryRunner.getTable('mining_operations');
    if (miningTable) {
      const coordCol = miningTable.findColumnByName('coordinatorId');
      if (coordCol?.type === 'character varying') {
        await queryRunner.query(
          `ALTER TABLE "mining_operations" ALTER COLUMN "coordinatorId" TYPE uuid USING "coordinatorId"::uuid`
        );
      }
    }

    // Also cast mining_operations.id to uuid if it's varchar
    if (miningTable) {
      const idCol = miningTable.findColumnByName('id');
      if (idCol?.type === 'character varying') {
        await queryRunner.query(
          `ALTER TABLE "mining_operations" ALTER COLUMN "id" TYPE uuid USING "id"::uuid`
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert bounties version column
    const bountiesTable = await queryRunner.getTable('bounties');
    if (bountiesTable?.findColumnByName('version')) {
      await queryRunner.query(`ALTER TABLE "bounties" DROP COLUMN "version"`);
    }

    // Revert mining_operations.coordinatorId back to varchar
    const miningTable = await queryRunner.getTable('mining_operations');
    if (miningTable) {
      const coordCol = miningTable.findColumnByName('coordinatorId');
      if (coordCol?.type === 'uuid') {
        await queryRunner.query(
          `ALTER TABLE "mining_operations" ALTER COLUMN "coordinatorId" TYPE varchar USING "coordinatorId"::varchar`
        );
      }
    }
  }
}
