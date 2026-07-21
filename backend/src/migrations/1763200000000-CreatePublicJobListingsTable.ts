import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

export class CreatePublicJobListingsTable1763200000000 implements MigrationInterface {
    name = 'CreatePublicJobListingsTable1763200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if table already exists
        const tableExists = await queryRunner.hasTable('public_job_listings');
        if (tableExists) {
            logger.info('Table public_job_listings already exists, skipping creation');
            return;
        }

        // Create enum types if they don't exist
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "job_type_enum" AS ENUM (
                    'crew', 'pilot', 'gunner', 'engineer', 'medic', 'miner',
                    'hauler', 'scout', 'security', 'leadership', 'support', 'other'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "pay_type_enum" AS ENUM (
                    'fixed', 'hourly', 'percentage', 'negotiable', 'volunteer'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "listing_owner_type_enum" AS ENUM (
                    'organization', 'alliance'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Create the public_job_listings table
        await queryRunner.query(`
            CREATE TABLE "public_job_listings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "organizationId" character varying,
                "allianceId" character varying,
                "ownerType" "listing_owner_type_enum" NOT NULL DEFAULT 'organization',
                "title" character varying(255) NOT NULL,
                "description" text,
                "jobType" "job_type_enum" NOT NULL DEFAULT 'crew',
                "focus" "org_primary_focus_enum" NOT NULL DEFAULT 'mixed',
                "payType" "pay_type_enum",
                "payMin" integer,
                "payMax" integer,
                "experienceLevel" integer NOT NULL DEFAULT 0,
                "isActive" boolean NOT NULL DEFAULT true,
                "postedAt" TIMESTAMP NOT NULL DEFAULT now(),
                "expiresAt" TIMESTAMP,
                "createdBy" character varying,
                "contactInfo" character varying(255),
                "timezone" character varying(50),
                "languages" jsonb,
                "tags" jsonb,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_public_job_listings" PRIMARY KEY ("id")
            )
        `);

        // Create indexes for efficient filtering and querying
        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_organizationId" 
            ON "public_job_listings" ("organizationId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_allianceId" 
            ON "public_job_listings" ("allianceId")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_ownerType" 
            ON "public_job_listings" ("ownerType")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_isActive" 
            ON "public_job_listings" ("isActive")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_jobType" 
            ON "public_job_listings" ("jobType")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_focus" 
            ON "public_job_listings" ("focus")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_postedAt" 
            ON "public_job_listings" ("postedAt")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_public_job_listings_expiresAt" 
            ON "public_job_listings" ("expiresAt")
        `);

        // Add foreign key constraint for organization (optional, since allianceId has no FK)
        await queryRunner.query(`
            ALTER TABLE "public_job_listings" 
            ADD CONSTRAINT "FK_public_job_listings_organization" 
            FOREIGN KEY ("organizationId") 
            REFERENCES "organizations"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Check if table exists before attempting to drop
        const tableExists = await queryRunner.hasTable('public_job_listings');
        if (!tableExists) {
            logger.info('Table public_job_listings does not exist, skipping drop');
            return;
        }

        // Drop foreign key constraint if it exists
        await queryRunner.query(`
            ALTER TABLE "public_job_listings" 
            DROP CONSTRAINT IF EXISTS "FK_public_job_listings_organization"
        `);

        // Drop indexes if they exist
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_expiresAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_postedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_focus"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_jobType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_isActive"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_ownerType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_allianceId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_organizationId"`);

        // Drop table
        await queryRunner.query(`DROP TABLE "public_job_listings"`);

        // Drop enum types if they exist
        await queryRunner.query(`DROP TYPE IF EXISTS "listing_owner_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "pay_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "job_type_enum"`);
    }
}
