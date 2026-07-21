import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscordEventId1862000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'discordEventId'`
    );
    if (result.length === 0) {
      await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN "discordEventId" varchar NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'discordEventId'`
    );
    if (result.length > 0) {
      await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN "discordEventId"`);
    }
  }
}
