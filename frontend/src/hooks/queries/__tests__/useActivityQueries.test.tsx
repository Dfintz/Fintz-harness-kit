/**
 * Tests for Activity Query Hooks
 */

import { createQueryClient } from '@/hooks/queries/queryClient';
import {
  useActivities,
  useActivity,
  useActivityAnalytics,
  useCancelActivity,
  useCreateActivity,
  useJoinActivity,
  useLeaveActivity,
  useRecommendedActivities,
  useUpcomingActivities,
  useUpdateActivity,
} from '@/hooks/queries/useActivityQueries';
import { activityServiceV2 } from '@/services/activityServiceV2';
import type { ActivityV2, PaginatedResult } from '@/types/apiV2';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { act } from 'react-dom/test-utils';

// Mock the activity service
jest.mock('../../../services/activityServiceV2');

// Mock auth store — user-scoped hooks (e.g. useMyActivities) read userId from here
// and gate `enabled` on it. Provide a fake user so the queries actually run.
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(<T,>(selector?: (state: { user: { id: string } | null }) => T) => {
    const state = { user: { id: 'test-user-id' } };
    return selector ? selector(state) : state;
  }),
}));

const mockedActivityService = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

// Test wrapper with QueryClient
// Use the real `createQueryClient` so the global `meta.invalidates` handler
// (registered on the MutationCache) actually fires during tests.
const createWrapper = () => {
  const queryClient = createQueryClient();
  // Override defaults for fast tests.
  queryClient.setDefaultOptions({
    queries: { retry: false, gcTime: 0 },
    mutations: { retry: false },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

describe('Activity Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useRecommendedActivities', () => {
    it('should fetch recommended activities with default limit', async () => {
      const mockRecommended = {
        activities: [],
        count: 0,
      };
      mockedActivityService.getRecommendedActivities.mockResolvedValue(mockRecommended);

      const { result } = renderHook(() => useRecommendedActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getRecommendedActivities).toHaveBeenCalledWith(10);
      expect(result.current.data).toEqual(mockRecommended);
    });

    it('should fetch recommended activities with custom limit', async () => {
      const mockRecommended = {
        activities: [],
        count: 0,
      };
      mockedActivityService.getRecommendedActivities.mockResolvedValue(mockRecommended);

      const { result } = renderHook(() => useRecommendedActivities(20), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getRecommendedActivities).toHaveBeenCalledWith(20);
    });

    it('should handle error when fetching recommended activities', async () => {
      mockedActivityService.getRecommendedActivities.mockRejectedValue(
        new Error('Failed to fetch')
      );

      const { result } = renderHook(() => useRecommendedActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(new Error('Failed to fetch'));
    });
  });

  describe('useUpcomingActivities', () => {
    it('should fetch upcoming activities without parameters', async () => {
      const mockUpcoming = {
        activities: [],
        count: 0,
      };
      mockedActivityService.getUpcomingActivities.mockResolvedValue(mockUpcoming);

      const { result } = renderHook(() => useUpcomingActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getUpcomingActivities).toHaveBeenCalledWith(undefined);
      expect(result.current.data).toEqual(mockUpcoming);
    });

    it('should fetch upcoming activities with organization filter', async () => {
      const mockUpcoming = {
        activities: [
          { id: '1', title: 'Event 1' } as ActivityV2,
          { id: '2', title: 'Event 2' } as ActivityV2,
        ],
        count: 2,
      };
      mockedActivityService.getUpcomingActivities.mockResolvedValue(mockUpcoming);

      const { result } = renderHook(
        () => useUpcomingActivities({ organizationId: 'org-123', limit: 5 }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getUpcomingActivities).toHaveBeenCalledWith({
        organizationId: 'org-123',
        limit: 5,
      });
      expect(result.current.data?.count).toBe(2);
    });
  });

  describe('useActivities', () => {
    it('should fetch activities for an organization', async () => {
      const mockResult: PaginatedResult<ActivityV2> = {
        items: [
          { id: '1', title: 'Activity 1' } as ActivityV2,
          { id: '2', title: 'Activity 2' } as ActivityV2,
        ],
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        },
      };
      mockedActivityService.getActivities.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useActivities('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getActivities).toHaveBeenCalledWith('org-123', undefined);
      expect(result.current.data?.items).toHaveLength(2);
    });

    it('should not fetch when organizationId is undefined', async () => {
      const { result } = renderHook(() => useActivities(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedActivityService.getActivities).not.toHaveBeenCalled();
    });

    it('should fetch activities with pagination params', async () => {
      const mockResult: PaginatedResult<ActivityV2> = {
        items: [],
        pagination: {
          total: 50,
          page: 2,
          limit: 20,
          totalPages: 3,
          hasNext: true,
          hasPrevious: true,
        },
      };
      mockedActivityService.getActivities.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useActivities('org-123', { page: 2, limit: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getActivities).toHaveBeenCalledWith('org-123', {
        page: 2,
        limit: 20,
      });
    });

    it('should handle error when fetching activities', async () => {
      mockedActivityService.getActivities.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useActivities('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Network error'));
    });
  });

  describe('useActivity', () => {
    it('should fetch a single activity by ID', async () => {
      const mockActivity = {
        id: 'act-123',
        title: 'Test Activity',
        type: 'mission',
        status: 'scheduled',
        organizationId: 'org-123',
      } as unknown as ActivityV2;
      mockedActivityService.getActivityById.mockResolvedValue(mockActivity);

      const { result } = renderHook(() => useActivity('act-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getActivityById).toHaveBeenCalledWith('act-123');
      expect(result.current.data).toEqual(mockActivity);
    });

    it('should not fetch when activityId is undefined', async () => {
      const { result } = renderHook(() => useActivity(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedActivityService.getActivityById).not.toHaveBeenCalled();
    });

    it('should handle 404 error for non-existent activity', async () => {
      mockedActivityService.getActivityById.mockRejectedValue(new Error('Activity not found'));

      const { result } = renderHook(() => useActivity('invalid-id'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Activity not found'));
    });
  });

  describe('useActivityAnalytics', () => {
    it('should fetch activity analytics for an organization', async () => {
      const mockAnalytics = {
        totalActivities: 100,
        activeActivities: 10,
        completedActivities: 85,
        participationRate: 0.75,
      };
      mockedActivityService.getActivityAnalytics.mockResolvedValue(mockAnalytics as any);

      const { result } = renderHook(() => useActivityAnalytics('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedActivityService.getActivityAnalytics).toHaveBeenCalledWith('org-123');
      expect(result.current.data).toEqual(mockAnalytics);
    });

    it('should not fetch when organizationId is undefined', async () => {
      const { result } = renderHook(() => useActivityAnalytics(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedActivityService.getActivityAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('useCreateActivity', () => {
    it('should create a new activity', async () => {
      const newActivity: ActivityV2 = {
        id: 'new-act',
        title: 'New Activity',
      } as ActivityV2;
      mockedActivityService.createActivity.mockResolvedValue(newActivity);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateActivity(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-123',
          data: {
            title: 'New Activity',
            type: 'mission',
          },
        });
      });

      expect(mockedActivityService.createActivity).toHaveBeenCalledWith('org-123', {
        title: 'New Activity',
        type: 'mission',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when creating activity', async () => {
      mockedActivityService.createActivity.mockRejectedValue(new Error('Validation error'));

      const { result } = renderHook(() => useCreateActivity(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          organizationId: 'org-123',
          data: { title: 'Test', type: 'mission' },
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('useUpdateActivity', () => {
    it('should update an existing activity', async () => {
      const updatedActivity: ActivityV2 = {
        id: 'act-123',
        title: 'Updated Title',
      } as ActivityV2;
      mockedActivityService.updateActivity.mockResolvedValue(updatedActivity);

      // useUpdateActivity now uses meta.invalidates rather than setQueryData
      // (Activity contains JSONB-backed metadata; writing the response into
      // cache caused snap-back regressions). Assert on invalidation instead.
      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateActivity(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          activityId: 'act-123',
          data: { title: 'Updated Title' },
        });
      });

      expect(mockedActivityService.updateActivity).toHaveBeenCalledWith('act-123', {
        title: 'Updated Title',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useJoinActivity', () => {
    it('should join an activity', async () => {
      mockedActivityService.joinActivity.mockResolvedValue({} as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useJoinActivity(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          activityId: 'act-123',
          role: 'pilot',
          shipType: 'fighter',
        });
      });

      expect(mockedActivityService.joinActivity).toHaveBeenCalledWith('act-123', {
        role: 'pilot',
        shipId: undefined,
        shipType: 'fighter',
        shipName: undefined,
        notes: undefined,
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useLeaveActivity', () => {
    it('should leave an activity', async () => {
      mockedActivityService.leaveActivity.mockResolvedValue({} as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useLeaveActivity(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('act-123');
      });

      expect(mockedActivityService.leaveActivity).toHaveBeenCalledWith('act-123');
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useCancelActivity', () => {
    it('should cancel an activity', async () => {
      mockedActivityService.cancelActivity.mockResolvedValue({} as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCancelActivity(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('act-123');
      });

      expect(mockedActivityService.cancelActivity).toHaveBeenCalledWith('act-123');
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when canceling activity', async () => {
      mockedActivityService.cancelActivity.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useCancelActivity(), {
        wrapper: createWrapper(),
      });

      await expect(result.current.mutateAsync('act-123')).rejects.toThrow('Unauthorized');
    });
  });
});
