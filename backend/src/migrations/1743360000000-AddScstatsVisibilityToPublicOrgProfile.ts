import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds scstatsVisibility JSONB column to public_org_profiles table.
 * Allows orgs to control which SCStats sections are shown on their public page.
 */
export class AddScstatsVisibilityToPublicOrgProfile1743360000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('public_org_profiles');
    if (table && !table.findColumnByName('scstatsVisibility')) {
      await queryRunner.query(
        `ALTER TABLE "public_org_profiles" ADD COLUMN "scstatsVisibility" jsonb`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('public_org_profiles');
    if (table?.findColumnByName('scstatsVisibility')) {
      await queryRunner.query(`ALTER TABLE "public_org_profiles" DROP COLUMN "scstatsVisibility"`);
    }
  }
}
