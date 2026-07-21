import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds 'roles' column to rsi_crawled_members table.
 * Stores organization roles (e.g., CEO, VP, CHRO) as JSON array.
 */
export class AddRolesToRsiCrawledMembers1832000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('rsi_crawled_members', 'roles');
    if (!hasColumn) {
      await queryRunner.query(`ALTER TABLE "rsi_crawled_members" ADD COLUMN "roles" text NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('rsi_crawled_members', 'roles');
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "rsi_crawled_members" DROP COLUMN "roles"`);
    }
  }
}
