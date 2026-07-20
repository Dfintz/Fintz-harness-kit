/**
 * Organization Query Hooks for Mobile
 * TanStack Query hooks for organization operations.
 * Ported from frontend/src/hooks/queries/useOrganizationQueries.ts
 */

import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import type {
  Organization,
  OrganizationStatistics,
  PaginatedResult,
  PaginationParams,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { organizationKeys } from './queryKeys';

export function useMyOrganizations(
  options?: Omit<UseQueryOptions<Organization[]>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: organizationKeys.my(userId),
    queryFn: () => organizationServiceV2.getMyOrganizations(),
    enabled: !!userId && callerEnabled,
  });
}

export function useOrganization(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<Organization>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationKeys.detail(organizationId!),
    queryFn: () => organizationServiceV2.getOrganizationById(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

export function useOrganizationMembers(
  organizationId: string | undefined,
  params?: PaginationParams & { role?: string; search?: string },
  options?: Omit<UseQueryOptions<PaginatedResult<OrganizationMemberV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...organizationKeys.members(organizationId!), params],
    queryFn: () => organizationServiceV2.getOrganizationMembers(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

export function useOrganizationStatistics(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<OrganizationStatistics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...organizationKeys.detail(organizationId!), 'statistics'],
    queryFn: () => organizationServiceV2.getOrganizationStatistics(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

// Mutations

interface CreateOrganizationInput {
  name: string;
  description?: string;
  rsiSpectrumId?: string;
  logo?: string;
}

interface UpdateOrganizationInput {
  organizationId: string;
  data: { name?: string; description?: string; logo?: string; settings?: Record<string, unknown> };
}

interface UpdateMemberRoleInput {
  organizationId: string;
  memberId: string;
  role?: string;
  roleId?: string;
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOrganizationInput) => organizationServiceV2.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, data }: UpdateOrganizationInput) =>
      organizationServiceV2.updateOrganization(organizationId, data),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, memberId, role, roleId }: UpdateMemberRoleInput) =>
      organizationServiceV2.updateMemberRole(organizationId, memberId, { role, roleId }),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organizationId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ organizationId, memberId }: { organizationId: string; memberId: string }) =>
      organizationServiceV2.removeMember(organizationId, memberId),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) });
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organizationId) });
    },
  });
}
