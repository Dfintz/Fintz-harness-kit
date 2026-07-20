/**
 * Tests for Fleet Query Hooks
 */

import { createQueryClient } from '@/hooks/queries/queryClient';
import {
  useCreateFleet,
  useDeleteFleet,
  useFleet,
  useFleets,
  useUpdateFleet,
} from '@/hooks/queries/useFleetQueries';
import { fleetServiceV2 } from '@/services/fleetServiceV2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { act } from 'react-dom/test-utils';

jest.mock('../../../services/fleetServiceV2');

const mockedFleetService = fleetServiceV2 as jest.Mocked<typeof fleetServiceV2>;

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

describe('Fleet Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock all fleet service methods
    mockedFleetService.getFleets = jest.fn();
    mockedFleetService.getFleetById = jest.fn();
    mockedFleetService.createFleet = jest.fn();
    mockedFleetService.updateFleet = jest.fn();
    mockedFleetService.deleteFleet = jest.fn();
    mockedFleetService.getFleetShips = jest.fn();
    mockedFleetService.getAllFleets = jest.fn();
    mockedFleetService.getShips = jest.fn();
    mockedFleetService.searchShips = jest.fn();
  });

  describe('useFleets', () => {
    it('should fetch fleets for an organization', async () => {
      const mockFleets = {
        items: [
          { id: '1', name: 'Fleet 1' },
          { id: '2', name: 'Fleet 2' },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockedFleetService.getFleets.mockResolvedValue(mockFleets as any);

      const { result } = renderHook(() => useFleets('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFleetService.getFleets).toHaveBeenCalledWith('org-123', undefined);
      expect(result.current.data?.items).toHaveLength(2);
    });

    it('should not fetch when organizationId is undefined', () => {
      const { result } = renderHook(() => useFleets(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedFleetService.getFleets).not.toHaveBeenCalled();
    });

    it('should fetch fleets with pagination', async () => {
      const mockFleets = {
        items: [],
        total: 50,
        page: 2,
        pageSize: 20,
        totalPages: 3,
      };
      mockedFleetService.getFleets.mockResolvedValue(mockFleets as any);

      const { result } = renderHook(() => useFleets('org-123', { page: 2, limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFleetService.getFleets).toHaveBeenCalledWith('org-123', {
        page: 2,
        limit: 20,
      });
    });
  });

  describe('useFleet', () => {
    it('should fetch a single fleet by ID', async () => {
      const mockFleet = {
        id: 'fleet-123',
        name: 'Test Fleet',
        organizationId: 'org-123',
      };
      mockedFleetService.getFleetById.mockResolvedValue(mockFleet as any);

      const { result } = renderHook(() => useFleet('fleet-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedFleetService.getFleetById).toHaveBeenCalledWith('fleet-123');
      expect(result.current.data).toEqual(mockFleet);
    });

    it('should not fetch when fleetId is undefined', () => {
      const { result } = renderHook(() => useFleet(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedFleetService.getFleetById).not.toHaveBeenCalled();
    });

    it('should handle 404 error', async () => {
      mockedFleetService.getFleetById.mockRejectedValue(new Error('Fleet not found'));

      const { result } = renderHook(() => useFleet('invalid-id'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Fleet not found'));
    });
  });

  describe('useCreateFleet', () => {
    it('should create a new fleet', async () => {
      const newFleet = { id: 'new-fleet', name: 'New Fleet' };
      mockedFleetService.createFleet.mockResolvedValue(newFleet as any);

      // Use createQueryClient so the global meta.invalidates handler runs.
      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useCreateFleet(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-123',
          data: { name: 'New Fleet' },
        });
      });

      expect(mockedFleetService.createFleet).toHaveBeenCalledWith('org-123', {
        name: 'New Fleet',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when creating fleet', async () => {
      mockedFleetService.createFleet.mockRejectedValue(new Error('Validation error'));

      const { result } = renderHook(() => useCreateFleet(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          organizationId: 'org-123',
          data: { name: 'Test' },
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('useUpdateFleet', () => {
    it('should update a fleet and invalidate caches', async () => {
      const updatedFleet = { id: 'fleet-123', name: 'Updated Fleet' };
      mockedFleetService.updateFleet.mockResolvedValue(updatedFleet as any);

      // Use createQueryClient so the global meta.invalidates handler runs.
      // Note: the previous behaviour set the detail cache via setQueryData; that
      // was removed in Phase 2 (declarative invalidation) so the UI always sees
      // the canonical server response on the next fetch — critical for fleets
      // that include JSONB metadata where a client mirror could drift.
      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useUpdateFleet(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          fleetId: 'fleet-123',
          data: { name: 'Updated Fleet' },
        });
      });

      expect(mockedFleetService.updateFleet).toHaveBeenCalledWith('fleet-123', {
        name: 'Updated Fleet',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useDeleteFleet', () => {
    it('should delete a fleet', async () => {
      mockedFleetService.deleteFleet.mockResolvedValue({} as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useDeleteFleet(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync('fleet-123');
      });

      expect(mockedFleetService.deleteFleet).toHaveBeenCalledWith('fleet-123');
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when deleting fleet', async () => {
      mockedFleetService.deleteFleet.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useDeleteFleet(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync('fleet-123')).rejects.toThrow('Unauthorized');
    });
  });
});
