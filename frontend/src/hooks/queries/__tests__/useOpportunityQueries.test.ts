/**
 * Tests for Opportunity Search Query Hook
 * Sprint 19-G: Unified Opportunity Pool
 */

import { useOpportunitySearch } from '@/hooks/queries/useOpportunityQueries';
import {
  OpportunitySearchFilters,
  OpportunitySearchResponse,
  searchOpportunities,
} from '@/services/opportunityService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';

jest.mock('../../../services/opportunityService');

const mockedSearchOpportunities = searchOpportunities as jest.MockedFunction<
  typeof searchOpportunities
>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

const mockResponse: OpportunitySearchResponse = {
  data: [
    {
      id: 'job-1',
      sourceType: 'job',
      title: 'Pilot Needed',
      description: 'Looking for an experienced pilot',
    },
    {
      id: 'act-1',
      sourceType: 'activity',
      title: 'Mining Run',
      description: 'Group mining expedition',
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

describe('useOpportunitySearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch opportunities with default params', async () => {
    mockedSearchOpportunities.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOpportunitySearch(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedSearchOpportunities).toHaveBeenCalledWith({}, 1, 20, 'postedAt', 'DESC');
    expect(result.current.data).toEqual(mockResponse);
  });

  it('should pass filters to the service', async () => {
    mockedSearchOpportunities.mockResolvedValue(mockResponse);
    const filters = { sourceType: 'job' as const, searchTerm: 'mining' };

    const { result } = renderHook(() => useOpportunitySearch(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedSearchOpportunities).toHaveBeenCalledWith(filters, 1, 20, 'postedAt', 'DESC');
  });

  it('should pass custom pagination params', async () => {
    mockedSearchOpportunities.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOpportunitySearch({}, 3, 50, 'title', 'ASC'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedSearchOpportunities).toHaveBeenCalledWith({}, 3, 50, 'title', 'ASC');
  });

  it('should return loading state initially', () => {
    mockedSearchOpportunities.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOpportunitySearch(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return error state on failure', async () => {
    mockedSearchOpportunities.mockRejectedValue(new Error('API failure'));

    const { result } = renderHook(() => useOpportunitySearch(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('should return paginated data correctly', async () => {
    mockedSearchOpportunities.mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useOpportunitySearch(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toHaveLength(2);
    expect(result.current.data?.pagination.total).toBe(2);
    expect(result.current.data?.pagination.hasNext).toBe(false);
  });

  it('should refetch when filters change', async () => {
    mockedSearchOpportunities.mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(({ filters }) => useOpportunitySearch(filters), {
      wrapper: createWrapper(),
      initialProps: { filters: { sourceType: 'job' } as OpportunitySearchFilters },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedSearchOpportunities).toHaveBeenCalledTimes(1);

    rerender({ filters: { sourceType: 'activity' } });

    await waitFor(() => expect(mockedSearchOpportunities).toHaveBeenCalledTimes(2));
    expect(mockedSearchOpportunities).toHaveBeenLastCalledWith(
      { sourceType: 'activity' },
      1,
      20,
      'postedAt',
      'DESC'
    );
  });
});
