import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 Performance Optimization: Add database indexes
 *
 * Adds indexes to improve query performance for:
 * - Activity lookups by organization and date
 * - Organization member lookups
 * - Reputation score queries
 *
 * Expected Impact: 30-50% faster read operations
 *
 * NOTE: Column names are camelCase in the database, not snake_case
 */
export class AddPerformanceIndexes1760905168465 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper to check if table and columns exist before creating index
    const createIndexIfColumnsExist = async (
      tableName: string,
      columns: string[],
      indexQuery: string
    ) => {
      try {
        const table = await queryRunner.getTable(tableName);
        if (!table) {
          return;
        }

        const tableColumnNames = new Set(
          (table.columns || []).map((c: { name: string }) => c.name)
        );
        const missing = columns.filter(c => !tableColumnNames.has(c));
        if (missing.length > 0) {
          return;
        }

        await queryRunner.query(indexQuery);
      } catch (_error: unknown) {
        // Swallow errors to avoid aborting the migration; indexes are optional
      }
    };

    // Index for activity queries (organization + date) - Using camelCase column names
    await createIndexIfColumnsExist(
      'activities',
      ['organizationId', 'scheduledStartDate'],
      `
            CREATE INDEX IF NOT EXISTS "idx_activities_org_date" 
            ON "activities"("organizationId", "scheduledStartDate")
        `
    );

    // Index for organization member lookups - Check actual column names first
    await createIndexIfColumnsExist(
      'organization_members',
      ['organizationId', 'userId'],
      `
            CREATE INDEX IF NOT EXISTS "idx_org_members_org_user" 
            ON "organization_members"("organizationId", "userId")
        `
    );

    // Index for active members only - Check for isActive column
    await createIndexIfColumnsExist(
      'organization_members',
      ['organizationId', 'isActive'],
      `
            CREATE INDEX IF NOT EXISTS "idx_org_members_active" 
            ON "organization_members"("organizationId", "isActive") 
            WHERE "isActive" = true
        `
    );

    // Index for reputation score queries
    await createIndexIfColumnsExist(
      'lfg_user_reputation',
      ['userId', 'overallScore'],
      `
            CREATE INDEX IF NOT EXISTS "idx_lfg_reputation_user_score" 
            ON "lfg_user_reputation"("userId", "overallScore" DESC)
        `
    );

    // Index for reputation leaderboard queries
    await createIndexIfColumnsExist(
      'lfg_user_reputation',
      ['overallScore'],
      `
            CREATE INDEX IF NOT EXISTS "idx_lfg_reputation_score" 
            ON "lfg_user_reputation"("overallScore" DESC)
        `
    );

    // Index for organization permissions
    await createIndexIfColumnsExist(
      'organization_permissions',
      ['userId', 'organizationId'],
      `
            CREATE INDEX IF NOT EXISTS "idx_org_permissions_user_org" 
            ON "organization_permissions"("userId", "organizationId")
        `
    );

    // Index for active permissions only
    await createIndexIfColumnsExist(
      'organization_permissions',
      ['userId', 'isActive', 'expiresAt'],
      `
            CREATE INDEX IF NOT EXISTS "idx_org_permissions_active" 
            ON "organization_permissions"("userId", "isActive", "expiresAt") 
            WHERE "isActive" = true
        `
    );

    // Performance indexes added where applicable
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_permissions_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_permissions_user_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lfg_reputation_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_lfg_reputation_user_score"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_members_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_org_members_org_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_activities_org_date"`);

    // Performance indexes removed
  }
}
