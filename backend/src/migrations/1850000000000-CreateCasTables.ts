import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create CAS (Composite Activity Score) tables:
 * - org_activity_scores: persisted CAS snapshots (90-day retention)
 * - org_activity_heatmaps: hourly activity samples (14-day retention)
 *
 * @see docs/CAS_ARCHITECTURE_BRIEF.md
 */
export class CreateCasTables1850000000000 implements MigrationInterface {
  name = 'CreateCasTables1850000000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [tableName, desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    // ── org_activity_scores ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS org_activity_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" VARCHAR(255) NOT NULL,
        score DECIMAL(5,2) NOT NULL DEFAULT 0,
        tier VARCHAR(20) NOT NULL DEFAULT 'DORMANT',
        breakdown JSONB NOT NULL DEFAULT '{}',
        "memberCount" INT NOT NULL DEFAULT 0,
        "computedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_oas_org_date
        ON org_activity_scores ("organizationId", "computedAt" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_oas_score
        ON org_activity_scores (score DESC) WHERE score IS NOT NULL;
    `);

    // ── org_activity_heatmaps ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS org_activity_heatmaps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId" VARCHAR(255) NOT NULL,
        "dayOfWeek" SMALLINT NOT NULL,
        hour SMALLINT NOT NULL,
        "presenceCount" INT NOT NULL DEFAULT 0,
        "siteActiveCount" INT NOT NULL DEFAULT 0,
        "rawScore" DECIMAL(8,2) NOT NULL DEFAULT 0,
        "memberCount" INT NOT NULL DEFAULT 0,
        "sampledAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_oah_org_sampled
        ON org_activity_heatmaps ("organizationId", "sampledAt" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_oah_org_cell
        ON org_activity_heatmaps ("organizationId", "dayOfWeek", hour);
    `);

    // ── guild_organizations index (if not exists) ─────────────────
    const guildIdColumn = await this.resolveColumnName(
      queryRunner,
      'guild_organizations',
      'guildId'
    );
    if (guildIdColumn) {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier('idx_guild_org_guild')} ON ${this.quoteIdentifier('guild_organizations')} (${this.quoteIdentifier(guildIdColumn)})`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    await queryRunner.query(`DROP TABLE IF EXISTS org_activity_heatmaps;`);
    await queryRunner.query(`DROP TABLE IF EXISTS org_activity_scores;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_guild_org_guild;`);
  }
}
