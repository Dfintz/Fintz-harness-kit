/**
 * Activity Query Hooks
 *
 * TanStack Query hooks for activity operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import { activityServiceV2 } from '@/services/activityServiceV2';
import { useAuthStore } from '@/store/authStore';
import type {
  ActivityAnalytics,
  ActivityListParams,
  ActivityV2,
  PaginatedResult,
  RecommendedActivities,
} from '@/types/apiV2';
import type { ActivityCrewPosition } from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { activityKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch recommended activities
 */
export function useRecommendedActivities(
  limit: number = 10,
  options?: Omit<UseQueryOptions<RecommendedActivities>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...activityKeys.all, 'recommended', limit],
    queryFn: () => activityServiceV2.getRecommendedActivities(limit),
    ...options,
  });
}

/**
 * Hook to fetch the current user's activities
 *
 * User-scoped: cache key includes the signed-in user's id so a previous user's
 * activities cannot be served to the next signed-in user from cache.
 */
export function useMyActivities(
  params?: ActivityListParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ActivityV2>>, 'queryKey' | 'queryFn'>
) {
  const userId = useAuthStore(state => state.user?.id);
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    ...options,
    queryKey: activityKeys.myActivities(userId, params as Record<string, unknown> | undefined),
    queryFn: () => activityServiceV2.getMyActivities(params),
    enabled: !!userId && callerEnabled,
  });
}

/**
 * Hook to fetch upcoming activities
 */
export function useUpcomingActivities(
  params?: { organizationId?: string; limit?: number },
  options?: Omit<
    UseQueryOptions<{ activities: ActivityV2[]; count: number }>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: [...activityKeys.all, 'upcoming', params],
    queryFn: () => activityServiceV2.getUpcomingActivities(params),
    ...options,
  });
}

/**
 * Hook to fetch activities for an organization
 */
export function useActivities(
  organizationId: string | undefined,
  params?: ActivityListParams,
  options?: Omit<UseQueryOptions<PaginatedResult<ActivityV2>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.list({ organizationId, ...params }),
    queryFn: () => activityServiceV2.getActivities(organizationId!, params),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Hook to fetch a single activity by ID
 */
export function useActivity(
  activityId: string | undefined,
  options?: Omit<UseQueryOptions<ActivityV2>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.detail(activityId!),
    queryFn: () => activityServiceV2.getActivityById(activityId!),
    enabled: !!activityId,
    ...options,
  });
}

/**
 * Hook to fetch activity analytics for an organization
 */
export function useActivityAnalytics(
  organizationId: string | undefined,
  options?: Omit<UseQueryOptions<ActivityAnalytics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...activityKeys.all, 'analytics', organizationId],
    queryFn: () => activityServiceV2.getActivityAnalytics(organizationId!),
    enabled: !!organizationId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

interface CreateActivityInput {
  organizationId: string;
  data: {
    title: string;
    type: string;
    description?: string;
    status?: string;
    maxParticipants?: number;
    startDate?: string;
    endDate?: string;
    scheduledStartDate?: string;
    scheduledEndDate?: string;
    location?: string;
    visibility?: string;
    isRecurring?: boolean;
    recurringSchedule?: string;
    metadata?: Record<string, unknown>;
    shipRequirementType?: string;
    requiredShips?: Array<{
      requirementType: 'specific' | 'role';
      shipName?: string;
      shipId?: string;
      role?: string;
      count: number;
      crewPerShip?: number;
      avgCrewPerShip?: number;
    }>;
    crewSpotsTotal?: number;
  };
}

interface UpdateActivityInput {
  activityId: string;
  data: {
    title?: string;
    description?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
    visibility?: string;
    maxParticipants?: number;
  };
}

interface JoinActivityInput {
  activityId: string;
  role?: string;
  shipId?: string;
  shipType?: string;
  shipName?: string;
  crewPosition?: string;
  crewShipId?: string;
  notes?: string;
}

/**
 * Hook to create a new activity
 */
export function useCreateActivity() {
  return useMutation({
    mutationFn: ({ organizationId, data }: CreateActivityInput) =>
      activityServiceV2.createActivity(organizationId, data),
    meta: {
      invalidates: [
        activityKeys.lists(),
        [...activityKeys.all, 'upcoming'],
        [...activityKeys.all, 'recommended'],
      ],
    },
  });
}

/**
 * Hook to update an activity
 *
 * NOTE: deliberately does NOT call setQueryData with the mutation response.
 * Activity contains JSONB-backed metadata whose server-canonical shape may
 * differ from what the client sent — writing the response into cache caused
 * "settings snap back" bugs. See /memories/repo/typeorm-jsonb-pitfall.md.
 */
