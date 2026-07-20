/**
 * Mission React Query Hooks
 * TanStack React Query hooks for mission CRUD and lifecycle
 *
 * Created during Sprint 1 — Wave 3.1
 */

import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AssignMissionRequest,
  CompleteMissionRequest,
  CreateMissionRequest,
  Mission,
  MissionObjective,
  UpdateMissionRequest,
} from '@sc-fleet-manager/shared-types';

import {
  missionService,
  type MissionQueryParams,
  type MissionWorkflowPhase,
  type MissionWorkflowState,
  type PaginatedMissions,
} from '@/services/missionService';
import { useAuthStore } from '@/store/authStore';
import { missionKeys } from './queryKeys';

function useMissionOrganizationId(): string | null {
  return useAuthStore(state => state.user?.organizationId ?? state.user?.activeOrgId ?? null);
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch paginated mission list with filters
 */
export function useMissions(
  params?: MissionQueryParams,
  options?: Omit<UseQueryOptions<PaginatedMissions>, 'queryKey' | 'queryFn'>
) {
  const organizationId = useMissionOrganizationId();
  return useQuery({
    queryKey: missionKeys.list(organizationId, params as Record<string, unknown>),
    queryFn: () => missionService.getMissions(params),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Fetch a single mission by ID
 */
export function useMission(
  missionId: string | undefined,
  options?: Omit<UseQueryOptions<Mission>, 'queryKey' | 'queryFn'>
) {
  const organizationId = useMissionOrganizationId();
  return useQuery({
    queryKey: missionKeys.detail(organizationId, missionId!),
    queryFn: () => missionService.getMission(missionId!),
    enabled: !!missionId && !!organizationId,
    ...options,
  });
}

/**
 * Fetch guided command workflow state for a mission
 */
export function useMissionWorkflow(
  missionId: string | undefined,
  options?: Omit<UseQueryOptions<MissionWorkflowState>, 'queryKey' | 'queryFn'>
) {
  const organizationId = useMissionOrganizationId();
  return useQuery({
    queryKey: missionKeys.workflow(organizationId, missionId!),
    queryFn: () => missionService.getWorkflow(missionId!),
    enabled: !!missionId && !!organizationId,
    ...options,
  });
}

/**
 * Fetch active missions (planned, briefed, in_progress)
 */
export function useActiveMissions(
  options?: Omit<UseQueryOptions<Mission[]>, 'queryKey' | 'queryFn'>
) {
  const organizationId = useMissionOrganizationId();
  return useQuery({
    queryKey: missionKeys.active(organizationId),
    queryFn: () => missionService.getActiveMissions(),
    enabled: !!organizationId,
    ...options,
  });
}

/**
 * Fetch mission templates
 */
export function useMissionTemplates(
  options?: Omit<UseQueryOptions<Mission[]>, 'queryKey' | 'queryFn'>
) {
  const organizationId = useMissionOrganizationId();
  return useQuery({
    queryKey: missionKeys.templates(organizationId),
    queryFn: () => missionService.getTemplates(),
    enabled: !!organizationId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Create a new mission
 */
export function useCreateMission() {
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: (data: CreateMissionRequest) => missionService.createMission(data),
    meta: { invalidates: [missionKeys.lists(organizationId), missionKeys.active(organizationId)] },
  });
}

/**
 * Update an existing mission
 */
export function useUpdateMission() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMissionRequest }) =>
      missionService.updateMission(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.workflow(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.lists(organizationId) });
      queryClient.invalidateQueries({ queryKey: missionKeys.active(organizationId) });
    },
  });
}

/**
 * Delete a mission
 */
export function useDeleteMission() {
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: (id: string) => missionService.deleteMission(id),
    meta: { invalidates: [missionKeys.lists(organizationId), missionKeys.active(organizationId)] },
  });
}

/**
 * Update mission status
 */
export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      missionService.updateStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.workflow(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.lists(organizationId) });
      queryClient.invalidateQueries({ queryKey: missionKeys.active(organizationId) });
    },
  });
}

/**
 * Advance a mission command workflow phase
 */
export function useAdvanceMissionWorkflow() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({
      id,
      phase,
      notes,
    }: {
      id: string;
      phase: MissionWorkflowPhase;
      notes?: string;
    }) => missionService.advanceWorkflow(id, phase, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.workflow(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.lists(organizationId) });
      queryClient.invalidateQueries({ queryKey: missionKeys.active(organizationId) });
    },
  });
}

/**
 * Assign user/fleet to a mission
 */
export function useAssignMission() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AssignMissionRequest }) =>
      missionService.assignMission(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, id) });
    },
  });
}

/**
 * Complete or fail a mission
 */
export function useCompleteMission() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CompleteMissionRequest }) =>
      missionService.completeMission(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.workflow(organizationId, id) });
      queryClient.invalidateQueries({ queryKey: missionKeys.lists(organizationId) });
      queryClient.invalidateQueries({ queryKey: missionKeys.active(organizationId) });
    },
  });
}

/**
 * Add a participant to a mission
 */
export function useAddParticipant() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({
      missionId,
      data,
    }: {
      missionId: string;
      data: { userId: string; role?: string };
    }) => missionService.addParticipant(missionId, data),
    onSuccess: (_, { missionId }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, missionId) });
      queryClient.invalidateQueries({
        queryKey: missionKeys.participants(organizationId, missionId),
      });
    },
  });
}

/**
 * Remove a participant from a mission
 */
export function useRemoveParticipant() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ missionId, userId }: { missionId: string; userId: string }) =>
      missionService.removeParticipant(missionId, userId),
    onSuccess: (_, { missionId }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, missionId) });
      queryClient.invalidateQueries({
        queryKey: missionKeys.participants(organizationId, missionId),
      });
    },
  });
}

/**
 * Add an objective to a mission
 */
export function useAddObjective() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ missionId, data }: { missionId: string; data: Omit<MissionObjective, 'id'> }) =>
      missionService.addObjective(missionId, data),
    onSuccess: (_, { missionId }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, missionId) });
    },
  });
}

/**
 * Update an objective
 */
export function useUpdateObjective() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({
      missionId,
      objectiveId,
      data,
    }: {
      missionId: string;
      objectiveId: string;
      data: Partial<MissionObjective>;
    }) => missionService.updateObjective(missionId, objectiveId, data),
    onSuccess: (_, { missionId }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, missionId) });
    },
  });
}

/**
 * Remove an objective
 */
export function useRemoveObjective() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return useMutation({
    mutationFn: ({ missionId, objectiveId }: { missionId: string; objectiveId: string }) =>
      missionService.removeObjective(missionId, objectiveId),
    onSuccess: (_, { missionId }) => {
      queryClient.invalidateQueries({ queryKey: missionKeys.detail(organizationId, missionId) });
    },
  });
}

// ============================================================================
// Prefetch Hooks
// ============================================================================

/**
 * Prefetch a single mission for navigation preloading
 */
export function usePrefetchMission() {
  const queryClient = useQueryClient();
  const organizationId = useMissionOrganizationId();
  return (missionId: string) => {
    queryClient.prefetchQuery({
      queryKey: missionKeys.detail(organizationId, missionId),
      queryFn: () => missionService.getMission(missionId),
      staleTime: 5 * 60 * 1000,
    });
  };
}
