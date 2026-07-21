import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExternalAmbassadors1862300000000 implements MigrationInterface {
  name = 'AddExternalAmbassadors1862300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "federation_ambassadors" ADD "isExternal" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "federation_ambassadors" DROP COLUMN "isExternal"`);
  }
}
