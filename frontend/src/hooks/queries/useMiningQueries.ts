/**
 * Mining Query Hooks
 *
 * TanStack Query hooks for mining operation management with automatic caching,
 * background refetching, and optimistic updates.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  AddCrewMemberDTO,
  CreateMiningOperationDTO,
  RecordResourcesDTO,
  UpdateMiningOperationDTO,
  UpdateStatusDTO,
} from '@/services/miningService';
import { miningService } from '@/services/miningService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { miningKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all mining operations
 */
export function useMiningOperations() {
  return useQuery({
    queryKey: miningKeys.lists(),
    queryFn: () => miningService.getOperations(),
  });
}

/**
 * Hook to fetch a single mining operation by ID
 */
export function useMiningOperation(operationId: string | undefined) {
  return useQuery({
    queryKey: miningKeys.detail(operationId!),
    queryFn: () => miningService.getOperationById(operationId!),
    enabled: !!operationId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new mining operation
 */
export function useCreateMiningOperation() {  return useMutation({
    mutationFn: (data: CreateMiningOperationDTO) => miningService.createOperation(data),
    meta: { invalidates: [miningKeys.lists()] },
  });
}

/**
 * Hook to add a crew member to a mining operation
 */
export function useAddCrewMember() {  return useMutation({
    mutationFn: ({ operationId, data }: { operationId: string; data: AddCrewMemberDTO }) =>
      miningService.addCrewMember(operationId, data),
    meta: {
      invalidates: (_data, variables) => [miningKeys.detail(variables.operationId),],
    },
  });
}

/**
 * Hook to record resources for a mining operation
 */
export function useRecordResources() {  return useMutation({
    mutationFn: ({ operationId, data }: { operationId: string; data: RecordResourcesDTO }) =>
      miningService.recordResources(operationId, data),
    meta: {
      invalidates: (_data, variables) => [miningKeys.detail(variables.operationId),],
    },
  });
}

/**
 * Hook to update mining operation status
 */
export function useUpdateMiningStatus() {  return useMutation({
    mutationFn: ({ operationId, data }: { operationId: string; data: UpdateStatusDTO }) =>
      miningService.updateStatus(operationId, data),
    meta: {
      invalidates: (_data, variables) => [miningKeys.detail(variables.operationId),, miningKeys.lists()],
    },
  });
}

/**
 * Hook to update a mining operation's details
 */
export function useUpdateMiningOperation() {  return useMutation({
    mutationFn: ({ operationId, data }: { operationId: string; data: UpdateMiningOperationDTO }) =>
      miningService.updateOperation(operationId, data),
    meta: {
      invalidates: (_data, variables) => [miningKeys.detail(variables.operationId),, miningKeys.lists()],
    },
  });
}

/**
 * Hook to delete a mining operation
 */
export function useDeleteMiningOperation() {  return useMutation({
    mutationFn: (operationId: string) => miningService.deleteOperation(operationId),
    meta: { invalidates: [miningKeys.lists()] },
  });
}

/**
 * Hook to fetch regolith mining data for a location
 */
export function useRegolithSummary(location: string | undefined) {
  return useQuery({
    queryKey: miningKeys.regolith(location!),
    queryFn: () => miningService.getRegolithSummary(location!),
    enabled: !!location,
    staleTime: 10 * 60 * 1000, // 10 minutes — location data doesn't change often
  });
}
