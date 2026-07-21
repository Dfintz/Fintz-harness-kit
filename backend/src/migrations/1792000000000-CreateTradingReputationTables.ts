import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 20-D: Create trading reputation tables.
 *
 * - trade_transactions: Per-user trade run records with profit attribution
 * - trade_user_reputation: Aggregated trading reputation scores per user
 */
export class CreateTradingReputationTables1792000000000 implements MigrationInterface {
  name = 'CreateTradingReputationTables1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── trade_transactions ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "trade_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "routeId" character varying NOT NULL,
        "userId" character varying NOT NULL,
        "fleetId" character varying,
        "organizationId" character varying NOT NULL,
        "successStatus" character varying NOT NULL DEFAULT 'completed',
        "estimatedProfit" numeric(15,2) NOT NULL DEFAULT 0,
        "actualProfit" numeric(15,2) NOT NULL DEFAULT 0,
        "durationMinutes" integer NOT NULL DEFAULT 0,
        "executedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "completedAt" TIMESTAMP,
        CONSTRAINT "PK_trade_transactions" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_userId" ON "trade_transactions" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_routeId" ON "trade_transactions" ("routeId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_organizationId" ON "trade_transactions" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_userId_orgId" ON "trade_transactions" ("userId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_routeId_orgId" ON "trade_transactions" ("routeId", "organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_transactions_orgId_executedAt" ON "trade_transactions" ("organizationId", "executedAt")`
    );

    // ── trade_user_reputation ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "trade_user_reputation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "totalRuns" integer NOT NULL DEFAULT 0,
        "successfulRuns" integer NOT NULL DEFAULT 0,
        "failedRuns" integer NOT NULL DEFAULT 0,
        "abortedRuns" integer NOT NULL DEFAULT 0,
        "successRate" numeric(5,2) NOT NULL DEFAULT 0,
        "totalProfitGenerated" numeric(15,2) NOT NULL DEFAULT 0,
        "avgProfitPerRun" numeric(15,2) NOT NULL DEFAULT 0,
        "avgEstimateAccuracy" numeric(5,2) NOT NULL DEFAULT 0,
        "profitConsistency" numeric(5,2) NOT NULL DEFAULT 50,
        "routeStats" text,
        "currentSuccessStreak" integer NOT NULL DEFAULT 0,
        "longestSuccessStreak" integer NOT NULL DEFAULT 0,
        "overallScore" numeric(5,2) NOT NULL DEFAULT 50,
        "lastRunAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trade_user_reputation" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_trade_user_reputation_userId" ON "trade_user_reputation" ("userId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_user_reputation_overallScore" ON "trade_user_reputation" ("overallScore")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_trade_user_reputation_totalRuns" ON "trade_user_reputation" ("totalRuns")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_user_reputation_totalRuns"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_user_reputation_overallScore"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_user_reputation_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trade_user_reputation"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_orgId_executedAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_routeId_orgId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_userId_orgId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_organizationId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_routeId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_trade_transactions_userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "trade_transactions"`);
  }
}
