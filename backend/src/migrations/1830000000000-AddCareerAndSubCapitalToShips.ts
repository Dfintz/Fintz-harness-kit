import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddCareerAndSubCapitalToShips
 *
 * Adds `career` column to ships table (e.g. "Transporter", "Combat", "Industrial").
 * Also documents that ShipSize enum now includes 'sub_capital' — this is a string
 * column so no enum migration is needed.
 */
export class AddCareerAndSubCapitalToShips1830000000000 implements MigrationInterface {
  name = 'AddCareerAndSubCapitalToShips1830000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ships" ADD COLUMN IF NOT EXISTS "career" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ships" DROP COLUMN IF EXISTS "career"`);
  }
}
