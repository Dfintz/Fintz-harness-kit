/**
 * Organization Query Hooks
 *
 * TanStack Query hooks for organization operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import type { OrganizationMemberV2, OrgTreeNode } from '@/services/organizationServiceV2';
import { organizationServiceV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import type {
  Organization,
  OrganizationStatistics,
  PaginatedResult,
  PaginationParams,
} from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { organizationKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch the current user's organizations.
 *
 * The query key is scoped to the authenticated user id so that cached
 * memberships from a previous user session do not leak into a new session
 * (this previously caused brand-new users to see another user's org as
 * "Member" in the public organization directory).
 *
 * The query is also disabled when no user is authenticated, so unauthenticated
 * visitors never trigger the request.
 */
export function useMyOrganizations(
  options?: Omit<UseQueryOptions<Organization[]>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: organizationKeys.my(userId),
    queryFn: () => organizationServiceV2.getMyOrganizations(),
    // Always require an authenticated user — caller `enabled` can only further restrict,
    // never bypass user scoping.
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to fetch a single organization by ID
 */
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

/**
 * Hook to fetch organization members
 */
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

/**
 * Hook to fetch organization statistics
 */
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

/**
 * Hook to fetch organization hierarchy tree
 */
export function useOrganizationTree(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<OrgTreeNode>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: organizationKeys.tree(organizationId!),
    queryFn: () => organizationServiceV2.getOrganizationTree(organizationId!),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateOrganizationInput {
  name: string;
  description?: string;
  rsiSpectrumId?: string;
  logo?: string;
}

interface UpdateOrganizationInput {
  organizationId: string;
  data: {
    name?: string;
    description?: string;
    logo?: string;
    settings?: Record<string, unknown>;
  };
}

interface UpdateMemberRoleInput {
  organizationId: string;
  memberId: string;
  role?: string;
  roleId?: string;
}

/**
 * Hook to create a new organization
 */
export function useCreateOrganization() {
  return useMutation({
    mutationFn: (data: CreateOrganizationInput) => organizationServiceV2.createOrganization(data),
    meta: {
      invalidates: [[...organizationKeys.all, 'my'], organizationKeys.lists()],
    },
  });
}

/**
 * Hook to update an organization.
 *
 * NOTE: deliberately does NOT call setQueryData. The mutation can include a
 * `settings` JSONB field, and speculative cache writes that mis-shape JSONB
 * are the historic source of "settings snap back to old value" bugs (see
 * /memories/repo/typeorm-jsonb-pitfall.md). Invalidate-and-refetch returns
 * the real persisted value.
 */
export function useUpdateOrganization() {
  return useMutation({
    mutationFn: ({ organizationId, data }: UpdateOrganizationInput) =>
      organizationServiceV2.updateOrganization(organizationId, data),
    meta: {
      invalidates: (_data, { organizationId }: UpdateOrganizationInput) => [
        organizationKeys.detail(organizationId),
        organizationKeys.lists(),
        [...organizationKeys.all, 'my'],
      ],
    },
  });
}

interface RenameOrganizationInput {
  organizationId: string;
  name: string;
}

/**
 * Hook to rename an organization (display name only, tag/id is immutable).
 */
export function useRenameOrganization() {
  return useMutation({
    mutationFn: ({ organizationId, name }: RenameOrganizationInput) =>
      organizationServiceV2.renameOrganization(organizationId, name),
    meta: {
      invalidates: (_data, { organizationId }: RenameOrganizationInput) => [
        organizationKeys.detail(organizationId),
        organizationKeys.lists(),
        [...organizationKeys.all, 'my'],
      ],
    },
  });
}

/**
 * Hook to sync organization name from RSI.
 * Pulls the current name from RSI and applies it to the org.
 */
export function useSyncNameFromRsi() {
  return useMutation({
    mutationFn: (organizationId: string) => organizationServiceV2.syncNameFromRsi(organizationId),
    meta: {
      invalidates: (_data, organizationId: string) => [
        organizationKeys.detail(organizationId),
        organizationKeys.lists(),
        [...organizationKeys.all, 'my'],
      ],
    },
  });
}

/**
 * Hook to update a member's role
 */
export function useUpdateMemberRole() {
  return useMutation({
    mutationFn: ({ organizationId, memberId, role, roleId }: UpdateMemberRoleInput) =>
      organizationServiceV2.updateMemberRole(organizationId, memberId, { role, roleId }),
    meta: {
      invalidates: (_data, { organizationId }: UpdateMemberRoleInput) => [
        organizationKeys.members(organizationId),
      ],
    },
  });
}

/**
 * Hook to remove a member from organization
 */
export function useRemoveMember() {
  return useMutation({
    mutationFn: ({ organizationId, memberId }: { organizationId: string; memberId: string }) =>
      organizationServiceV2.removeMember(organizationId, memberId),
    meta: {
      invalidates: (_data, { organizationId }: { organizationId: string; memberId: string }) => [
        organizationKeys.members(organizationId),
        [...organizationKeys.detail(organizationId), 'statistics'],
      ],
    },
  });
}

/**
 * Hook to leave an organization.
 *
 * Keeps an `onSuccess` so we can `removeQueries` for the now-inaccessible
 * detail (invalidate would re-fetch and 403). The `my` list invalidation
 * goes through the central `meta.invalidates` handler.
 */
export function useLeaveOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (organizationId: string) => organizationServiceV2.leaveOrganization(organizationId),
    onSuccess: (_, organizationId) => {
      queryClient.removeQueries({ queryKey: organizationKeys.detail(organizationId) });
    },
    meta: {
      invalidates: [[...organizationKeys.all, 'my']],
    },
  });
}
