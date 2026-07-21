import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds auto-enforcement columns to blacklist_sharing_config.
 *
 * Auto-enforcement allows organizations to automatically execute
 * timeout and kick actions from allied moderation incidents.
 * Bans are NEVER auto-enforced — they always require manual confirmation.
 */
export class AddAutoEnforceToBlacklistSharingConfig1863400000000 implements MigrationInterface {
  name = 'AddAutoEnforceToBlacklistSharingConfig1863400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceEnabled" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceTimeouts" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config"
       ADD COLUMN "autoEnforceKicks" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceKicks"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceTimeouts"`
    );
    await queryRunner.query(
      `ALTER TABLE "blacklist_sharing_config" DROP COLUMN "autoEnforceEnabled"`
    );
  }
}
