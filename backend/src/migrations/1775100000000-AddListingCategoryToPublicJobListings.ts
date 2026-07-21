import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

export class AddListingCategoryToPublicJobListings1775100000000 implements MigrationInterface {
  name = 'AddListingCategoryToPublicJobListings1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the listing_category_enum type if it doesn't exist
    await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "listing_category_enum" AS ENUM ('job', 'service');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

    // Check if column already exists
    const columnExists = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'public_job_listings' AND column_name = 'listingCategory'
        `);

    if (columnExists.length > 0) {
      logger.info('Column listingCategory already exists on public_job_listings, skipping');
      return;
    }

    // Add the listingCategory column with default 'job' (existing listings are jobs)
    await queryRunner.query(`
            ALTER TABLE "public_job_listings"
            ADD COLUMN "listingCategory" "listing_category_enum" NOT NULL DEFAULT 'job'
        `);

    // Create index for efficient category filtering
    await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_listingCategory"
            ON "public_job_listings" ("listingCategory")
        `);

    logger.info('Added listingCategory column to public_job_listings');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_listingCategory"`);
    await queryRunner.query(`
            ALTER TABLE "public_job_listings" DROP COLUMN IF EXISTS "listingCategory"
        `);
    await queryRunner.query(`DROP TYPE IF EXISTS "listing_category_enum"`);

    logger.info('Removed listingCategory column from public_job_listings');
  }
}
