import { type ObjectLiteral, SelectQueryBuilder } from 'typeorm';

import { logger } from '../logger';

/**
 * Whether the current database connection supports tsvector full-text search.
 * Cached after first check to avoid repeated connection introspection.
 */
let _isPostgres: boolean | null = null;

/**
 * Check connection type from a query builder. Cached after first call.
 */
function isPostgres<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>): boolean {
  if (_isPostgres === null) {
    _isPostgres = qb.connection.options.type === 'postgres';
    if (!_isPostgres) {
      logger.debug('Non-PostgreSQL database detected — full-text search will use ILIKE fallback');
    }
  }
  return _isPostgres;
}

/** Reset cached connection type (for tests) */
export function resetFullTextSearchCache(): void {
  _isPostgres = null;
}

/**
 * Add full-text search to a TypeORM query builder.
 *
 * Uses PostgreSQL tsvector `@@` operator with `ts_rank` for relevance ordering.
 * Falls back to ILIKE on the specified columns when running on non-PostgreSQL
 * databases (e.g. SQLite in tests).
 *
 * @param qb - The query builder to modify (mutated in place)
 * @param alias - Table alias (e.g. 'user', 'activity')
 * @param searchTerm - Raw user input (sanitized internally)
 * @param ilikeColumns - Columns for ILIKE fallback (e.g. ['username', 'displayName'])
 * @param vectorColumn - Name of the tsvector column (default: 'search_vector')
 * @param paramSuffix - Unique suffix to avoid parameter name collisions (default: 'fts')
 * @returns true if tsvector was applied, false if ILIKE fallback was used
 *
 * @example
 * ```typescript
 * const qb = repo.createQueryBuilder('user');
 * addFullTextSearch(qb, 'user', query, ['username', 'displayName', 'email']);
 * const results = await qb.getMany();
 * ```
 */
export function addFullTextSearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  searchTerm: string,
  ilikeColumns: string[],
  vectorColumn: string = 'search_vector',
  paramSuffix: string = 'fts'
): boolean {
  const sanitized = searchTerm.replaceAll(/[^a-zA-Z0-9\s-]/g, '').trim();
  if (!sanitized) {
    return false;
  }

  // Build tsquery: split words and join with & (AND)
  const words = sanitized.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return false;
  }

  // Non-PostgreSQL: use ILIKE fallback (e.g. SQLite in tests)
  if (!isPostgres(qb)) {
    addIlikeSearch(qb, alias, sanitized, ilikeColumns, paramSuffix);
    return false;
  }

  // For short words (2-3 chars), use prefix matching (:*)
  // Skip single chars to avoid overly broad results
  const tsquery = words
    .map(w => (w.length >= 2 && w.length <= 3 ? `${w}:*` : w))
    .join(' & ');

  qb.andWhere(
    `${alias}.${vectorColumn} @@ to_tsquery('english', :tsquery_${paramSuffix})`,
    { [`tsquery_${paramSuffix}`]: tsquery }
  );
  qb.addOrderBy(
    `ts_rank(${alias}.${vectorColumn}, to_tsquery('english', :tsquery_${paramSuffix}))`,
    'DESC'
  );
  return true;
}

/**
 * Add ILIKE search across multiple columns (OR-joined).
 * Used as the fallback when tsvector is unavailable, and also
 * available standalone for Tier 2 (internal/admin) queries.
 */
export function addIlikeSearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  searchTerm: string,
  columns: string[],
  paramSuffix: string = 'ilike'
): void {
  if (!searchTerm.trim() || columns.length === 0) {
    return;
  }

  const conditions = columns
    .map(col => `${alias}.${col} ILIKE :search_${paramSuffix}`)
    .join(' OR ');

  qb.andWhere(`(${conditions})`, {
    [`search_${paramSuffix}`]: `%${searchTerm}%`,
  });
}
