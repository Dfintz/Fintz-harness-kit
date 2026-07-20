/**
 * Tests for Permission Query Hooks (Sprint 19-A)
 *
 * Tests for role template hooks:
 * - useRoleTemplates
 * - useApplyRoleTemplate
 */

import { useApplyRoleTemplate, useRoleTemplates } from '@/hooks/queries/usePermissionQueries';
import { permissionService } from '@/services/permissionService';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the permission service
jest.mock('../../../services/permissionService');

const mockedService = permissionService as jest.Mocked<typeof permissionService>;

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

// Shared mock data
const mockTemplates = [
  {
    id: 'template:org-admin',
    name: 'Organization Admin Template',
    description: 'Pre-configured for org administrators',
    scope: 'organization',
    permissions: ['org:members:manage', 'org:settings:write', 'org:permissions:manage'],
  },
  {
    id: 'template:fleet-lead',
    name: 'Fleet Leader Template',
    description: 'Pre-configured for fleet leaders',
    scope: 'fleet',
    permissions: ['fleet:*', 'org:read'],
  },
  {
    id: 'template:member',
    name: 'Standard Member Template',
    description: 'Pre-configured for regular members',
    scope: 'organization',
    permissions: ['org:read', 'org:members:read'],
  },
];

describe('Permission Query Hooks (Role Templates)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mocks
    mockedService.getRoleTemplates = jest.fn();
    mockedService.applyRoleTemplate = jest.fn();
  });

  // ==========================================================================
  // useRoleTemplates
  // ==========================================================================

  describe('useRoleTemplates', () => {
    it('should fetch role templates successfully', async () => {
      mockedService.getRoleTemplates.mockResolvedValue({
        templates: mockTemplates,
        count: 3,
      });

      const { result } = renderHook(() => useRoleTemplates(), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.templates).toHaveLength(3);
      expect(result.current.data?.count).toBe(3);
      expect(result.current.data?.templates[0].id).toBe('template:org-admin');
      expect(mockedService.getRoleTemplates).toHaveBeenCalledTimes(1);
    });

    it('should handle empty templates', async () => {
      mockedService.getRoleTemplates.mockResolvedValue({
        templates: [],
        count: 0,
      });

      const { result } = renderHook(() => useRoleTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.templates).toHaveLength(0);
      expect(result.current.data?.count).toBe(0);
    });

    it('should handle error state', async () => {
      mockedService.getRoleTemplates.mockRejectedValue(new Error('Failed to fetch'));

      const { result } = renderHook(() => useRoleTemplates(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  // ==========================================================================
  // useApplyRoleTemplate
  // ==========================================================================

  describe('useApplyRoleTemplate', () => {
    it('should apply a role template and invalidate caches', async () => {
      const mockResult = {
        id: 'role-uuid-1',
        name: 'Custom Admin',
        description: 'Pre-configured for org administrators',
        templateApplied: 'template:org-admin',
        organizationId: 'org-123',
        permissions: ['org:members:manage', 'org:settings:write'],
        priority: 90,
        createdAt: '2024-06-01T00:00:00Z',
      };
      mockedService.applyRoleTemplate.mockResolvedValue(mockResult);

      const queryClient = new QueryClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useApplyRoleTemplate(), { wrapper });

      await act(async () => {
        const applied = await result.current.mutateAsync({
          templateId: 'template:org-admin',
          roleName: 'Custom Admin',
          organizationId: 'org-123',
        });
        expect(applied.id).toBe('role-uuid-1');
      });

      expect(mockedService.applyRoleTemplate).toHaveBeenCalledWith('template:org-admin', {
        roleName: 'Custom Admin',
        organizationId: 'org-123',
      });
      // Should invalidate both roles and roleTemplates
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    });

    it('should pass correct arguments to service', async () => {
      mockedService.applyRoleTemplate.mockResolvedValue({
        id: 'role-2',
        name: 'Fleet Lead',
        description: 'Fleet leaders',
        templateApplied: 'template:fleet-lead',
        organizationId: 'org-456',
        permissions: ['fleet:*', 'org:read'],
        priority: 90,
        createdAt: '2024-06-01T00:00:00Z',
      });

      const { result } = renderHook(() => useApplyRoleTemplate(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          templateId: 'template:fleet-lead',
          roleName: 'Fleet Lead',
          organizationId: 'org-456',
        });
      });

      expect(mockedService.applyRoleTemplate).toHaveBeenCalledWith('template:fleet-lead', {
        roleName: 'Fleet Lead',
        organizationId: 'org-456',
      });
    });

    it('should handle error when applying template', async () => {
      mockedService.applyRoleTemplate.mockRejectedValue(new Error('Conflict'));

      const { result } = renderHook(() => useApplyRoleTemplate(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          templateId: 'template:org-admin',
          roleName: 'Duplicate',
          organizationId: 'org-123',
        })
      ).rejects.toThrow('Conflict');
    });
  });
});
