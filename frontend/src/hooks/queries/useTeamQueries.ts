/**
 * Team Query Hooks — Phase 1.3
 *
 * TanStack Query hooks for team/squad operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import { teamService } from '@/services/teamService';
import type {
  AddTeamMemberRequest,
  CreateTeamRequest,
  Team,
  TeamMember,
  TeamTreeNode,
  UpdateTeamMemberRequest,
  UpdateTeamRequest,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { teamKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all teams for an organization
 */
export function useTeams(
  orgId: string | undefined,
  options?: Omit<UseQueryOptions<Team[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: teamKeys.list(orgId!),
    queryFn: () => teamService.getTeams(orgId!),
    enabled: !!orgId,
    ...options,
  });
}

/**
 * Hook to fetch team hierarchy tree
 */
export function useTeamTree(
  orgId: string | undefined,
  options?: Omit<
    UseQueryOptions<{ tree: TeamTreeNode[]; totalTeams: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: teamKeys.tree(orgId!),
    queryFn: () => teamService.getTeamTree(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
    ...options,
  });
}

/**
 * Hook to fetch a single team by ID
 */
export function useTeam(
  teamId: string | undefined,
  options?: Omit<UseQueryOptions<Team>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: teamKeys.detail(teamId!),
    queryFn: () => teamService.getTeamById(teamId!),
    enabled: !!teamId,
    ...options,
  });
}

/**
 * Hook to fetch team members
 */
export function useTeamMembers(
  teamId: string | undefined,
  options?: Omit<UseQueryOptions<TeamMember[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: teamKeys.members(teamId!),
    queryFn: () => teamService.getMembers(teamId!),
    enabled: !!teamId,
    placeholderData: [],
    staleTime: 30_000,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new team
 */
export function useCreateTeam(orgId: string) {  return useMutation({
    mutationFn: (data: CreateTeamRequest) => teamService.createTeam(orgId, data),
    meta: { invalidates: [teamKeys.list(orgId), teamKeys.tree(orgId)] },
  });
}

/**
 * Hook to update a team
 */
export function useUpdateTeam(orgId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: UpdateTeamRequest }) =>
      teamService.updateTeam(teamId, data),
    onSuccess: (_result, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: teamKeys.detail(teamId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.list(orgId) });
      queryClient.invalidateQueries({ queryKey: teamKeys.tree(orgId) });
    },
  });
}

/**
 * Hook to delete a team
 */
export function useDeleteTeam(orgId: string) {  return useMutation({
    mutationFn: (teamId: string) => teamService.deleteTeam(teamId),
    meta: { invalidates: [teamKeys.list(orgId), teamKeys.tree(orgId)] },
  });
}

/**
 * Hook to move a team to a new parent
 */
export function useMoveTeam(orgId: string) {  return useMutation({
    mutationFn: ({ teamId, parentTeamId }: { teamId: string; parentTeamId: string | null }) =>
      teamService.moveTeam(teamId, parentTeamId),
    meta: { invalidates: [teamKeys.list(orgId), teamKeys.tree(orgId)] },
  });
}

/**
 * Hook to reorder teams within a parent
 */
export function useReorderTeams(orgId: string) {  return useMutation({
    mutationFn: ({
      orderedIds,
      parentTeamId,
    }: {
      orderedIds: string[];
      parentTeamId?: string | null;
    }) => teamService.reorderTeams(orgId, orderedIds, parentTeamId),
    meta: { invalidates: [teamKeys.tree(orgId)] },
  });
}

/**
 * Hook to add a member to a team
 */
export function useAddTeamMember(teamId: string, orgId: string) {  return useMutation({
    mutationFn: (data: AddTeamMemberRequest) => teamService.addMember(teamId, data),
    meta: { invalidates: [teamKeys.members(teamId), teamKeys.detail(teamId), teamKeys.list(orgId)] },
  });
}

/**
 * Hook to update a team member
 */
export function useUpdateTeamMember(teamId: string) {  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: UpdateTeamMemberRequest }) =>
      teamService.updateMember(teamId, memberId, data),
    meta: { invalidates: [teamKeys.members(teamId)] },
  });
}

/**
 * Hook to remove a member from a team
 */
export function useRemoveTeamMember(teamId: string, orgId: string) {  return useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(teamId, memberId),
    meta: { invalidates: [teamKeys.members(teamId), teamKeys.detail(teamId), teamKeys.list(orgId)] },
  });
}
