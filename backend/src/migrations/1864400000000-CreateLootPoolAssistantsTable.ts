import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Promotes loot assistant managers to a first-class table with relational
 * integrity and uniqueness constraints.
 */
export class CreateLootPoolAssistantsTable1864400000000 implements MigrationInterface {
  name = 'CreateLootPoolAssistantsTable1864400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "loot_pool_assistants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "lootPoolId" uuid NOT NULL,
        "userId" varchar(255) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loot_pool_assistants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_loot_pool_assistants_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_loot_pool_assistants_pool" FOREIGN KEY ("lootPoolId")
          REFERENCES "loot_pools"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_loot_pool_assistants_pool_user" UNIQUE ("lootPoolId", "userId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_loot_pool_assistants_org_pool"
      ON "loot_pool_assistants" ("organizationId", "lootPoolId")
    `);

    await queryRunner.query(`
      INSERT INTO "loot_pool_assistants" ("organizationId", "lootPoolId", "userId")
      SELECT
        pool."organizationId",
        pool."id",
        assistant."userId"
      FROM "loot_pools" pool
      CROSS JOIN LATERAL (
        SELECT value AS "userId"
        FROM jsonb_array_elements_text(COALESCE(pool."metadata"->'assistantUserIds', '[]'::jsonb))
      ) assistant
      WHERE assistant."userId" IS NOT NULL
        AND assistant."userId" <> ''
        AND assistant."userId" <> pool."leaderId"
        AND assistant."userId" <> pool."createdBy"
      ON CONFLICT ("lootPoolId", "userId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "loot_pool_assistants"`);
  }
}
