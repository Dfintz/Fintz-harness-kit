import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CreateLootDistributionTables
 *
 * Creates loot_pools, loot_items, and loot_claims for the commissary loot
 * distribution feature. A loot pool is anchored to an activity and lets the
 * mission leader collect looted gear/components/commodities, calculate total
 * value, set distribution rules, and have participants claim or bid on items.
 */
export class CreateLootDistributionTables1864200000000 implements MigrationInterface {
  name = 'CreateLootDistributionTables1864200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== ENUM TYPES ====================
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_pools_status_enum" AS ENUM ('open', 'locked', 'distributed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_pools_distributionmethod_enum" AS ENUM
          ('need_greed', 'random_roll', 'auec_bid', 'even_split', 'leader_assign');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_items_category_enum" AS ENUM
          ('gear', 'component', 'commodity', 'weapon', 'ship', 'other');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_items_status_enum" AS ENUM ('available', 'awarded');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_items_source_enum" AS ENUM ('manual', 'ocr');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_claims_claimtype_enum" AS ENUM ('need', 'greed', 'roll', 'bid');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "loot_claims_status_enum" AS ENUM ('pending', 'won', 'lost', 'withdrawn');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ==================== LOOT POOLS ====================
    await queryRunner.query(`
      CREATE TABLE "loot_pools" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "name" varchar(255) NOT NULL,
        "description" text,
        "activityId" uuid NOT NULL,
        "missionId" uuid,
        "lfgSessionId" varchar(255),
        "status" "loot_pools_status_enum" NOT NULL DEFAULT 'open',
        "distributionMethod" "loot_pools_distributionmethod_enum" NOT NULL DEFAULT 'need_greed',
        "rules" jsonb,
        "totalValue" numeric(20,2) NOT NULL DEFAULT 0,
        "currency" varchar(10) NOT NULL DEFAULT 'aUEC',
        "leaderId" varchar NOT NULL,
        "createdBy" varchar NOT NULL,
        "distributedAt" timestamp,
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loot_pools" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loot_pools_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_pools_org_status" ON "loot_pools" ("organizationId", "status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_pools_org_activity" ON "loot_pools" ("organizationId", "activityId")`
    );

    // ==================== LOOT ITEMS ====================
    await queryRunner.query(`
      CREATE TABLE "loot_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "lootPoolId" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "category" "loot_items_category_enum" NOT NULL DEFAULT 'other',
        "quantity" integer NOT NULL DEFAULT 1,
        "unitValue" numeric(20,2) NOT NULL DEFAULT 0,
        "totalValue" numeric(20,2) NOT NULL DEFAULT 0,
        "status" "loot_items_status_enum" NOT NULL DEFAULT 'available',
        "source" "loot_items_source_enum" NOT NULL DEFAULT 'manual',
        "awardedToUserId" varchar,
        "imageUrl" varchar(1000),
        "metadata" jsonb,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loot_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loot_items_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loot_items_pool" FOREIGN KEY ("lootPoolId")
          REFERENCES "loot_pools"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_items_org_pool" ON "loot_items" ("organizationId", "lootPoolId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_items_pool_status" ON "loot_items" ("lootPoolId", "status")`
    );

    // ==================== LOOT CLAIMS ====================
    await queryRunner.query(`
      CREATE TABLE "loot_claims" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "lootPoolId" uuid NOT NULL,
        "lootItemId" uuid NOT NULL,
        "userId" varchar NOT NULL,
        "userName" varchar(255) NOT NULL,
        "claimType" "loot_claims_claimtype_enum" NOT NULL DEFAULT 'roll',
        "bidAmount" numeric(20,2),
        "rollValue" integer,
        "status" "loot_claims_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loot_claims" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_loot_claim_item_user" UNIQUE ("lootItemId", "userId"),
        CONSTRAINT "FK_loot_claims_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loot_claims_pool" FOREIGN KEY ("lootPoolId")
          REFERENCES "loot_pools"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loot_claims_item" FOREIGN KEY ("lootItemId")
          REFERENCES "loot_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_claims_org_pool" ON "loot_claims" ("organizationId", "lootPoolId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_loot_claims_item_status" ON "loot_claims" ("lootItemId", "status")`
    );

    // ==================== PERMISSION ENUM ====================
    // Add 'loot' to the OrganizationPermission resource enum so loot routes can
    // be permission-checked without triggering enum errors.
    const lootExists = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = $1
        AND enumtypid = (
          SELECT oid FROM pg_type
          WHERE typname = 'organization_permissions_resource_enum'
        )
      ) AS exists
    `,
      ['loot']
    );
    if (!lootExists?.[0]?.exists) {
      await queryRunner.query(`
        ALTER TYPE "organization_permissions_resource_enum"
        ADD VALUE IF NOT EXISTS 'loot'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loot_claims"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loot_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loot_pools"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_claims_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_claims_claimtype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_items_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_items_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_items_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_pools_distributionmethod_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "loot_pools_status_enum"`);
    // PostgreSQL cannot remove the 'loot' enum value; left in place.
  }
}
