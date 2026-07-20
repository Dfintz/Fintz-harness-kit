"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddListingCategoryToPublicJobListings1775100000000 = void 0;
const logger_1 = require("../utils/logger");
class AddListingCategoryToPublicJobListings1775100000000 {
    name = 'AddListingCategoryToPublicJobListings1775100000000';
    async up(queryRunner) {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "listing_category_enum" AS ENUM ('job', 'service');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        const columnExists = await queryRunner.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'public_job_listings' AND column_name = 'listingCategory'
        `);
        if (columnExists.length > 0) {
            logger_1.logger.info('Column listingCategory already exists on public_job_listings, skipping');
            return;
        }
        await queryRunner.query(`
            ALTER TABLE "public_job_listings"
            ADD COLUMN "listingCategory" "listing_category_enum" NOT NULL DEFAULT 'job'
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_listingCategory"
            ON "public_job_listings" ("listingCategory")
        `);
        logger_1.logger.info('Added listingCategory column to public_job_listings');
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_listingCategory"`);
        await queryRunner.query(`
            ALTER TABLE "public_job_listings" DROP COLUMN IF EXISTS "listingCategory"
        `);
        await queryRunner.query(`DROP TYPE IF EXISTS "listing_category_enum"`);
        logger_1.logger.info('Removed listingCategory column from public_job_listings');
    }
}
exports.AddListingCategoryToPublicJobListings1775100000000 = AddListingCategoryToPublicJobListings1775100000000;
//# sourceMappingURL=1775100000000-AddListingCategoryToPublicJobListings.js.map