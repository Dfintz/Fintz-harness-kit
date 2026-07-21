import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMinCrewToShips1837000000000 implements MigrationInterface {
  name = 'AddMinCrewToShips1837000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "minCrew" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "maxCrew" integer`
    );
    // Backfill maxCrew from crew where maxCrew is null
    await queryRunner.query(
      `UPDATE "ships" SET "maxCrew" = "crew" WHERE "maxCrew" IS NULL AND "crew" IS NOT NULL`
    );
    // Backfill minCrew using conservative rule: ceil(crew * 0.5), minimum 1
    await queryRunner.query(
      `UPDATE "ships" SET "minCrew" = GREATEST(1, CEIL("crew" * 0.5)) WHERE "minCrew" IS NULL AND "crew" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ships" DROP COLUMN IF EXISTS "maxCrew"`
    );
    await queryRunner.query(
      `ALTER TABLE "ships" DROP COLUMN IF EXISTS "minCrew"`
    );
  }
}
