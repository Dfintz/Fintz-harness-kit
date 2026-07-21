import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add RSI organization metadata columns to public_org_profiles table.
 * Also add exclusive column to rsi_crawled_organizations.
 *
 * Fields:
 * - rsiArchetype: Organization type from RSI (Organization, Corporation, PMC, etc.)
 * - rsiCommitment: Commitment level from RSI (Casual, Regular, Hardcore)
 * - rsiRolePlay: Roleplay preference from RSI (true/false)
 * - rsiExclusive: Exclusive membership from RSI (true/false)
 */
export class AddRsiOrgMetadataToPublicProfile1831000000000 implements MigrationInterface {
  name = 'AddRsiOrgMetadataToPublicProfile1831000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiArchetype" varchar(100)`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiCommitment" varchar(50)`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiRolePlay" boolean`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" ADD COLUMN IF NOT EXISTS "rsiExclusive" boolean`
    );
    await queryRunner.query(
      `ALTER TABLE "rsi_crawled_organizations" ADD COLUMN IF NOT EXISTS "exclusive" text`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiExclusive"`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiRolePlay"`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiCommitment"`
    );
    await queryRunner.query(
      `ALTER TABLE "public_org_profiles" DROP COLUMN IF EXISTS "rsiArchetype"`
    );
    await queryRunner.query(
      `ALTER TABLE "rsi_crawled_organizations" DROP COLUMN IF EXISTS "exclusive"`
    );
  }
}
