/**
 * Squadron Query Hooks
 *
 * TanStack Query hooks for squadron member management,
 * role operations, and analytics.
 */

import { squadronService } from '@/services/squadronService';
import type {
  AddSquadronMemberInput,
  PaginatedResult,
  SquadronMember,
  SquadronMemberListParams,
  SquadronStatistics,
  UpdateSquadronRoleInput,
} from '@/types/apiV2';
import type { SquadronRoleStats, SquadronShipStats } from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { squadronKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch members of a squadron with pagination & filtering
 */
export function useSquadronMembers(
  squadronId: string | undefined,
  params?: SquadronMemberListParams,
  options?: Omit<UseQueryOptions<PaginatedResult<SquadronMember>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.memberList(squadronId!, params as Record<string, unknown>),
    queryFn: () => squadronService.getMembers(squadronId!, params),
    enabled: !!squadronId,
    ...options,
  });
}

/**
 * Hook to fetch a single squadron member
 */
export function useSquadronMember(
  squadronId: string | undefined,
  memberId: string | undefined,
  options?: Omit<UseQueryOptions<SquadronMember>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.member(squadronId!, memberId!),
    queryFn: () => squadronService.getMemberById(squadronId!, memberId!),
    enabled: !!squadronId && !!memberId,
    ...options,
  });
}

/**
 * Hook to get total member count
 */
export function useSquadronCount(
  squadronId: string | undefined,
  options?: Omit<UseQueryOptions<{ count: number }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.count(squadronId!),
    queryFn: () => squadronService.getMemberCount(squadronId!),
    enabled: !!squadronId,
    ...options,
  });
}

/**
 * Hook to get comprehensive squadron statistics
 */
export function useSquadronStats(
  squadronId: string | undefined,
  options?: Omit<UseQueryOptions<SquadronStatistics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.stats(squadronId!),
    queryFn: () => squadronService.getStatistics(squadronId!),
    enabled: !!squadronId,
    ...options,
  });
}

/**
 * Hook to get role distribution
 */
export function useSquadronRoleStats(
  squadronId: string | undefined,
  options?: Omit<UseQueryOptions<SquadronRoleStats[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.roleStats(squadronId!),
    queryFn: () => squadronService.getRoleStats(squadronId!),
    enabled: !!squadronId,
    ...options,
  });
}

/**
 * Hook to get ship type distribution
 */
export function useSquadronShipStats(
  squadronId: string | undefined,
  options?: Omit<UseQueryOptions<SquadronShipStats[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: squadronKeys.shipStats(squadronId!),
    queryFn: () => squadronService.getShipStats(squadronId!),
    enabled: !!squadronId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface AddMemberInput {
  squadronId: string;
  data: AddSquadronMemberInput;
}

interface RemoveMemberInput {
  squadronId: string;
  userId: string;
}

interface UpdateRoleInput {
  squadronId: string;
  userId: string;
  data: UpdateSquadronRoleInput;
}

/**
 * Hook to add a member to a squadron
 */
export function useAddSquadronMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ squadronId, data }: AddMemberInput) =>
      squadronService.addMember(squadronId, data),
    onSuccess: (_, { squadronId }) => {
      queryClient.invalidateQueries({ queryKey: squadronKeys.members(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.count(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.stats(squadronId) });
    },
  });
}

/**
 * Hook to remove a member from a squadron
 */
export function useRemoveSquadronMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ squadronId, userId }: RemoveMemberInput) =>
      squadronService.removeMember(squadronId, userId),
    onSuccess: (_, { squadronId }) => {
      queryClient.invalidateQueries({ queryKey: squadronKeys.members(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.count(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.stats(squadronId) });
    },
  });
}

/**
 * Hook to update a member's role
 */
export function useUpdateSquadronRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ squadronId, userId, data }: UpdateRoleInput) =>
      squadronService.updateMemberRole(squadronId, userId, data),
    onSuccess: (_, { squadronId }) => {
      queryClient.invalidateQueries({ queryKey: squadronKeys.members(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.roleStats(squadronId) });
      queryClient.invalidateQueries({ queryKey: squadronKeys.stats(squadronId) });
    },
  });
}
