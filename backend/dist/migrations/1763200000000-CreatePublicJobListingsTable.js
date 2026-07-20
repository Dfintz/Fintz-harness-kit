"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePublicJobListingsTable1763200000000 = void 0;
const logger_1 = require("../utils/logger");
class CreatePublicJobListingsTable1763200000000 {
    name = 'CreatePublicJobListingsTable1763200000000';
    async up(queryRunner) {
        const tableExists = await queryRunner.hasTable('public_job_listings');
        if (tableExists) {
            logger_1.logger.info('Table public_job_listings already exists, skipping creation');
            return;
        }
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
        await queryRunner.query(`
            ALTER TABLE "public_job_listings" 
            ADD CONSTRAINT "FK_public_job_listings_organization" 
            FOREIGN KEY ("organizationId") 
            REFERENCES "organizations"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }
    async down(queryRunner) {
        const tableExists = await queryRunner.hasTable('public_job_listings');
        if (!tableExists) {
            logger_1.logger.info('Table public_job_listings does not exist, skipping drop');
            return;
        }
        await queryRunner.query(`
            ALTER TABLE "public_job_listings" 
            DROP CONSTRAINT IF EXISTS "FK_public_job_listings_organization"
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_expiresAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_postedAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_focus"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_jobType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_isActive"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_ownerType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_allianceId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_public_job_listings_organizationId"`);
        await queryRunner.query(`DROP TABLE "public_job_listings"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "listing_owner_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "pay_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "job_type_enum"`);
    }
}
exports.CreatePublicJobListingsTable1763200000000 = CreatePublicJobListingsTable1763200000000;
//# sourceMappingURL=1763200000000-CreatePublicJobListingsTable.js.map