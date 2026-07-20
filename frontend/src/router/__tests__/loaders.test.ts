/**
 * Tests for createPersonalHangarLoader.
 *
 * Verifies that the loader parses the request URL into filters, hydrates the
 * React Query cache under the same key shape that {@link useUserShips} reads,
 * swallows prefetch errors, and returns the parsed filters to the component.
 */

import { QueryClient } from '@tanstack/react-query';

import { userShipKeys } from '@/hooks/queries/queryKeys';
import { fetchUserShips } from '@/hooks/queries/useUserShipQueries';
import { PERSONAL_HANGAR_FILTER_DEFAULTS } from '@/pages/personalHangarFilters';
import { createPersonalHangarLoader } from '@/router/loaders';

jest.mock('@/hooks/queries/useUserShipQueries', () => ({
  fetchUserShips: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const fetchUserShipsMock = fetchUserShips as jest.MockedFunction<typeof fetchUserShips>;

function makeLoaderArgs(url: string) {
  // The loader only reads `request.url`, so a minimal stub avoids whatwg URL
  // env quirks in jest.
  return {
    request: { url } as unknown as Request,
    params: {},
    context: undefined,
  } as unknown as Parameters<ReturnType<typeof createPersonalHangarLoader>>[0];
}

describe('createPersonalHangarLoader', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchUserShipsMock.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('parses URL search params and returns filters with defaults', async () => {
    fetchUserShipsMock.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
    const loader = createPersonalHangarLoader(queryClient);

    const result = await loader(makeLoaderArgs('http://localhost/hangar'));

    expect(result).toEqual({
      filters: PERSONAL_HANGAR_FILTER_DEFAULTS,
    });
  });

  it('hydrates the React Query cache under the matching userShipKeys.list key', async () => {
    const ships = { items: [], total: 0, page: 2, totalPages: 1 };
    fetchUserShipsMock.mockResolvedValue(ships);
    const loader = createPersonalHangarLoader(queryClient);

    await loader(makeLoaderArgs('http://localhost/hangar?status=owned&page=2&pageSize=50'));

    const expectedQueryFilters = { page: 2, limit: 50, 'filter[status]': 'owned' };
    expect(fetchUserShipsMock).toHaveBeenCalledWith(expectedQueryFilters);

    const cached = queryClient.getQueryData(userShipKeys.list(expectedQueryFilters));
    expect(cached).toEqual(ships);
  });

  it('swallows prefetch errors and still returns parsed filters', async () => {
    fetchUserShipsMock.mockRejectedValue(new Error('boom'));
    const loader = createPersonalHangarLoader(queryClient);

    const result = await loader(makeLoaderArgs('http://localhost/hangar?search=avenger'));

    expect(result).toEqual({
      filters: {
        ...PERSONAL_HANGAR_FILTER_DEFAULTS,
        search: 'avenger',
      },
    });
    // Cache must remain empty on failure so the component-side hook retries.
    expect(
      queryClient.getQueryData(userShipKeys.list({ page: 1, limit: 25, search: 'avenger' }))
    ).toBeUndefined();
  });

  it('falls back to defaults for invalid URL params (status=garbage)', async () => {
    fetchUserShipsMock.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
    const loader = createPersonalHangarLoader(queryClient);

    await loader(makeLoaderArgs('http://localhost/hangar?status=garbage'));

    // Whole schema falls back to defaults → no `status` key in API filters.
    expect(fetchUserShipsMock).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });
});
