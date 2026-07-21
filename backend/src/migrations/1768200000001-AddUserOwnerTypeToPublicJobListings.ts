import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds 'user' value to the listing_owner_type enum on public_job_listings.
 * This allows individual users (not in an org) to post public job listings.
 */
export class AddUserOwnerTypeToPublicJobListings1768200000001 implements MigrationInterface {
  name = 'AddUserOwnerTypeToPublicJobListings1768200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'user' to the existing enum type
    await queryRunner.query(
      `ALTER TYPE "public_job_listings_ownertype_enum" ADD VALUE IF NOT EXISTS 'user'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // To revert, delete any rows with ownerType='user' first, then
    // recreate the enum without 'user'. Left as no-op for safety.
    await queryRunner.query(`DELETE FROM "public_job_listings" WHERE "ownerType" = 'user'`);
  }
}
