/**
 * Alliance Query Hooks
 *
 * TanStack Query hooks for alliance diplomacy management with automatic caching,
 * background refetching, and lifecycle operations.
 *
 * Created in Sprint 0.5 — Wire Unwired Features
 */

import type {
  ProposeAllianceDTO,
  ReportIncidentDTO,
  ResolveIncidentDTO,
} from '@/services/allianceService';
import { allianceService } from '@/services/allianceService';
import { useMutation, useQuery } from '@tanstack/react-query';
import { allianceKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to list all alliance relations
 */
export function useAlliances() {
  return useQuery({
    queryKey: allianceKeys.lists(),
    queryFn: () => allianceService.getAlliances(),
  });
}

/**
 * Hook to get a specific alliance by ID
 */
export function useAlliance(allianceId: string | undefined) {
  return useQuery({
    queryKey: allianceKeys.detail(allianceId!),
    queryFn: () => allianceService.getAllianceById(allianceId!),
    enabled: !!allianceId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to propose a new alliance
 */
export function useProposeAlliance() {  return useMutation({
    mutationFn: (data: ProposeAllianceDTO) => allianceService.proposeAlliance(data),
    meta: { invalidates: [allianceKeys.lists()] },
  });
}

/**
 * Hook to approve an alliance
 */
export function useApproveAlliance() {  return useMutation({
    mutationFn: (allianceId: string) => allianceService.approveAlliance(allianceId),
    meta: {
      invalidates: (_data, allianceId) => [allianceKeys.detail(allianceId), allianceKeys.lists()],
    },
  });
}

/**
 * Hook to suspend an alliance
 */
export function useSuspendAlliance() {  return useMutation({
    mutationFn: (allianceId: string) => allianceService.suspendAlliance(allianceId),
    meta: {
      invalidates: (_data, allianceId) => [allianceKeys.detail(allianceId), allianceKeys.lists()],
    },
  });
}

/**
 * Hook to terminate an alliance
 */
export function useTerminateAlliance() {  return useMutation({
    mutationFn: (allianceId: string) => allianceService.terminateAlliance(allianceId),
    meta: {
      invalidates: (_data, allianceId) => [allianceKeys.detail(allianceId), allianceKeys.lists()],
    },
  });
}

/**
 * Hook to report an incident against an alliance
 */
export function useReportAllianceIncident() {  return useMutation({
    mutationFn: ({ allianceId, data }: { allianceId: string; data: ReportIncidentDTO }) =>
      allianceService.reportIncident(allianceId, data),
    meta: {
      invalidates: (_data, variables) => [allianceKeys.detail(variables.allianceId),],
    },
  });
}

/**
 * Hook to resolve an alliance incident
 */
export function useResolveAllianceIncident() {  return useMutation({
    mutationFn: ({
      allianceId,
      incidentId,
      data,
    }: {
      allianceId: string;
      incidentId: string;
      data: ResolveIncidentDTO;
    }) => allianceService.resolveIncident(allianceId, incidentId, data),
    meta: {
      invalidates: (_data, variables) => [allianceKeys.detail(variables.allianceId),],
    },
  });
}
