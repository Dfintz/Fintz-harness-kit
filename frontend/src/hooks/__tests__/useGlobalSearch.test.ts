import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { act, renderHook, waitFor } from '@testing-library/react';

describe('useGlobalSearch', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useGlobalSearch());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('opens search modal', () => {
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('closes search modal and resets state', () => {
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.open();
      result.current.setQuery('test');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.query).toBe('test');

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
  });

  it('updates query', () => {
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.setQuery('dashboard');
    });

    expect(result.current.query).toBe('dashboard');
  });

  it('performs search with default search function', async () => {
    const { result } = renderHook(() =>
      useGlobalSearch({
        debounceMs: 100,
      })
    );

    act(() => {
      result.current.setQuery('dashboard');
    });

    await waitFor(
      () => {
        expect(result.current.results.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    const dashboardResult = result.current.results.find(r =>
      r.title.toLowerCase().includes('dashboard')
    );
    expect(dashboardResult).toBeDefined();
  });

  it('uses canonical fleet ships route in default page results', async () => {
    const { result } = renderHook(() =>
      useGlobalSearch({
        debounceMs: 100,
      })
    );

    act(() => {
      result.current.setQuery('ships');
    });

    await waitFor(
      () => {
        expect(result.current.results.length).toBeGreaterThan(0);
      },
      { timeout: 500 }
    );

    const shipsPage = result.current.results.find(
      item => item.type === 'page' && item.title.toLowerCase().includes('ships')
    );

    expect(shipsPage?.url).toBe('/fleet/ships');
  });

  it('uses custom search function when provided', async () => {
    const mockSearchFn = jest.fn().mockResolvedValue([
      {
        id: '1',
        type: 'ship' as const,
        title: 'Carrack',
        subtitle: 'Exploration ship',
      },
    ]);

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.setQuery('carrack');
    });

    await waitFor(
      () => {
        expect(mockSearchFn).toHaveBeenCalledWith('carrack');
      },
      { timeout: 300 }
    );

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
      expect(result.current.results[0].title).toBe('Carrack');
    });
  });

  it('limits results to maxResults', async () => {
    const mockSearchFn = jest.fn().mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        type: 'ship' as const,
        title: `Ship ${i}`,
      }))
    );

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        maxResults: 5,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.setQuery('ship');
    });

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(5);
      },
      { timeout: 300 }
    );
  });

  it('groups results by category', async () => {
    const mockSearchFn = jest.fn().mockResolvedValue([
      { id: '1', type: 'ship' as const, title: 'Ship 1' },
      { id: '2', type: 'fleet' as const, title: 'Fleet 1' },
      { id: '3', type: 'ship' as const, title: 'Ship 2' },
    ]);

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(
      () => {
        expect(result.current.categories.length).toBeGreaterThan(0);
      },
      { timeout: 300 }
    );

    const shipCategory = result.current.categories.find(c => c.id === 'ship');
    expect(shipCategory?.results).toHaveLength(2);

    const fleetCategory = result.current.categories.find(c => c.id === 'fleet');
    expect(fleetCategory?.results).toHaveLength(1);
  });

  it('handles keyboard navigation - ArrowDown', async () => {
    const mockSearchFn = jest.fn().mockResolvedValue([
      { id: '1', type: 'page' as const, title: 'Page 1' },
      { id: '2', type: 'page' as const, title: 'Page 2' },
      { id: '3', type: 'page' as const, title: 'Page 3' },
    ]);

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.open();
      result.current.setQuery('page');
    });

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(3);
      },
      { timeout: 300 }
    );

    expect(result.current.selectedIndex).toBe(0);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      document.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.selectedIndex).toBe(1);
    });
  });

  it('handles keyboard navigation - ArrowUp', async () => {
    const mockSearchFn = jest.fn().mockResolvedValue([
      { id: '1', type: 'page' as const, title: 'Page 1' },
      { id: '2', type: 'page' as const, title: 'Page 2' },
    ]);

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.open();
      result.current.setQuery('page');
    });

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(2);
      },
      { timeout: 300 }
    );

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      document.dispatchEvent(event);
    });

    await waitFor(() => {
      expect(result.current.selectedIndex).toBe(1);
    });
  });

  it('saves selected result to recent searches', () => {
    const { result } = renderHook(() => useGlobalSearch());

    const testResult = {
      id: '1',
      type: 'page' as const,
      title: 'Dashboard',
      url: '/dashboard',
    };

    act(() => {
      result.current.selectResult(testResult);
    });

    const saved = localStorage.getItem('global-search-recent');
    expect(saved).toBeTruthy();
    if (saved === null) {
      throw new Error('Expected saved recent searches');
    }
    const parsed = JSON.parse(saved);
    expect(parsed).toContain('Dashboard');
  });

  it('limits recent searches to max count', () => {
    const { result } = renderHook(() => useGlobalSearch());

    for (let i = 0; i < 10; i++) {
      act(() => {
        result.current.selectResult({
          id: `${i}`,
          type: 'page' as const,
          title: `Page ${i}`,
          url: `/page-${i}`,
        });
      });
    }

    expect(result.current.recentSearches.length).toBeLessThanOrEqual(5);
  });

  it('clears recent searches', () => {
    const { result } = renderHook(() => useGlobalSearch());

    act(() => {
      result.current.selectResult({
        id: '1',
        type: 'page' as const,
        title: 'Test Page',
        url: '/test',
      });
    });

    expect(result.current.recentSearches.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearRecentSearches();
    });

    expect(result.current.recentSearches).toEqual([]);
    expect(localStorage.getItem('global-search-recent')).toBeNull();
  });

  it('executes result action when selected', () => {
    const mockAction = jest.fn();
    const { result } = renderHook(() => useGlobalSearch());

    const testResult = {
      id: '1',
      type: 'page' as const,
      title: 'Custom Action',
      action: mockAction,
    };

    act(() => {
      result.current.selectResult(testResult);
    });

    expect(mockAction).toHaveBeenCalled();
  });

  it('handles search errors gracefully', async () => {
    const mockSearchFn = jest.fn().mockRejectedValue(new Error('Search failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.setQuery('error');
    });

    await waitFor(
      () => {
        expect(mockSearchFn).toHaveBeenCalled();
      },
      { timeout: 300 }
    );

    await waitFor(() => {
      expect(result.current.results).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    // Note: console.error is called for the error log
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[ERROR] Search error:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('does not perform search for empty query', async () => {
    const mockSearchFn = jest.fn();
    const { result } = renderHook(() =>
      useGlobalSearch({
        searchFn: mockSearchFn,
        debounceMs: 50,
      })
    );

    act(() => {
      result.current.setQuery('');
    });

    await waitFor(
      () => {
        expect(mockSearchFn).not.toHaveBeenCalled();
      },
      { timeout: 300 }
    );

    expect(result.current.results).toEqual([]);
  });
});
