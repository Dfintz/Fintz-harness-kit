import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 25 B-1: Treasury Tables
 *
 * Creates credit_pools, credit_transactions, org_dues, commissary_items,
 * and commissary_purchases for the organization treasury system.
 */
export class CreateTreasuryTables1796000000000 implements MigrationInterface {
  name = 'CreateTreasuryTables1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Credit Pools
    await queryRunner.query(`
      CREATE TABLE "credit_pools" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "balance" numeric(20,2) NOT NULL DEFAULT 0,
        "currency" varchar(20) NOT NULL DEFAULT 'aUEC',
        "lastTransactionAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_credit_pools" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_pools_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_credit_pools_org" ON "credit_pools" ("organizationId")`
    );

    // 2. Credit Transactions
    await queryRunner.query(`
      CREATE TABLE "credit_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "creditPoolId" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "amount" numeric(20,2) NOT NULL,
        "balance" numeric(20,2) NOT NULL,
        "description" varchar(500) NOT NULL,
        "category" varchar(100),
        "fromUserId" varchar,
        "toUserId" varchar,
        "metadata" jsonb,
        "createdBy" varchar NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_credit_transactions_pool" FOREIGN KEY ("creditPoolId")
          REFERENCES "credit_pools"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_credit_transactions_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_txn_org_date" ON "credit_transactions" ("organizationId", "createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_txn_pool" ON "credit_transactions" ("creditPoolId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_txn_from" ON "credit_transactions" ("fromUserId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_txn_to" ON "credit_transactions" ("toUserId")`
    );

    // 3. Org Dues
    await queryRunner.query(`
      CREATE TABLE "org_dues" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "name" varchar(255) NOT NULL,
        "amount" numeric(20,2) NOT NULL,
        "frequency" varchar(20) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "dueDay" integer NOT NULL DEFAULT 1,
        "gracePeriodDays" integer NOT NULL DEFAULT 7,
        "createdBy" varchar NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_dues" PRIMARY KEY ("id"),
        CONSTRAINT "FK_org_dues_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_org_dues_active" ON "org_dues" ("organizationId", "isActive")`
    );

    // 4. Commissary Items
    await queryRunner.query(`
      CREATE TABLE "commissary_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "name" varchar(255) NOT NULL,
        "description" text,
        "price" numeric(20,2) NOT NULL,
        "category" varchar(100) NOT NULL,
        "stock" integer NOT NULL DEFAULT -1,
        "isActive" boolean NOT NULL DEFAULT true,
        "imageUrl" varchar(1000),
        "metadata" jsonb,
        "createdBy" varchar NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_commissary_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_commissary_items_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_commissary_items_active" ON "commissary_items" ("organizationId", "isActive")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commissary_items_category" ON "commissary_items" ("organizationId", "category")`
    );

    // 5. Commissary Purchases
    await queryRunner.query(`
      CREATE TABLE "commissary_purchases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "sharedWithOrgs" text,
        "deletedAt" timestamp,
        "deletedBy" varchar,
        "itemId" uuid NOT NULL,
        "buyerId" varchar NOT NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "totalPrice" numeric(20,2) NOT NULL,
        "transactionId" uuid NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_commissary_purchases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_commissary_purchases_item" FOREIGN KEY ("itemId")
          REFERENCES "commissary_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_commissary_purchases_txn" FOREIGN KEY ("transactionId")
          REFERENCES "credit_transactions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_commissary_purchases_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_commissary_purchases_buyer" ON "commissary_purchases" ("organizationId", "buyerId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_commissary_purchases_item" ON "commissary_purchases" ("itemId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "commissary_purchases" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commissary_items" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "org_dues" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_transactions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credit_pools" CASCADE`);
  }
}
