import { buildPaginationRow, paginate } from '../paginationControls';

/** Extract the rendered button components from a pagination row (or null). */
function rowButtons(
  row: { toJSON: () => { components: Array<Record<string, unknown>> } } | null
): Array<Record<string, unknown>> {
  return row ? row.toJSON().components : [];
}

describe('paginate', () => {
  const items = Array.from({ length: 23 }, (_, i) => i); // 0..22

  it('returns a single empty page for an empty collection', () => {
    const result = paginate([], 0, 10);
    expect(result).toEqual({ pageItems: [], page: 0, totalPages: 1, total: 0 });
  });

  it('slices the first page and reports totals', () => {
    const result = paginate(items, 0, 10);
    expect(result.pageItems).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result.page).toBe(0);
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(23);
  });

  it('slices a middle page', () => {
    const result = paginate(items, 1, 10);
    expect(result.pageItems).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(result.page).toBe(1);
  });

  it('returns the partial last page', () => {
    const result = paginate(items, 2, 10);
    expect(result.pageItems).toEqual([20, 21, 22]);
    expect(result.page).toBe(2);
  });

  it('clamps a negative page to the first page', () => {
    const result = paginate(items, -5, 10);
    expect(result.page).toBe(0);
    expect(result.pageItems[0]).toBe(0);
  });

  it('clamps an out-of-range page to the last page', () => {
    const result = paginate(items, 99, 10);
    expect(result.page).toBe(2);
    expect(result.pageItems).toEqual([20, 21, 22]);
  });
});

describe('buildPaginationRow', () => {
  const makeCustomId = (p: number) => `ticket_listpage_${p}`;

  it('returns null when there is a single page (no controls needed)', () => {
    expect(buildPaginationRow({ page: 0, totalPages: 1, makeCustomId })).toBeNull();
  });

  it('builds prev/indicator/next with prev disabled on the first page', () => {
    const row = buildPaginationRow({ page: 0, totalPages: 3, makeCustomId });
    const [prev, indicator, next] = rowButtons(row);

    expect(prev.custom_id).toBe('ticket_listpage_-1');
    expect(prev.disabled).toBe(true);

    expect(indicator.label).toBe('Page 1 / 3');
    expect(indicator.disabled).toBe(true);

    expect(next.custom_id).toBe('ticket_listpage_1');
    expect(next.disabled).toBe(false);
  });

  it('disables next on the last page and enables prev', () => {
    const row = buildPaginationRow({ page: 2, totalPages: 3, makeCustomId });
    const [prev, indicator, next] = rowButtons(row);

    expect(prev.custom_id).toBe('ticket_listpage_1');
    expect(prev.disabled).toBe(false);
    expect(indicator.label).toBe('Page 3 / 3');
    expect(next.custom_id).toBe('ticket_listpage_3');
    expect(next.disabled).toBe(true);
  });

  it('enables both prev and next on a middle page', () => {
    const row = buildPaginationRow({ page: 1, totalPages: 3, makeCustomId });
    const [prev, , next] = rowButtons(row);
    expect(prev.disabled).toBe(false);
    expect(next.disabled).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
