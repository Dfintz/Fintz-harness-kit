import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add tsvector GENERATED columns + GIN indexes for full-text search.
 *
 * Replaces ILIKE patterns on high-traffic user-facing search endpoints
 * with PostgreSQL native full-text search (ts_rank + ts_vector + GIN).
 *
 * Entities covered (Tier 1 — user-facing, high-traffic):
 * - users       → username, "displayName" (email excluded — encrypted PII)
 * - activities   → title, description
 * - organizations → name, description
 * - user_ships   → "shipName", "customName", notes
 * - ships (catalog) → name, manufacturer
 * - bounties     → title, description, "targetName"
 * - public_job_listings → title, description
 * - missions     → title, description, location
 * - fleets       → name
 *
 * Pattern: GENERATED ALWAYS … STORED columns auto-update on INSERT/UPDATE.
 * No triggers needed — PostgreSQL maintains them automatically.
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — P9 / B4 / J4
 */
export class AddFullTextSearchVectors1848000000000 implements MigrationInterface {
  name = 'AddFullTextSearchVectors1848000000000';

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
    // Skip for non-PostgreSQL (SQLite tests)
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    // ── 1. users ──────────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'users',
      'search_vector',
      [
        { column: 'username', weight: 'A' },
        { column: 'displayName', weight: 'A' },
      ],
      'idx_users_search'
    );

    // ── 2. activities ─────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'activities',
      'search_vector',
      [
        { column: 'title', weight: 'A' },
        { column: 'description', weight: 'B' },
      ],
      'idx_activities_search'
    );

    // ── 3. organizations ──────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'organizations',
      'search_vector',
      [
        { column: 'name', weight: 'A' },
        { column: 'description', weight: 'B' },
      ],
      'idx_organizations_search'
    );

    // ── 4. user_ships ─────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'user_ships',
      'search_vector',
      [
        { column: 'shipName', weight: 'A' },
        { column: 'customName', weight: 'A' },
        { column: 'notes', weight: 'B' },
      ],
      'idx_user_ships_search'
    );

    // ── 5. ships (catalog) ────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'ships',
      'search_vector',
      [
        { column: 'name', weight: 'A' },
        { column: 'manufacturer', weight: 'B' },
      ],
      'idx_ships_search'
    );

    // ── 6. bounties ───────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'bounties',
      'search_vector',
      [
        { column: 'title', weight: 'A' },
        { column: 'description', weight: 'B' },
        { column: 'targetName', weight: 'A' },
      ],
      'idx_bounties_search'
    );

    // ── 7. public_job_listings ────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'public_job_listings',
      'search_vector',
      [
        { column: 'title', weight: 'A' },
        { column: 'description', weight: 'B' },
      ],
      'idx_public_job_listings_search'
    );

    // ── 8. missions ───────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'missions',
      'search_vector',
      [
        { column: 'title', weight: 'A' },
        { column: 'description', weight: 'B' },
        { column: 'location', weight: 'A' },
      ],
      'idx_missions_search'
    );

    // ── 9. fleets ─────────────────────────────────────────────────
    await this.addSearchVector(
      queryRunner,
      'fleets',
      'search_vector',
      [{ column: 'name', weight: 'A' }],
      'idx_fleets_search'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbType = queryRunner.connection.options.type;
    if (dbType !== 'postgres') {
      return;
    }

    const tables = [
      { table: 'users', index: 'idx_users_search' },
      { table: 'activities', index: 'idx_activities_search' },
      { table: 'organizations', index: 'idx_organizations_search' },
      { table: 'user_ships', index: 'idx_user_ships_search' },
      { table: 'ships', index: 'idx_ships_search' },
      { table: 'bounties', index: 'idx_bounties_search' },
      { table: 'public_job_listings', index: 'idx_public_job_listings_search' },
      { table: 'missions', index: 'idx_missions_search' },
      { table: 'fleets', index: 'idx_fleets_search' },
    ];

    for (const { table, index } of tables) {
      await queryRunner.query(`DROP INDEX IF EXISTS ${index};`);
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS search_vector;`);
    }
  }

  /**
   * Add a GENERATED ALWAYS tsvector column + GIN index to a table.
   * Idempotent — skips if column already exists.
   */
  private async addSearchVector(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    fields: Array<{ column: string; weight: 'A' | 'B' | 'C' | 'D' }>,
    indexName: string
  ): Promise<void> {
    const weightedExpressions: string[] = [];
    for (const field of fields) {
      const resolvedColumn = await this.resolveColumnName(queryRunner, table, field.column);
      if (!resolvedColumn) {
        continue;
      }

      weightedExpressions.push(
        `setweight(to_tsvector('english', coalesce(${this.quoteIdentifier(resolvedColumn)}, '')), '${field.weight}')`
      );
    }

    if (weightedExpressions.length === 0) {
      return;
    }

    const expression = weightedExpressions.join(' || ');
    const quotedTable = this.quoteIdentifier(table);
    const quotedColumn = this.quoteIdentifier(column);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'
        ) THEN
          ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} tsvector
            GENERATED ALWAYS AS (${expression}) STORED;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)}
        ON ${quotedTable} USING GIN (${quotedColumn});
    `);
  }
}
