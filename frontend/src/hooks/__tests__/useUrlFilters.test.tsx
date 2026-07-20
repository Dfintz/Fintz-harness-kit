/**
 * Tests for the useUrlFilters hook (URL-backed filter & pagination state).
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import { useUrlFilters } from '@/hooks/useUrlFilters';

interface TestFilters {
  status: 'all' | 'open' | 'closed';
  search: string;
  page: number;
  pageSize: number;
}

const defaults: TestFilters = {
  status: 'all',
  search: '',
  page: 1,
  pageSize: 25,
};

function parse(params: URLSearchParams): TestFilters {
  return {
    status: (params.get('status') as TestFilters['status']) ?? defaults.status,
    search: params.get('search') ?? defaults.search,
    page: params.get('page') ? Number(params.get('page')) : defaults.page,
    pageSize: params.get('pageSize') ? Number(params.get('pageSize')) : defaults.pageSize,
  };
}

function renderWithRouter(initialEntry: string) {
  let location: ReturnType<typeof useLocation> | undefined;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationCapture onChange={l => (location = l)} />
      {children}
    </MemoryRouter>
  );

  const result = renderHook(
    () =>
      useUrlFilters<TestFilters>({
        parse,
        defaults,
        paginationKeys: ['page', 'pageSize'] as const,
      }),
    { wrapper }
  );

  return { ...result, getLocation: () => location };
}

function LocationCapture({ onChange }: { onChange: (l: ReturnType<typeof useLocation>) => void }) {
  const location = useLocation();
  React.useEffect(() => {
    onChange(location);
  }, [location, onChange]);
  return null;
}

describe('useUrlFilters', () => {
  it('returns parsed defaults when URL has no search params', () => {
    const { result } = renderWithRouter('/page');
    expect(result.current.filters).toEqual(defaults);
  });

  it('parses initial values from the URL', () => {
    const { result } = renderWithRouter('/page?status=open&search=alpha&page=3');
    expect(result.current.filters).toMatchObject({
      status: 'open',
      search: 'alpha',
      page: 3,
    });
  });

  it('writes a non-default value to the URL', () => {
    const { result, getLocation } = renderWithRouter('/page');
    act(() => {
      result.current.updateFilters({ status: 'open' });
    });
    expect(getLocation()?.search).toBe('?status=open');
  });

  it('removes a key from the URL when patched back to default', () => {
    const { result, getLocation } = renderWithRouter('/page?status=open');
    act(() => {
      result.current.updateFilters({ status: 'all' });
    });
    expect(getLocation()?.search).toBe('');
  });

  it('removes a key when patched to undefined or empty string', () => {
    const { result, getLocation } = renderWithRouter('/page?search=alpha');
    act(() => {
      result.current.updateFilters({ search: '' });
    });
    expect(getLocation()?.search).toBe('');
  });

  it('clears pagination keys when a non-pagination key changes', () => {
    const { result, getLocation } = renderWithRouter('/page?page=4&pageSize=50');
    act(() => {
      result.current.updateFilters({ status: 'open' });
    });
    const search = getLocation()?.search ?? '';
    expect(search).toContain('status=open');
    expect(search).not.toContain('page=');
    expect(search).not.toContain('pageSize=');
  });

  it('does NOT clear pagination keys when only a pagination key changes', () => {
    const { result, getLocation } = renderWithRouter('/page?page=2');
    act(() => {
      result.current.updateFilters({ page: 5 });
    });
    expect(getLocation()?.search).toBe('?page=5');
  });

  it('drops non-primitive values rather than serializing them', () => {
    const { result, getLocation } = renderWithRouter('/page');
    act(() => {
      // @ts-expect-error — exercising the runtime guard for non-primitives
      result.current.updateFilters({ search: { nested: true } });
    });
    expect(getLocation()?.search ?? '').not.toContain('search=');
  });
});
