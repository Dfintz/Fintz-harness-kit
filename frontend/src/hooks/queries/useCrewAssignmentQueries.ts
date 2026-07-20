/**
 * Crew Assignment Query Hooks
 *
 * TanStack Query hooks for crew assignment management via the v2 API.
 * Wraps crewAssignmentService for automatic caching, background refetch,
 * and cache invalidation on mutations.
 *
 * Sprint 1 — Wire Ships & Crew tab in ActivityDetail
 */

import { crewAssignmentService } from '@/services/crewAssignmentService';
import type {
  AddCrewMemberInput,
  CreateCrewAssignmentInput,
  CrewAssignment,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { crewAssignmentKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch all crew assignments (paginated).
 */
export function useCrewAssignments(
  params?: { page?: number; limit?: number },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: crewAssignmentKeys.list(params),
    queryFn: () => crewAssignmentService.getAssignments(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetch a single crew assignment by ID.
 */
export function useCrewAssignment(assignmentId: string | undefined) {
  return useQuery({
    queryKey: crewAssignmentKeys.detail(assignmentId!),
    queryFn: () => crewAssignmentService.getAssignmentById(assignmentId!),
    enabled: !!assignmentId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new crew assignment.
 */
export function useCreateCrewAssignment() {  return useMutation({
    mutationFn: (data: CreateCrewAssignmentInput) => crewAssignmentService.createAssignment(data),
    meta: { invalidates: [crewAssignmentKeys.lists()] },
  });
}

/**
 * Add a crew member to an existing assignment.
 */
export function useAddAssignmentCrewMember() {  return useMutation({
    mutationFn: ({ assignmentId, data }: { assignmentId: string; data: AddCrewMemberInput }) =>
      crewAssignmentService.addCrewMember(assignmentId, data),
    meta: {
      invalidates: (_result: CrewAssignment, variables) => [crewAssignmentKeys.detail(variables.assignmentId),, crewAssignmentKeys.lists()],
    },
  });
}

/**
 * Remove a crew member from an assignment.
 */
export function useRemoveAssignmentCrewMember() {  return useMutation({
    mutationFn: ({ assignmentId, userId }: { assignmentId: string; userId: string }) =>
      crewAssignmentService.removeCrewMember(assignmentId, userId),
    meta: {
      invalidates: (_result: CrewAssignment, variables) => [crewAssignmentKeys.detail(variables.assignmentId),, crewAssignmentKeys.lists()],
    },
  });
}

/**
 * Update the status of a crew assignment.
 */
export function useUpdateCrewAssignmentStatus() {  return useMutation({
    mutationFn: ({
      assignmentId,
      status,
    }: {
      assignmentId: string;
      status: 'active' | 'inactive' | 'completed';
    }) => crewAssignmentService.updateStatus(assignmentId, status),
    meta: {
      invalidates: (_result: CrewAssignment, variables) => [crewAssignmentKeys.detail(variables.assignmentId),, crewAssignmentKeys.lists()],
    },
  });
}
