/**
 * Tests for the Personal Hangar URL filter schema and query-filter builder.
 */

import {
  buildPersonalHangarQueryFilters,
  parsePersonalHangarFilters,
  PERSONAL_HANGAR_FILTER_DEFAULTS,
  type PersonalHangarFilters,
} from '@/pages/personalHangarFilters';

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('parsePersonalHangarFilters', () => {
  it('returns full defaults for empty params', () => {
    expect(parsePersonalHangarFilters(new URLSearchParams())).toEqual(
      PERSONAL_HANGAR_FILTER_DEFAULTS
    );
  });

  it('parses valid status, condition, search and coerces page/pageSize', () => {
    const params = new URLSearchParams(
      'status=owned&condition=excellent&search=avenger&page=2&pageSize=50'
    );
    expect(parsePersonalHangarFilters(params)).toEqual({
      status: 'owned',
      condition: 'excellent',
      sharingLevel: 'all',
      productionStatus: 'all',
      sortBy: 'createdAt',
      sortOrder: 'DESC',
      search: 'avenger',
      page: 2,
      pageSize: 50,
    });
  });

  it('falls back to defaults when status is invalid', () => {
    const params = new URLSearchParams('status=garbage');
    expect(parsePersonalHangarFilters(params)).toEqual(PERSONAL_HANGAR_FILTER_DEFAULTS);
  });

  it('falls back to defaults when pageSize exceeds the max', () => {
    const params = new URLSearchParams('pageSize=999');
    expect(parsePersonalHangarFilters(params)).toEqual(PERSONAL_HANGAR_FILTER_DEFAULTS);
  });

  it('falls back to defaults when page is non-positive', () => {
    const params = new URLSearchParams('page=0');
    expect(parsePersonalHangarFilters(params)).toEqual(PERSONAL_HANGAR_FILTER_DEFAULTS);
  });
});

describe('buildPersonalHangarQueryFilters', () => {
  const make = (overrides: Partial<PersonalHangarFilters> = {}): PersonalHangarFilters => ({
    ...PERSONAL_HANGAR_FILTER_DEFAULTS,
    ...overrides,
  });

  it('omits status and condition when set to "all"', () => {
    const result = buildPersonalHangarQueryFilters(make());
    expect(result).toEqual({ page: 1, limit: 25 });
    expect(result).not.toHaveProperty('status');
    expect(result).not.toHaveProperty('condition');
    expect(result).not.toHaveProperty('search');
  });

  it('includes status and condition when set to a non-"all" value', () => {
    const result = buildPersonalHangarQueryFilters(make({ status: 'owned', condition: 'damaged' }));
    expect(result).toMatchObject({
      'filter[status]': 'owned',
      'filter[condition]': 'damaged',
      page: 1,
      limit: 25,
    });
  });

  it('trims search and omits when empty after trim', () => {
    expect(buildPersonalHangarQueryFilters(make({ search: '   ' }))).not.toHaveProperty('search');
    expect(buildPersonalHangarQueryFilters(make({ search: '  alpha  ' }))).toMatchObject({
      search: 'alpha',
    });
  });

  it('always emits page and limit (mapped from pageSize)', () => {
    const result = buildPersonalHangarQueryFilters(make({ page: 4, pageSize: 50 }));
    expect(result).toMatchObject({ page: 4, limit: 50 });
  });
});
