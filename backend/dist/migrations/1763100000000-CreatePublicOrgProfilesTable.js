"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePublicOrgProfilesTable1763100000000 = void 0;
class CreatePublicOrgProfilesTable1763100000000 {
    name = 'CreatePublicOrgProfilesTable1763100000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('public_org_profiles');
        if (existingTable) {
            return;
        }
        await queryRunner.query(`DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_primary_focus_enum') THEN
                CREATE TYPE "org_primary_focus_enum" AS ENUM (
                    'combat', 'mining', 'trading', 'exploration', 'bounty_hunting',
                    'medical', 'transport', 'salvage', 'security', 'social',
                    'piracy', 'racing', 'mixed'
                );
            END IF;
        END $$;`);
        await queryRunner.query(`DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_level_enum') THEN
                CREATE TYPE "activity_level_enum" AS ENUM (
                    'inactive', 'low', 'moderate', 'high', 'very_high'
                );
            END IF;
        END $$;`);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "public_org_profiles" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "organizationId" character varying NOT NULL,
                "isPublic" boolean NOT NULL DEFAULT false,
                "tagline" character varying(200),
                "primaryFocus" "org_primary_focus_enum" NOT NULL DEFAULT 'mixed',
                "secondaryFocus" jsonb,
                "memberCount" integer NOT NULL DEFAULT 0,
                "activityLevel" "activity_level_enum" NOT NULL DEFAULT 'moderate',
                "rsiUrl" character varying(255),
                "discordInvite" character varying(100),
                "languages" jsonb,
                "timezone" character varying(50),
                "isVerified" boolean NOT NULL DEFAULT false,
                "isRecruiting" boolean NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_public_org_profiles_organizationId" UNIQUE ("organizationId"),
                CONSTRAINT "PK_public_org_profiles" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_organizationId' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_organizationId" 
                ON "public_org_profiles" ("organizationId");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_isPublic' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_isPublic" 
                ON "public_org_profiles" ("isPublic");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_primaryFocus' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_primaryFocus" 
                ON "public_org_profiles" ("primaryFocus");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_activityLevel' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_activityLevel" 
                ON "public_org_profiles" ("activityLevel");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_isRecruiting' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_isRecruiting" 
                ON "public_org_profiles" ("isRecruiting");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_isVerified' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_isVerified" 
                ON "public_org_profiles" ("isVerified");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'IDX_public_org_profiles_memberCount' AND n.nspname = 'public'
            ) THEN
                CREATE INDEX "IDX_public_org_profiles_memberCount" 
                ON "public_org_profiles" ("memberCount");
            END IF; END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                WHERE tc.constraint_name = 'FK_public_org_profiles_organization'
                  AND tc.table_name = 'public_org_profiles'
                  AND tc.constraint_type = 'FOREIGN KEY'
            ) THEN
                ALTER TABLE "public_org_profiles" 
                ADD CONSTRAINT "FK_public_org_profiles_organization" 
                FOREIGN KEY ("organizationId") 
                REFERENCES "organizations"("id") 
                ON DELETE CASCADE 
                ON UPDATE NO ACTION;
            END IF; END $$;
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
            DO $$ BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints tc
                WHERE tc.constraint_name = 'FK_public_org_profiles_organization'
                  AND tc.table_name = 'public_org_profiles'
                  AND tc.constraint_type = 'FOREIGN KEY'
            ) THEN
                ALTER TABLE "public_org_profiles" 
                DROP CONSTRAINT "FK_public_org_profiles_organization";
            END IF; END $$;
        `);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_memberCount') THEN DROP INDEX "IDX_public_org_profiles_memberCount"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_isVerified') THEN DROP INDEX "IDX_public_org_profiles_isVerified"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_isRecruiting') THEN DROP INDEX "IDX_public_org_profiles_isRecruiting"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_activityLevel') THEN DROP INDEX "IDX_public_org_profiles_activityLevel"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_primaryFocus') THEN DROP INDEX "IDX_public_org_profiles_primaryFocus"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_isPublic') THEN DROP INDEX "IDX_public_org_profiles_isPublic"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'IDX_public_org_profiles_organizationId') THEN DROP INDEX "IDX_public_org_profiles_organizationId"; END IF; END $$;`);
        await queryRunner.query(`DROP TABLE IF EXISTS "public_org_profiles"`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_level_enum') THEN DROP TYPE "activity_level_enum"; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_primary_focus_enum') THEN DROP TYPE "org_primary_focus_enum"; END IF; END $$;`);
    }
}
exports.CreatePublicOrgProfilesTable1763100000000 = CreatePublicOrgProfilesTable1763100000000;
//# sourceMappingURL=1763100000000-CreatePublicOrgProfilesTable.js.map