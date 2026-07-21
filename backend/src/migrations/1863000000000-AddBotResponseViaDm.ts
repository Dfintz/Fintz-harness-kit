import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBotResponseViaDm1863000000000 implements MigrationInterface {
  name = 'AddBotResponseViaDm1863000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discord_user_preferences" ADD "botResponseViaDm" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discord_user_preferences" DROP COLUMN "botResponseViaDm"`
    );
  }
}
