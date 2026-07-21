import { MoreThan } from 'typeorm';

import { findInBatches, DEFAULT_FIND_BATCH_SIZE } from '../../../utils/query/findInBatches';

interface Row {
  id: string;
  status?: string;
}

/**
 * PERF-03: findInBatches must iterate ALL rows in bounded keyset batches
 * (WHERE cursor > :last ORDER BY cursor ASC), never loading the whole table at
 * once, and must terminate when a short batch is returned.
 */
describe('findInBatches (PERF-03 keyset batch iteration)', () => {
  /**
   * Build a mock repository whose `find` serves rows from `data` using the
   * keyset cursor in the supplied options, mimicking real DB semantics so the
   * helper's pagination logic is exercised end to end.
   */
  const makeRepo = (data: Row[]) => {
    const find = jest.fn(
      async (opts: {
        where?: Record<string, unknown>;
        order?: Record<string, 'ASC' | 'DESC'>;
        take?: number;
      }) => {
        const take = opts.take ?? DEFAULT_FIND_BATCH_SIZE;
        const cursorCond = opts.where?.id as { value?: string } | undefined;
        // MoreThan(value) serializes to a FindOperator exposing `.value`.
        const after = cursorCond?.value;
        const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));
        const filtered = after ? sorted.filter(r => r.id > after) : sorted;
        return filtered.slice(0, take);
      }
    );
    return { find } as unknown as Parameters<typeof findInBatches>[0] & { find: jest.Mock };
  };

  it('processes every row across multiple batches in cursor order', async () => {
    const data: Row[] = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${String(i).padStart(2, '0')}`,
    }));
    const repo = makeRepo(data);
    const seen: string[] = [];

    const total = await findInBatches(repo, { batchSize: 5 }, batch => {
      for (const row of batch) {
        seen.push((row as Row).id);
      }
    });

    expect(total).toBe(12);
    expect(seen).toHaveLength(12);
    // Cursor order is ascending by id, with no duplicates or gaps.
    expect(seen).toEqual(data.map(r => r.id));
    // 12 rows / 5 per batch → batches of 5, 5, 2 = 3 find calls.
    expect(repo.find).toHaveBeenCalledTimes(3);
  });

  it('advances the keyset cursor with MoreThan after the first batch', async () => {
    const data: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `id-${i}` }));
    const repo = makeRepo(data);

    await findInBatches(repo, { batchSize: 3 }, () => {});

    // First call has no cursor; the second filters with MoreThan(last id of batch 1).
    const firstCallWhere = repo.find.mock.calls[0][0].where;
    expect(firstCallWhere?.id).toBeUndefined();

    const secondCallWhere = repo.find.mock.calls[1][0].where;
    expect(secondCallWhere?.id).toEqual(MoreThan('id-2'));
  });

  it('stops after a single batch when the table is smaller than the batch size', async () => {
    const data: Row[] = [{ id: 'a' }, { id: 'b' }];
    const repo = makeRepo(data);

    const total = await findInBatches(repo, { batchSize: 500 }, () => {});

    expect(total).toBe(2);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and never invokes the handler for an empty table', async () => {
    const repo = makeRepo([]);
    const handler = jest.fn();

    const total = await findInBatches(repo, {}, handler);

    expect(total).toBe(0);
    expect(handler).not.toHaveBeenCalled();
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default batch size when given a non-positive value', async () => {
    const data: Row[] = [{ id: 'a' }, { id: 'b' }];
    const repo = makeRepo(data);

    await findInBatches(repo, { batchSize: 0 }, () => {});

    expect(repo.find.mock.calls[0][0].take).toBe(DEFAULT_FIND_BATCH_SIZE);
  });

  it('awaits async handlers before fetching the next batch', async () => {
    const data: Row[] = Array.from({ length: 4 }, (_, i) => ({ id: `id-${i}` }));
    const repo = makeRepo(data);
    const order: string[] = [];

    await findInBatches(repo, { batchSize: 2 }, async batch => {
      order.push(`start-${(batch[0] as Row).id}`);
      await Promise.resolve();
      order.push(`end-${(batch[0] as Row).id}`);
    });

    // Each batch's handler fully resolves before the next batch starts.
    expect(order).toEqual(['start-id-0', 'end-id-0', 'start-id-2', 'end-id-2']);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
