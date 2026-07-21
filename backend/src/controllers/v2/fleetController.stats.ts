/** Shape of a raw GROUP BY / COUNT result row */
export interface StatCountResult {
  size?: string;
  role?: string;
  manufacturer?: string;
  career?: string;
  count: string;
}

export const toStatRecord = (
  rows: StatCountResult[],
  key: 'size' | 'role' | 'manufacturer' | 'career'
): Record<string, number> =>
  rows.reduce<Record<string, number>>((acc, curr) => {
    acc[curr[key] ?? 'unknown'] = Number.parseInt(curr.count);
    return acc;
  }, {});
