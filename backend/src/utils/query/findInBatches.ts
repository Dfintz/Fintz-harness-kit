import {
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsWhere,
  MoreThan,
  ObjectLiteral,
  Repository,
} from 'typeorm';

/**
 * Default number of rows loaded per batch when none is supplied.
 */
export const DEFAULT_FIND_BATCH_SIZE = 500;

/**
 * Options for {@link findInBatches}.
 */
export interface FindInBatchesOptions<T extends ObjectLiteral> {
  /** Tenant/domain filter applied to every batch (combined with the keyset cursor). */
  where?: FindOptionsWhere<T>;
  /** Relations to eager-load on each batch row. */
  relations?: FindOptionsRelations<T>;
  /** Rows per batch (defaults to {@link DEFAULT_FIND_BATCH_SIZE}). */
  batchSize?: number;
  /**
   * Unique, orderable column used as the keyset cursor (defaults to `'id'`).
   * Must be a total order over the result set (a primary key satisfies this).
   */
  cursorColumn?: keyof T & string;
}

/**
 * Iterate over **all** rows matching `where` in bounded keyset batches, invoking
 * `handler` once per batch (PERF-03 — replace unbounded full-table `find()` scans
 * that load an entire table into memory at once).
 *
 * Uses keyset pagination on `cursorColumn` (`WHERE cursor > :last ORDER BY cursor ASC`)
 * rather than `OFFSET`, so it stays O(batch) per page and does not drift when rows are
 * inserted during the scan. Memory stays bounded to one batch regardless of table size.
 *
 * Side effects belong in `handler`; this helper performs no mutation itself.
 *
 * @param repository - TypeORM repository to scan
 * @param options - Filter, relations, batch size, and cursor column
 * @param handler - Invoked once per non-empty batch, in cursor order
 * @returns The total number of rows processed across all batches
 */
export async function findInBatches<T extends ObjectLiteral>(
  repository: Repository<T>,
  options: FindInBatchesOptions<T>,
  handler: (batch: T[]) => Promise<void> | void
): Promise<number> {
  const requestedBatchSize = options.batchSize ?? DEFAULT_FIND_BATCH_SIZE;
  const batchSize = requestedBatchSize > 0 ? requestedBatchSize : DEFAULT_FIND_BATCH_SIZE;
  const cursorColumn = (options.cursorColumn ?? 'id') as keyof T & string;
  const baseWhere: FindOptionsWhere<T> = options.where ?? {};

  let processed = 0;
  let cursor: T[keyof T] | undefined;

  for (;;) {
    const where =
      cursor === undefined
        ? baseWhere
        : ({ ...baseWhere, [cursorColumn]: MoreThan(cursor) } as FindOptionsWhere<T>);

    const batch = await repository.find({
      where,
      relations: options.relations,
      order: { [cursorColumn]: 'ASC' } as FindOptionsOrder<T>,
      take: batchSize,
    });

    if (batch.length === 0) {
      break;
    }

    await handler(batch);
    processed += batch.length;

    // A short batch means the table is exhausted.
    if (batch.length < batchSize) {
      break;
    }

    const lastRow = batch.at(-1);
    if (!lastRow) {
      break;
    }
    cursor = lastRow[cursorColumn];
  }

  return processed;
}
