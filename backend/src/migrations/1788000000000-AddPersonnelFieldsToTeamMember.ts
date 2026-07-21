import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPersonnelFieldsToTeamMember1788000000000 implements MigrationInterface {
  name = 'AddPersonnelFieldsToTeamMember1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "rank" varchar(50)`
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "ship_type" varchar(100)`
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "specialization" text`
    );
    await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "stats" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "certifications" text`
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "additional_roles" text`
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "departure_reason" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "departure_reason"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "last_active_at"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "additional_roles"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "certifications"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "stats"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "specialization"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "ship_type"`);
    await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "rank"`);
  }
}
