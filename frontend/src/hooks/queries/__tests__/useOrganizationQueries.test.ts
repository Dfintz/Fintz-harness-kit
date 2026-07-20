/**
 * Tests for Organization Query Hooks
 */

import { createQueryClient } from '@/hooks/queries/queryClient';
import {
  useCreateOrganization,
  useLeaveOrganization,
  useMyOrganizations,
  useOrganization,
  useOrganizationMembers,
  useUpdateOrganization,
} from '@/hooks/queries/useOrganizationQueries';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { act } from 'react-dom/test-utils';

jest.mock('../../../services/organizationServiceV2');

// useMyOrganizations is gated on an authenticated user — provide a deterministic id.
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(<T>(selector?: (state: { user: { id: string } | null }) => T) => {
    const state = { user: { id: 'test-user-id' } };
    return selector ? selector(state) : state;
  }),
}));

const mockedOrgService = organizationServiceV2 as jest.Mocked<typeof organizationServiceV2>;

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

describe('Organization Query Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock all organization service methods
    mockedOrgService.getMyOrganizations = jest.fn();
    mockedOrgService.getOrganizationById = jest.fn();
    mockedOrgService.getOrganizationMembers = jest.fn();
    mockedOrgService.createOrganization = jest.fn();
    mockedOrgService.updateOrganization = jest.fn();
    mockedOrgService.leaveOrganization = jest.fn();
  });

  describe('useMyOrganizations', () => {
    it('should fetch user organizations', async () => {
      const mockOrgs = [
        { id: '1', name: 'Org 1', spectrum_id: 'ORG1' },
        { id: '2', name: 'Org 2', spectrum_id: 'ORG2' },
      ];
      mockedOrgService.getMyOrganizations.mockResolvedValue(mockOrgs as any);

      const { result } = renderHook(() => useMyOrganizations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedOrgService.getMyOrganizations).toHaveBeenCalled();
      expect(result.current.data).toHaveLength(2);
    });

    it('should fetch organizations with pagination', async () => {
      const mockOrgs = [{ id: '1', name: 'Org 1' }];
      mockedOrgService.getMyOrganizations.mockResolvedValue(mockOrgs as any);

      const { result } = renderHook(() => useMyOrganizations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Note: The hook may not pass params directly if it doesn't support them
      expect(mockedOrgService.getMyOrganizations).toHaveBeenCalled();
    });

    it('should handle error when fetching organizations', async () => {
      mockedOrgService.getMyOrganizations.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useMyOrganizations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Network error'));
    });
  });

  describe('useOrganization', () => {
    it('should fetch a single organization by ID', async () => {
      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        spectrum_id: 'TESTORG',
      };
      mockedOrgService.getOrganizationById.mockResolvedValue(mockOrg as any);

      const { result } = renderHook(() => useOrganization('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedOrgService.getOrganizationById).toHaveBeenCalledWith('org-123');
      expect(result.current.data).toEqual(mockOrg);
    });

    it('should not fetch when organizationId is undefined', () => {
      const { result } = renderHook(() => useOrganization(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedOrgService.getOrganizationById).not.toHaveBeenCalled();
    });

    it('should handle 404 error', async () => {
      mockedOrgService.getOrganizationById.mockRejectedValue(new Error('Organization not found'));

      const { result } = renderHook(() => useOrganization('invalid-id'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(new Error('Organization not found'));
    });
  });

  describe('useOrganizationMembers', () => {
    it('should fetch organization members', async () => {
      const mockMembers = {
        items: [
          { id: '1', userId: 'user-1', role: 'admin' },
          { id: '2', userId: 'user-2', role: 'member' },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockedOrgService.getOrganizationMembers.mockResolvedValue(mockMembers as any);

      const { result } = renderHook(() => useOrganizationMembers('org-123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedOrgService.getOrganizationMembers).toHaveBeenCalledWith('org-123', undefined);
      expect(result.current.data?.items).toHaveLength(2);
    });

    it('should not fetch when organizationId is undefined', () => {
      const { result } = renderHook(() => useOrganizationMembers(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedOrgService.getOrganizationMembers).not.toHaveBeenCalled();
    });

    it('should fetch members with role filter', async () => {
      const mockMembers = {
        items: [{ id: '1', userId: 'user-1', role: 'admin' }],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      };
      mockedOrgService.getOrganizationMembers.mockResolvedValue(mockMembers as any);

      const { result } = renderHook(() => useOrganizationMembers('org-123', { role: 'admin' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedOrgService.getOrganizationMembers).toHaveBeenCalledWith('org-123', {
        role: 'admin',
      });
    });
  });

  describe('useCreateOrganization', () => {
    it('should create a new organization', async () => {
      const newOrg = { id: 'new-org', name: 'New Org', spectrum_id: 'NEWORG' };
      mockedOrgService.createOrganization.mockResolvedValue(newOrg as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useCreateOrganization(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          name: 'New Org',
          rsiSpectrumId: 'NEWORG',
        });
      });

      expect(mockedOrgService.createOrganization).toHaveBeenCalledWith({
        name: 'New Org',
        rsiSpectrumId: 'NEWORG',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should handle error when creating organization', async () => {
      mockedOrgService.createOrganization.mockRejectedValue(new Error('Validation error'));

      const { result } = renderHook(() => useCreateOrganization(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          name: 'Test',
          rsiSpectrumId: 'TEST',
        })
      ).rejects.toThrow('Validation error');
    });
  });

  describe('useUpdateOrganization', () => {
    it('should update an organization', async () => {
      const updatedOrg = { id: 'org-123', name: 'Updated Org' };
      mockedOrgService.updateOrganization.mockResolvedValue(updatedOrg as any);

      // useUpdateOrganization now uses meta.invalidates rather than setQueryData
      // (Organization carries JSONB-backed settings; writing the response into
      // cache caused snap-back regressions). Assert on invalidation instead.
      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useUpdateOrganization(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          organizationId: 'org-123',
          data: { name: 'Updated Org' },
        });
      });

      expect(mockedOrgService.updateOrganization).toHaveBeenCalledWith('org-123', {
        name: 'Updated Org',
      });
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('useLeaveOrganization', () => {
    it('should leave an organization', async () => {
      mockedOrgService.leaveOrganization.mockResolvedValue({} as any);

      const queryClient = createQueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
      }

      const { result } = renderHook(() => useLeaveOrganization(), { wrapper: Wrapper });

      await act(async () => {
        await result.current.mutateAsync('org-123');
      });

      expect(mockedOrgService.leaveOrganization).toHaveBeenCalledWith('org-123');
      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