export function useUpdateActivity() {
  return useMutation({
    mutationFn: ({ activityId, data }: UpdateActivityInput) =>
      activityServiceV2.updateActivity(activityId, data),
    meta: {
      invalidates: (_data, { activityId }: UpdateActivityInput) => [
        activityKeys.detail(activityId),
        activityKeys.lists(),
      ],
    },
  });
}

/**
 * Hook to join an activity
 */
export function useJoinActivity() {
  return useMutation({
    mutationFn: ({
      activityId,
      role,
      shipId,
      shipType,
      shipName,
      crewPosition,
      crewShipId,
      notes,
    }: JoinActivityInput) =>
      activityServiceV2.joinActivity(activityId, {
        role,
        shipId,
        shipType,
        shipName,
        crewPosition,
        crewShipId,
        notes,
      }),
    meta: {
      invalidates: (_data, { activityId }: JoinActivityInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

/**
 * Hook to leave an activity
 */
export function useLeaveActivity() {
  return useMutation({
    mutationFn: (activityId: string) => activityServiceV2.leaveActivity(activityId),
    meta: {
      invalidates: (_data, activityId: string) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

/**
 * Hook to set/move a participant's crew position on a ship
 */
export interface SetCrewPositionInput {
  activityId: string;
  targetUserId: string;
  shipAssignmentId: string;
  crewPosition: ActivityCrewPosition;
}

export function useSetCrewPosition() {
  return useMutation({
    mutationFn: ({ activityId, ...body }: SetCrewPositionInput) =>
      activityServiceV2.setCrewPosition(activityId, body),
    meta: {
      invalidates: (_data, { activityId }: SetCrewPositionInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

/**
 * Hook to nest a ship inside a parent ship's hangar/cargo
 * (or un-nest it by passing parentShipId: null)
 */
export interface SetShipNestingInput {
  activityId: string;
  shipAssignmentId: string;
  parentShipId: string | null;
  transportType: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar' | null;
}

export function useSetShipNesting() {
  return useMutation({
    mutationFn: ({
      activityId,
      shipAssignmentId,
      parentShipId,
      transportType,
    }: SetShipNestingInput) =>
      activityServiceV2.setShipNesting(activityId, shipAssignmentId, {
        parentShipId,
        transportType,
      }),
    meta: {
      invalidates: (_data, { activityId }: SetShipNestingInput) => [
        activityKeys.detail(activityId),
      ],
    },
  });
}

/**
 * Hook to cancel an activity
 */
export function useCancelActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (activityId: string) => activityServiceV2.cancelActivity(activityId),
    onSuccess: (_, activityId) => {
      // Optimistically update the cached activity so the UI reflects the
      // cancelled status immediately, even if a refetch is delayed.
      // (Narrow update on a non-JSONB scalar field — safe.)
      queryClient.setQueryData<ActivityV2 | undefined>(activityKeys.detail(activityId), previous =>
        previous ? { ...previous, status: 'cancelled' } : previous
      );
    },
    meta: {
      invalidates: (_data, activityId: string) => [
        activityKeys.detail(activityId),
        activityKeys.lists(),
        [...activityKeys.all, 'upcoming'],
      ],
    },
  });
}

// =========================================================================
// Quick Join Link hooks
// =========================================================================

/**
 * Hook to generate a quick-join link for an activity
 */
export function useGenerateJoinLink() {
  return useMutation({
    mutationFn: (activityId: string) => activityServiceV2.generateJoinLink(activityId),
    meta: {
      invalidates: (_, activityId) => [activityKeys.detail(activityId)],
    },
  });
}

/**
 * Hook to preview an activity via quick-join token (public, no auth)
 */
export function useActivityByToken(token: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: activityKeys.joinLink(token ?? ''),
    queryFn: () => activityServiceV2.getActivityByToken(token!),
    enabled: !!token && options?.enabled !== false,
  });
}

/**
 * Hook to join an activity via quick-join token
 */
export function useJoinByToken() {
  return useMutation({
    mutationFn: ({
      token,
      data,
    }: {
      token: string;
      data?: { role?: string; shipId?: string; notes?: string };
    }) => activityServiceV2.joinByToken(token, data),
    meta: {
      invalidates: (_data, { token }: { token: string }) => [
        activityKeys.joinLink(token),
        activityKeys.lists(),
      ],
    },
  });
}

/**
 * Prefetch a single activity for navigation preloading
 */
export function usePrefetchActivity() {
  const queryClient = useQueryClient();
  return (activityId: string) => {
    queryClient.prefetchQuery({
      queryKey: activityKeys.detail(activityId),
      queryFn: () => activityServiceV2.getActivityById(activityId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

// =========================================================================
// Ship Management hooks
// =========================================================================

interface LoanShipsInput {
  activityId: string;
  ships: Array<{
    shipId?: string;
    shipType: string;
    shipName?: string;
    crewCapacity?: number;
  }>;
}

/**
 * Hook to loan multiple ships to an activity
 */
export function useLoanShips() {
  return useMutation({
    mutationFn: ({ activityId, ships }: LoanShipsInput) =>
      activityServiceV2.loanShips(activityId, ships),
    meta: {
      invalidates: (_data, { activityId }: LoanShipsInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

interface AddNestedShipInput {
  activityId: string;
  shipData: {
    shipType: string;
    shipName?: string;
    role: string;
    crewCapacity: number;
    parentShipId: string;
    transportType: 'hangar' | 'cargo';
  };
}

/**
 * Hook to add a nested ship/vehicle inside a parent ship's hangar or cargo bay
 */
export function useAddNestedShip() {
  return useMutation({
    mutationFn: ({ activityId, shipData }: AddNestedShipInput) =>
      activityServiceV2.addShip(activityId, shipData),
    meta: {
      invalidates: (_data, { activityId }: AddNestedShipInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

// =========================================================================
// Passenger (non-crew) Slot hooks
// =========================================================================

export interface SetPassengerSlotsInput {
  activityId: string;
  shipId: string;
  slots: Array<{ role: string; capacity: number }>;
}

/**
 * Hook to define/edit the passenger slots (e.g. marines) on a ship
 */
export function useSetPassengerSlots() {
  return useMutation({
    mutationFn: ({ activityId, shipId, slots }: SetPassengerSlotsInput) =>
      activityServiceV2.setPassengerSlots(activityId, shipId, slots),
    meta: {
      invalidates: (_data, { activityId }: SetPassengerSlotsInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

export interface JoinShipPassengerInput {
  activityId: string;
  shipId: string;
  passengerRole: string;
}

/**
 * Hook to join a ship as a passenger (non-crew) in a slot of the given role
 */
export function useJoinShipPassenger() {
  return useMutation({
    mutationFn: ({ activityId, shipId, passengerRole }: JoinShipPassengerInput) =>
      activityServiceV2.joinShipPassenger(activityId, shipId, passengerRole),
    meta: {
      invalidates: (_data, { activityId }: JoinShipPassengerInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

/**
 * Hook to leave whichever passenger slot the current user occupies
 */
export function useLeaveShipPassenger() {
  return useMutation({
    mutationFn: (activityId: string) => activityServiceV2.leaveShipPassenger(activityId),
    meta: {
      invalidates: (_data, activityId: string) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

// =========================================================================
// Typed Crew Slot hooks
// =========================================================================

export interface SetCrewSlotsInput {
  activityId: string;
  shipId: string;
  slots: Array<{ role: ActivityCrewPosition; capacity: number }>;
}

/**
 * Hook to define/edit the typed crew slots (seats per role) on a ship
 */
export function useSetCrewSlots() {
  return useMutation({
    mutationFn: ({ activityId, shipId, slots }: SetCrewSlotsInput) =>
      activityServiceV2.setCrewSlots(activityId, shipId, slots),
    meta: {
      invalidates: (_data, { activityId }: SetCrewSlotsInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

// =========================================================================
// Fleet Operation hooks
// =========================================================================

export interface BringFleetInput {
  activityId: string;
  fleetId: string;
  shipIds?: string[];
}

/**
 * Hook for a fleet leader to bring some/all fleet ships into the activity
 */
export function useBringFleetToActivity() {
  return useMutation({
    mutationFn: ({ activityId, fleetId, shipIds }: BringFleetInput) =>
      activityServiceV2.bringFleetToActivity(activityId, fleetId, shipIds),
    meta: {
      invalidates: (_data, { activityId }: BringFleetInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

export interface InviteFleetMembersInput {
  activityId: string;
  fleetId: string;
  userIds?: string[];
}

export interface BringFleetAndInviteInput {
  activityId: string;
  fleetId: string;
  shipIds?: string[];
  userIds?: string[];
}

/**
 * Hook for orchestrated fleet bring + member invite.
 * Returns explicit status when ships are added but invites fail.
 */
export function useBringFleetAndInviteMembers() {
  return useMutation({
    mutationFn: ({ activityId, fleetId, shipIds, userIds }: BringFleetAndInviteInput) =>
      activityServiceV2.bringFleetAndInviteMembers(activityId, fleetId, { shipIds, userIds }),
    meta: {
      invalidates: (_data, { activityId }: BringFleetAndInviteInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}

/**
 * Hook for a fleet leader to invite some/all fleet members to the activity
 */
export function useInviteFleetMembers() {
  return useMutation({
    mutationFn: ({ activityId, fleetId, userIds }: InviteFleetMembersInput) =>
      activityServiceV2.inviteFleetMembers(activityId, fleetId, userIds),
    meta: {
      invalidates: (_data, { activityId }: InviteFleetMembersInput) => [
        activityKeys.detail(activityId),
        activityKeys.participants(activityId),
      ],
    },
  });
}
