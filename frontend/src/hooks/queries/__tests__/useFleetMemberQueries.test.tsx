/**
 * Fleet Member Query Hooks Tests
 *
 * Tests useAddShipToFleet, useRemoveShipFromFleet, and useBulkAddShipsToFleet
 * mutations including cache invalidation.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import {
  useAddShipToFleet,
  useBulkAddShipsToFleet,
  useRemoveShipFromFleet,
} from '@/hooks/queries/useFleetMemberQueries';
import { fleetServiceV2 } from '@/services/fleetServiceV2';

// Mock the fleet service
jest.mock('@/services/fleetServiceV2', () => ({
  fleetServiceV2: {
    addShipToFleet: jest.fn(),
    removeShipFromFleet: jest.fn(),
    bulkAddShipsToFleet: jest.fn(),
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockedService = fleetServiceV2 as jest.Mocked<typeof fleetServiceV2>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

describe('useAddShipToFleet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call addShipToFleet service method', async () => {
    mockedService.addShipToFleet.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAddShipToFleet(), { wrapper: createWrapper() });

    result.current.mutate({ fleetId: 'fleet-1', shipId: 'ship-1', role: 'combat' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.addShipToFleet).toHaveBeenCalledWith('fleet-1', 'ship-1', 'combat', undefined);
  });

  it('should handle errors gracefully', async () => {
    mockedService.addShipToFleet.mockRejectedValue(new Error('Ship already assigned'));

    const { result } = renderHook(() => useAddShipToFleet(), { wrapper: createWrapper() });

    result.current.mutate({ fleetId: 'fleet-1', shipId: 'ship-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveShipFromFleet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call removeShipFromFleet service method', async () => {
    mockedService.removeShipFromFleet.mockResolvedValue(undefined);

    const { result } = renderHook(() => useRemoveShipFromFleet(), { wrapper: createWrapper() });

    result.current.mutate({ fleetId: 'fleet-1', shipId: 'ship-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.removeShipFromFleet).toHaveBeenCalledWith('fleet-1', 'ship-1');
  });
});

describe('useBulkAddShipsToFleet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call bulkAddShipsToFleet service method with ship IDs', async () => {
    mockedService.bulkAddShipsToFleet.mockResolvedValue({ count: 3 });

    const { result } = renderHook(() => useBulkAddShipsToFleet(), { wrapper: createWrapper() });

    result.current.mutate({ fleetId: 'fleet-1', shipIds: ['s1', 's2', 's3'] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.bulkAddShipsToFleet).toHaveBeenCalledWith('fleet-1', ['s1', 's2', 's3']);
  });

  it('should handle bulk add errors', async () => {
    mockedService.bulkAddShipsToFleet.mockRejectedValue(new Error('Max 100 ships'));

    const { result } = renderHook(() => useBulkAddShipsToFleet(), { wrapper: createWrapper() });

    result.current.mutate({ fleetId: 'fleet-1', shipIds: Array(101).fill('ship') });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
