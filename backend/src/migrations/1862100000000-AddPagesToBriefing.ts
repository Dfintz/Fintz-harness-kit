import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPagesToBriefing1862100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'briefings' AND column_name = 'pages'`
    );
    if (result.length === 0) {
      await queryRunner.query(`ALTER TABLE "briefings" ADD COLUMN "pages" text NULL DEFAULT '[]'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'briefings' AND column_name = 'pages'`
    );
    if (result.length > 0) {
      await queryRunner.query(`ALTER TABLE "briefings" DROP COLUMN "pages"`);
    }
  }
}
